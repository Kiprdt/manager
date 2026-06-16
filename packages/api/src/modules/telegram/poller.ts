import { PrismaClient } from '@prisma/client';
import { SettingService } from '../settings/service';
import { TaskService } from '../tasks/service';
import { FinanceService, fmtRub } from '../finance/service';
import { runWithUser } from '../../lib/context';
import { telegramMode } from './service';
import { getUpdates, sendMessage, answerCallbackQuery } from './client';

// Минимальные типы апдейтов Telegram, которые нам нужны
interface TgChat {
  id: number;
}
interface TgUpdate {
  update_id: number;
  message?: { chat: TgChat; text?: string };
  callback_query?: { id: string; data?: string; message?: { chat: TgChat } };
}

function dateFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}
function todayStart(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 0, 0, 0, 0);
}
function parseItems(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const HELP =
  'Управляйте задачами и финансами кнопками внизу 👇\n\n' +
  '<b>💰 Финансы</b> — сводка (активы, доход/расход за месяц).\n' +
  '<b>📅 Расписание</b> — события и задачи на сегодня.\n' +
  '<b>➕ Расход / ➕ Доход</b> — нажмите и пришлите «сумма категория», напр. <code>500 Еда</code>.\n' +
  '<b>🔁 Платежи</b> — ближайшие регулярные платежи.\n\n' +
  'Можно и командами: /balance, /schedule, /payments,\n' +
  '/expense 500 Еда (или «-500 Еда»), /income 5000 Зарплата (или «+5000 …»).\n' +
  '/cancel — отменить ввод.';

// Парсинг быстрой транзакции:
//   расход: «/expense 500 Еда», «/расход 500 Еда», «-500 Еда»
//   доход:  «/income 5000 Зарплата», «/доход 5000 Зарплата», «+5000 Зарплата»
function parseQuickTx(
  text: string,
): { type: 'Доход' | 'Расход'; amount: number; category: string | null } | null {
  const income = text.match(/^(?:\/income|\/доход|\+)\s*([\d  .,]+)\s*(.*)$/i);
  const expense = text.match(/^(?:\/expense|\/расход|-)\s*([\d  .,]+)\s*(.*)$/i);
  const m = income ?? expense;
  if (!m) return null;
  const amount = Number(m[1].replace(/[\s ]/g, '').replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { type: income ? 'Доход' : 'Расход', amount, category: m[2].trim() || null };
}

// «500 Еда» → { amount: 500, category: 'Еда' } (для пошагового ввода расхода/дохода).
function parseAmountCategory(text: string): { amount: number; category: string | null } | null {
  const m = text.match(/^([\d  .,]+)\s*(.*)$/);
  if (!m) return null;
  const amount = Number(m[1].replace(/[\s ]/g, '').replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { amount, category: m[2].trim() || null };
}

// Кнопки внизу чата (persistent reply keyboard).
const MENU_LABELS = {
  finance: '💰 Финансы',
  schedule: '📅 Расписание',
  expense: '➕ Расход',
  income: '➕ Доход',
  payments: '🔁 Платежи',
};
const MENU = {
  keyboard: [
    [{ text: MENU_LABELS.finance }, { text: MENU_LABELS.schedule }],
    [{ text: MENU_LABELS.expense }, { text: MENU_LABELS.income }],
    [{ text: MENU_LABELS.payments }],
  ],
  resize_keyboard: true,
};

// Текст сводки финансов для Telegram.
function renderFinanceSummary(d: {
  baseCurrency: string;
  netWorth: number;
  accountsCount: number;
  byCurrency: { currency: string; netWorth: number; totalDebt: number }[];
  monthIncome: number;
  monthExpense: number;
  monthNet: number;
  totalDebt: number;
  dueRecurrentCount: number;
  topExpenses: { category: string; amount: number }[];
}): string {
  const multi = d.byCurrency.length > 1;
  const lines = [
    '<b>💰 Финансы</b>',
    `Чистые активы: <b>${fmtRub(d.netWorth)}</b>${multi ? ` (${d.baseCurrency})` : ''} · счетов: ${d.accountsCount}`,
  ];
  if (multi) {
    for (const c of d.byCurrency) {
      lines.push(`  • ${Math.round(c.netWorth).toLocaleString('ru-RU')} ${c.currency}`);
    }
  }
  lines.push(`За месяц: +${fmtRub(d.monthIncome)} / −${fmtRub(d.monthExpense)} = ${fmtRub(d.monthNet)}`);
  if (d.totalDebt > 0) lines.push(`Долг по кредиткам: ${fmtRub(d.totalDebt)}`);
  if (d.dueRecurrentCount > 0) lines.push(`Платежей к оплате: ${d.dueRecurrentCount}`);
  if (d.topExpenses.length) {
    lines.push('\n<i>Топ расходов:</i>');
    for (const e of d.topExpenses) lines.push(`• ${e.category} — ${fmtRub(e.amount)}`);
  }
  return lines.join('\n');
}

/**
 * Фаза 3: входящая синхронизация Telegram → app (long-polling).
 * Мутации делаются через TaskService → они вещаются в hub → исходящая
 * синхронизация (Фаза 2) сама обновит сообщения-списки.
 */
export class TelegramPoller {
  private running = false;
  private offset = 0;
  private readonly settings: SettingService;
  private readonly tasks: TaskService;
  private readonly finance: FinanceService;

  constructor(private readonly db: PrismaClient) {
    this.settings = new SettingService(db);
    this.tasks = new TaskService(db);
    this.finance = new FinanceService(db);
  }

  start(): void {
    if (this.running || telegramMode() !== 'polling') return;
    this.running = true;
    void this.loop();
  }

  stop(): void {
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  private async loop(): Promise<void> {
    while (this.running) {
      let s;
      try {
        s = await this.settings.get();
      } catch {
        await this.sleep(5000);
        continue;
      }
      if (!s.telegramEnabled || !s.telegramBotToken) {
        await this.sleep(5000);
        continue;
      }
      const res = await getUpdates(s.telegramBotToken, this.offset, {
        timeout: 25,
        proxyUrl: s.proxyUrl,
      });
      if (!res.ok) {
        // 401/409/сеть — пауза, чтобы не долбить
        await this.sleep(5000);
        continue;
      }
      for (const u of (res.result ?? []) as TgUpdate[]) {
        this.offset = u.update_id + 1;
        try {
          await this.handle(u, s.telegramBotToken, s.proxyUrl);
        } catch {
          /* один битый апдейт не должен ронять цикл */
        }
      }
    }
  }

  private async handle(u: TgUpdate, token: string, proxyUrl: string | null): Promise<void> {
    // callback (кнопки)
    if (u.callback_query) {
      const cq = u.callback_query;
      const chatId = cq.message?.chat.id;
      const data = cq.data ?? '';
      if (chatId == null) return;
      await this.ensureChat(String(chatId));

      if (data.startsWith('t:')) {
        const uid = (await this.ensureChat(String(chatId))).userId;
        if (!uid) {
          await answerCallbackQuery(token, cq.id, 'Аккаунт не привязан', proxyUrl);
          return;
        }
        const id = data.slice(2);
        const task = await this.db.task.findFirst({ where: { id, userId: uid } });
        if (task) {
          await runWithUser(uid, () =>
            this.tasks.update(id, { status: task.status === 'DONE' ? 'TODO' : 'DONE' }),
          );
          await answerCallbackQuery(
            token,
            cq.id,
            task.status === 'DONE' ? '⬜ Снято' : '✅ Выполнено',
            proxyUrl,
          );
        } else {
          await answerCallbackQuery(token, cq.id, 'Задача не найдена', proxyUrl);
        }
      } else if (data.startsWith('add:')) {
        const dateKey = data.slice(4);
        await this.db.telegramChat.update({
          where: { chatId: String(chatId) },
          data: { pendingAction: `add:${dateKey}` },
        });
        await answerCallbackQuery(token, cq.id, 'Пришлите задачи', proxyUrl);
        await sendMessage(
          token,
          chatId,
          'Пришлите задачи — через запятую или каждую с новой строки. /cancel — отмена.',
          { proxyUrl },
        );
      } else {
        await answerCallbackQuery(token, cq.id, '', proxyUrl);
      }
      return;
    }

    // текстовые сообщения
    const msg = u.message;
    if (!msg?.text) return;
    const chatId = msg.chat.id;
    const chat = await this.ensureChat(String(chatId));
    const text = msg.text.trim();

    const noUser = async (): Promise<boolean> => {
      if (chat.userId) return false;
      await sendMessage(token, chatId, 'Аккаунт не привязан к приложению.', { proxyUrl, replyMarkup: MENU });
      return true;
    };
    const setPending = (v: string | null) =>
      this.db.telegramChat.update({ where: { chatId: String(chatId) }, data: { pendingAction: v } });

    if (text === '/start' || text === '/help') {
      await sendMessage(token, chatId, HELP, { proxyUrl, replyMarkup: MENU });
      return;
    }
    if (text === '/cancel') {
      await setPending(null);
      await sendMessage(token, chatId, 'Ок, ввод отменён.', { proxyUrl, replyMarkup: MENU });
      return;
    }

    // Пошаговый ввод суммы после кнопки «➕ Расход»/«➕ Доход».
    if (chat.pendingAction?.startsWith('fin:')) {
      const type = chat.pendingAction.slice(4) === 'Доход' ? 'Доход' : 'Расход';
      await setPending(null);
      const pc = parseAmountCategory(text);
      if (!pc) {
        await sendMessage(token, chatId, 'Не понял сумму. Пример: <code>500 Еда</code>', { proxyUrl, replyMarkup: MENU });
        return;
      }
      if (await noUser()) return;
      try {
        const { account } = await runWithUser(chat.userId!, () =>
          this.finance.addQuickTransaction(type, pc.amount, pc.category),
        );
        const cat = pc.category ? ` (${pc.category})` : '';
        const sign = type === 'Доход' ? '+' : '−';
        await sendMessage(token, chatId, `${type} ${sign}${fmtRub(pc.amount)}${cat} добавлен.\n${account.name}: ${fmtRub(account.balance)}`, { proxyUrl, replyMarkup: MENU });
      } catch (e) {
        await sendMessage(token, chatId, (e as Error).message, { proxyUrl, replyMarkup: MENU });
      }
      return;
    }

    // ── Финансы (кнопка/команда) ───────────────────────────────────────────────
    if (text === MENU_LABELS.finance || text === '/balance' || text === '/баланс') {
      if (await noUser()) return;
      const d = await runWithUser(chat.userId!, () => this.finance.dashboard());
      await sendMessage(token, chatId, renderFinanceSummary(d), { proxyUrl, replyMarkup: MENU });
      return;
    }
    if (text === MENU_LABELS.payments || text === '/payments' || text === '/платежи') {
      if (await noUser()) return;
      const d = await runWithUser(chat.userId!, () => this.finance.dashboard());
      if (d.upcoming.length === 0) {
        await sendMessage(token, chatId, 'Регулярных платежей нет.', { proxyUrl, replyMarkup: MENU });
        return;
      }
      const lines = ['<b>🔁 Ближайшие платежи</b>'];
      for (const p of d.upcoming) {
        const date = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long' }).format(new Date(p.nextDate));
        lines.push(`• ${p.name} — ${fmtRub(p.amount)} · ${date}`);
      }
      await sendMessage(token, chatId, lines.join('\n'), { proxyUrl, replyMarkup: MENU });
      return;
    }
    // ── Расписание (кнопка/команда) ────────────────────────────────────────────
    if (text === MENU_LABELS.schedule || text === '/schedule' || text === '/расписание') {
      if (await noUser()) return;
      const txt = await runWithUser(chat.userId!, () => this.renderSchedule(chat.userId!));
      await sendMessage(token, chatId, txt, { proxyUrl, replyMarkup: MENU });
      return;
    }
    // ── Начать ввод расхода/дохода (кнопка) ────────────────────────────────────
    if (text === MENU_LABELS.expense || text === MENU_LABELS.income) {
      if (await noUser()) return;
      const type = text === MENU_LABELS.income ? 'Доход' : 'Расход';
      await setPending(`fin:${type}`);
      await sendMessage(token, chatId, `Введите сумму и категорию для «${type}». Пример: <code>500 Еда</code>`, { proxyUrl, replyMarkup: MENU });
      return;
    }

    // Быстрый ввод командой: «/expense 500 Еда», «-500 Еда», «/income 5000 …», «+5000 …»
    const quick = parseQuickTx(text);
    if (quick) {
      if (await noUser()) return;
      try {
        const { account } = await runWithUser(chat.userId!, () =>
          this.finance.addQuickTransaction(quick.type, quick.amount, quick.category),
        );
        const cat = quick.category ? ` (${quick.category})` : '';
        const sign = quick.type === 'Доход' ? '+' : '−';
        await sendMessage(token, chatId, `${quick.type} ${sign}${fmtRub(quick.amount)}${cat} добавлен.\n${account.name}: ${fmtRub(account.balance)}`, { proxyUrl, replyMarkup: MENU });
      } catch (e) {
        await sendMessage(token, chatId, (e as Error).message, { proxyUrl, replyMarkup: MENU });
      }
      return;
    }

    // День: из pendingAction (после кнопки «➕») либо сегодня
    let day = todayStart();
    if (chat.pendingAction?.startsWith('add:')) {
      day = dateFromKey(chat.pendingAction.slice(4));
      await this.db.telegramChat.update({ where: { chatId: String(chatId) }, data: { pendingAction: null } });
    }

    const items = parseItems(text);
    if (items.length === 0) return;
    if (!chat.userId) {
      await sendMessage(token, chatId, 'Аккаунт не привязан к приложению.', { proxyUrl });
      return;
    }
    await runWithUser(chat.userId, async () => {
      for (const title of items) {
        await this.tasks.create({ title, dueAt: day, dueAllDay: true, scope: 'day', source: 'telegram' });
      }
    });
    const label = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long' }).format(day);
    await sendMessage(token, chatId, `Добавлено задач: ${items.length} (на ${label})`, { proxyUrl });
  }

  // Расписание на сегодня: события (таймблоки) + незавершённые задачи дня.
  private async renderSchedule(userId: string): Promise<string> {
    const start = todayStart();
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const [events, tasks] = await Promise.all([
      this.db.timeBlock.findMany({
        where: { userId, startAt: { gte: start, lt: end } },
        orderBy: { startAt: 'asc' },
      }),
      this.db.task.findMany({
        where: {
          userId,
          status: { not: 'DONE' },
          OR: [{ dueAt: { gte: start, lt: end } }, { scope: 'day' }],
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        take: 20,
      }),
    ]);
    const hhmm = (d: Date) =>
      new Intl.DateTimeFormat('ru', { hour: '2-digit', minute: '2-digit' }).format(new Date(d));
    const dayLabel = new Intl.DateTimeFormat('ru', { weekday: 'long', day: 'numeric', month: 'long' }).format(start);
    const lines = [`<b>📅 Расписание · ${dayLabel}</b>`];
    if (events.length) {
      lines.push('\n<i>События:</i>');
      for (const e of events) {
        const time = e.isAllDay ? 'весь день' : `${hhmm(e.startAt)}–${hhmm(e.endAt)}`;
        lines.push(`• ${time} — ${e.title}`);
      }
    }
    if (tasks.length) {
      lines.push('\n<i>Задачи:</i>');
      for (const t of tasks) lines.push(`• ⬜ ${t.title}`);
    }
    if (!events.length && !tasks.length) lines.push('\nНа сегодня пусто 🎉');
    return lines.join('\n');
  }

  private async ensureChat(chatId: string) {
    return this.db.telegramChat.upsert({
      where: { chatId },
      create: { chatId },
      update: {},
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
