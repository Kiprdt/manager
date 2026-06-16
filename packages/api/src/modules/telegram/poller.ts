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
  '<b>➕ Расход / ➕ Доход</b> — выбор счёта → категории → подкатегории, затем сумма.\n' +
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

// Состояние пошагового ввода транзакции (хранится в TelegramChat.pendingAction).
interface TxFlow {
  t: 'Доход' | 'Расход';
  a?: string; // accountId
  aName?: string;
  c?: string; // категория (имя)
  s?: string; // подкатегория (имя)
  step: 'account' | 'category' | 'sub' | 'amount';
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
  private lastTokenTail = '';
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
      // Поллер работает вне пользовательского контекста, поэтому настройки
      // читаем напрямую из БД (SettingService.get() требует currentUserId).
      // Берём первую включённую конфигурацию Telegram с токеном.
      let s;
      try {
        // Самая свежая включённая конфигурация (если аккаунтов несколько —
        // выигрывает последняя сохранённая, т.е. актуальный токен).
        s = await this.db.setting.findFirst({
          where: { telegramEnabled: true, telegramBotToken: { not: null } },
          orderBy: { updatedAt: 'desc' },
        });
      } catch (e) {
        console.error('[telegram] settings read failed:', (e as Error).message);
        await this.sleep(5000);
        continue;
      }
      if (!s?.telegramBotToken) {
        await this.sleep(5000);
        continue;
      }
      const tail = s.telegramBotToken.slice(-6);
      if (tail !== this.lastTokenTail) {
        this.lastTokenTail = tail;
        console.log(`[telegram] using config user=${s.userId ?? 'null'} token=…${tail}`);
      }
      const res = await getUpdates(s.telegramBotToken, this.offset, {
        timeout: 25,
        proxyUrl: s.proxyUrl,
      });
      if (!res.ok) {
        // 401/409/сеть — логируем и делаем паузу, чтобы не долбить.
        console.warn('[telegram] getUpdates failed:', JSON.stringify(res).slice(0, 300));
        await this.sleep(5000);
        continue;
      }
      for (const u of (res.result ?? []) as TgUpdate[]) {
        this.offset = u.update_id + 1;
        try {
          await this.handle(u, s.telegramBotToken, s.proxyUrl, s.userId);
        } catch (e) {
          console.error('[telegram] handle error:', (e as Error).message);
        }
      }
    }
  }

  private async handle(
    u: TgUpdate,
    token: string,
    proxyUrl: string | null,
    ownerUserId: string | null,
  ): Promise<void> {
    // callback (кнопки)
    if (u.callback_query) {
      const cq = u.callback_query;
      const chatId = cq.message?.chat.id;
      const data = cq.data ?? '';
      if (chatId == null) return;
      await this.ensureChat(String(chatId), ownerUserId);

      if (data.startsWith('t:')) {
        const uid = (await this.ensureChat(String(chatId), ownerUserId)).userId;
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
      } else if (data.startsWith('fa:') || data.startsWith('fc:') || data.startsWith('fs:')) {
        await this.handleTxFlowCallback(token, chatId, proxyUrl, ownerUserId, cq.id, data);
      } else {
        await answerCallbackQuery(token, cq.id, '', proxyUrl);
      }
      return;
    }

    // текстовые сообщения
    const msg = u.message;
    if (!msg?.text) return;
    const chatId = msg.chat.id;
    const chat = await this.ensureChat(String(chatId), ownerUserId);
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

    // Финальный шаг пошагового ввода: ожидаем сумму (+ необязательное описание).
    if (chat.pendingAction?.startsWith('finflow:')) {
      let st: TxFlow | null = null;
      try {
        st = JSON.parse(chat.pendingAction.slice('finflow:'.length));
      } catch {
        st = null;
      }
      if (st && st.step === 'amount') {
        const pc = parseAmountCategory(text); // amount + остаток текста = описание
        if (!pc) {
          await sendMessage(token, chatId, 'Введите сумму, напр. <code>500</code> или <code>500 обед</code>.', { proxyUrl, replyMarkup: MENU });
          return;
        }
        await setPending(null);
        if (await noUser()) return;
        try {
          const { account } = await runWithUser(chat.userId!, () =>
            this.finance.addQuickTransaction(st!.t, pc.amount, st!.c ?? null, st!.a, st!.s ?? null, pc.category),
          );
          const tail = [st.c, st.s].filter(Boolean).join(' / ');
          const sign = st.t === 'Доход' ? '+' : '−';
          await sendMessage(token, chatId, `${st.t} ${sign}${fmtRub(pc.amount)}${tail ? ` (${tail})` : ''} на «${account.name}».\nОстаток: ${fmtRub(account.balance)}`, { proxyUrl, replyMarkup: MENU });
        } catch (e) {
          await sendMessage(token, chatId, (e as Error).message, { proxyUrl, replyMarkup: MENU });
        }
        return;
      }
      // Битое/устаревшее состояние — сбрасываем и продолжаем обычную обработку.
      await setPending(null);
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
      await this.startTxFlow(token, chatId, proxyUrl, chat.userId!, type);
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

  // Старт пошагового ввода транзакции: выбор счёта (инлайн-кнопки).
  private async startTxFlow(
    token: string,
    chatId: number,
    proxyUrl: string | null,
    userId: string,
    type: 'Доход' | 'Расход',
  ): Promise<void> {
    const accounts = await this.db.finAccount.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
    if (!accounts.length) {
      await sendMessage(token, chatId, 'Сначала создайте счёт в приложении (раздел «Финансы»).', { proxyUrl, replyMarkup: MENU });
      return;
    }
    const st: TxFlow = { t: type, step: 'account' };
    await this.db.telegramChat.update({
      where: { chatId: String(chatId) },
      data: { pendingAction: `finflow:${JSON.stringify(st)}` },
    });
    const kb = { inline_keyboard: accounts.map((a) => [{ text: a.name, callback_data: `fa:${a.id}` }]) };
    await sendMessage(token, chatId, `Новый ${type.toLowerCase()}. Выберите счёт:`, { proxyUrl, replyMarkup: kb });
  }

  // Обработка инлайн-кнопок пошагового ввода: счёт → категория → подкатегория.
  private async handleTxFlowCallback(
    token: string,
    chatId: number,
    proxyUrl: string | null,
    ownerUserId: string | null,
    cqId: string,
    data: string,
  ): Promise<void> {
    await answerCallbackQuery(token, cqId, '', proxyUrl);
    if (!ownerUserId) {
      await sendMessage(token, chatId, 'Аккаунт не привязан к приложению.', { proxyUrl, replyMarkup: MENU });
      return;
    }
    const chat = await this.db.telegramChat.findUnique({ where: { chatId: String(chatId) } });
    let st: TxFlow | null = null;
    try {
      if (chat?.pendingAction?.startsWith('finflow:')) st = JSON.parse(chat.pendingAction.slice('finflow:'.length));
    } catch {
      st = null;
    }
    if (!st) {
      await sendMessage(token, chatId, 'Сессия ввода истекла — начните заново кнопкой ➕.', { proxyUrl, replyMarkup: MENU });
      return;
    }
    const save = () =>
      this.db.telegramChat.update({
        where: { chatId: String(chatId) },
        data: { pendingAction: `finflow:${JSON.stringify(st)}` },
      });

    if (data.startsWith('fa:')) {
      const acc = await this.db.finAccount.findFirst({ where: { id: data.slice(3), userId: ownerUserId } });
      if (!acc) return;
      st.a = acc.id;
      st.aName = acc.name;
      st.step = 'category';
      await save();
      const cats = await this.db.finCategory.findMany({
        where: { userId: ownerUserId, parentId: null, type: st.t },
        orderBy: { name: 'asc' },
      });
      if (!cats.length) {
        st.step = 'amount';
        await save();
        await sendMessage(token, chatId, `Счёт: ${acc.name}. Введите сумму:`, { proxyUrl, replyMarkup: MENU });
        return;
      }
      const kb = { inline_keyboard: cats.map((c) => [{ text: `${c.icon} ${c.name}`, callback_data: `fc:${c.id}` }]) };
      await sendMessage(token, chatId, `Счёт: ${acc.name}. Категория:`, { proxyUrl, replyMarkup: kb });
      return;
    }
    if (data.startsWith('fc:')) {
      const cat = await this.db.finCategory.findFirst({ where: { id: data.slice(3), userId: ownerUserId } });
      if (!cat) return;
      st.c = cat.name;
      const subs = await this.db.finCategory.findMany({ where: { userId: ownerUserId, parentId: cat.id }, orderBy: { name: 'asc' } });
      if (subs.length) {
        st.step = 'sub';
        await save();
        const kb = {
          inline_keyboard: [
            ...subs.map((s) => [{ text: s.name, callback_data: `fs:${s.id}` }]),
            [{ text: '➡️ Без подкатегории', callback_data: 'fs:-' }],
          ],
        };
        await sendMessage(token, chatId, `${cat.name}. Подкатегория:`, { proxyUrl, replyMarkup: kb });
      } else {
        st.step = 'amount';
        await save();
        await sendMessage(token, chatId, `${cat.name}. Введите сумму (можно с описанием: <code>500 обед</code>):`, { proxyUrl, replyMarkup: MENU });
      }
      return;
    }
    if (data.startsWith('fs:')) {
      const subId = data.slice(3);
      if (subId !== '-') {
        const sub = await this.db.finCategory.findFirst({ where: { id: subId, userId: ownerUserId } });
        if (sub) st.s = sub.name;
      }
      st.step = 'amount';
      await save();
      await sendMessage(token, chatId, 'Введите сумму (можно с описанием: <code>500 обед</code>):', { proxyUrl, replyMarkup: MENU });
      return;
    }
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
        // Только задачи с дедлайном на сегодня (scope='day' — это режим лога,
        // не дата, поэтому в расписание его не включаем).
        where: { userId, status: { not: 'DONE' }, dueAt: { gte: start, lt: end } },
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

  // Создаёт запись чата и привязывает её к пользователю-владельцу конфигурации
  // Telegram (без привязки команды бота отвечали бы «аккаунт не привязан»).
  private async ensureChat(chatId: string, ownerUserId?: string | null) {
    const chat = await this.db.telegramChat.upsert({
      where: { chatId },
      create: { chatId, userId: ownerUserId ?? null },
      update: {},
    });
    if (!chat.userId && ownerUserId) {
      return this.db.telegramChat.update({ where: { chatId }, data: { userId: ownerUserId } });
    }
    return chat;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
