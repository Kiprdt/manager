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
  'Я синхронизирую задачи и финансы с приложением.\n\n' +
  '<b>Задачи</b>\n' +
  '• Нажмите «➕ Добавить задачи» под списком дня и пришлите задачи — через запятую или каждую с новой строки.\n' +
  '• Галочки ⬜/✅ отмечают выполнение.\n\n' +
  '<b>Финансы</b>\n' +
  '• /balance — сводка по финансам.\n' +
  '• /payments — ближайшие регулярные платежи.\n' +
  '• /expense 500 Еда — расход (или «-500 Еда»).\n' +
  '• /income 5000 Зарплата — доход (или «+5000 Зарплата»).\n' +
  'Списывается/зачисляется на первый счёт.\n\n' +
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

    if (text === '/start' || text === '/help') {
      await sendMessage(token, chatId, HELP, { proxyUrl });
      return;
    }
    if (text === '/cancel') {
      await this.db.telegramChat.update({ where: { chatId: String(chatId) }, data: { pendingAction: null } });
      await sendMessage(token, chatId, 'Ок, ввод отменён.', { proxyUrl });
      return;
    }

    // ── Финансовые команды ───────────────────────────────────────────────────
    if (text === '/balance' || text === '/баланс') {
      if (!chat.userId) {
        await sendMessage(token, chatId, 'Аккаунт не привязан к приложению.', { proxyUrl });
        return;
      }
      const d = await runWithUser(chat.userId, () => this.finance.dashboard());
      await sendMessage(token, chatId, renderFinanceSummary(d), { proxyUrl });
      return;
    }
    if (text === '/payments' || text === '/платежи') {
      if (!chat.userId) {
        await sendMessage(token, chatId, 'Аккаунт не привязан к приложению.', { proxyUrl });
        return;
      }
      const d = await runWithUser(chat.userId, () => this.finance.dashboard());
      if (d.upcoming.length === 0) {
        await sendMessage(token, chatId, 'Регулярных платежей нет.', { proxyUrl });
        return;
      }
      const lines = ['<b>🔁 Ближайшие платежи</b>'];
      for (const p of d.upcoming) {
        const date = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long' }).format(
          new Date(p.nextDate),
        );
        lines.push(`• ${p.name} — ${fmtRub(p.amount)} · ${date}`);
      }
      await sendMessage(token, chatId, lines.join('\n'), { proxyUrl });
      return;
    }
    const quick = parseQuickTx(text);
    if (quick) {
      if (!chat.userId) {
        await sendMessage(token, chatId, 'Аккаунт не привязан к приложению.', { proxyUrl });
        return;
      }
      try {
        const { account } = await runWithUser(chat.userId, () =>
          this.finance.addQuickTransaction(quick.type, quick.amount, quick.category),
        );
        const cat = quick.category ? ` (${quick.category})` : '';
        const sign = quick.type === 'Доход' ? '+' : '−';
        await sendMessage(
          token,
          chatId,
          `${quick.type} ${sign}${fmtRub(quick.amount)}${cat} добавлен.\n${account.name}: ${fmtRub(account.balance)}`,
          { proxyUrl },
        );
      } catch (e) {
        await sendMessage(token, chatId, (e as Error).message, { proxyUrl });
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
