import { PrismaClient } from '@prisma/client';
import { WsEvent } from '@life-app/shared';
import { hub } from '../../ws/hub';
import { runWithUser } from '../../lib/context';
import { SettingService } from '../settings/service';
import { sendMessage, editMessageText, deleteMessage } from './client';
import { renderDayList, ymd, TgTask } from './render';

const FLUSH_DEBOUNCE_MS = 1500;
const PER_DAY_DELAY_MS = 350; // щадим лимиты Telegram

function dayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function nextDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
}
function keyToDate(key: string): Date {
  const [y, m, dd] = key.split('-').map(Number);
  return new Date(y, m - 1, dd, 0, 0, 0, 0);
}

/**
 * Фаза 2: исходящая синхронизация app → Telegram.
 * Слушает hub-события задач, с debounce перестраивает сообщение-список
 * затронутого дня (создать/обновить/удалить), хранит маппинг в БД.
 */
export class TelegramSync {
  private unsub: (() => void) | null = null;
  private dirty = new Set<string>(); // ключи дней YYYY-MM-DD
  private timer: NodeJS.Timeout | null = null;
  private flushing = false;

  constructor(private readonly db: PrismaClient) {}

  start(): void {
    if (this.unsub) return;
    this.unsub = hub.on((e) => this.onEvent(e));
  }

  stop(): void {
    this.unsub?.();
    this.unsub = null;
    if (this.timer) clearTimeout(this.timer);
  }

  // Ручной запрос пересборки конкретных дней (для кнопки «отправить список»)
  requestDays(days: Date[]): void {
    days.forEach((d) => this.markDirty(d));
  }

  async flushNow(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    await this.flush();
  }

  // Определяем затронутые дни и планируем flush
  private async onEvent(e: WsEvent): Promise<void> {
    try {
      if (e.type === 'task.created' || e.type === 'task.updated') {
        const t = e.payload as { id: string; dueAt: string | Date | null; parentId: string | null };
        if (!t.parentId && t.dueAt) this.markDirty(dayStart(new Date(t.dueAt)));
        // Если задача была в другом дне (перенос/снятие даты) — обновим и старый день
        const link = await this.db.telegramTaskLink.findUnique({ where: { taskId: t.id } });
        if (link) this.markDirty(new Date(link.date));
      } else if (e.type === 'task.deleted') {
        // День удалённой задачи неизвестен (связь могла исчезнуть каскадом) —
        // перестраиваем все дни, для которых есть сообщения-списки.
        const lists = await this.db.telegramDayList.findMany({ select: { date: true } });
        lists.forEach((l) => this.markDirty(new Date(l.date)));
      } else {
        return;
      }
      this.scheduleFlush();
    } catch {
      /* не ломаем вещание */
    }
  }

  private markDirty(day: Date): void {
    this.dirty.add(ymd(day));
  }

  private scheduleFlush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), FLUSH_DEBOUNCE_MS);
  }

  private async flush(): Promise<void> {
    if (this.flushing) {
      this.scheduleFlush();
      return;
    }
    this.flushing = true;
    try {
      const days = [...this.dirty];
      this.dirty.clear();
      // Фоновая задача → нет контекста запроса. Берём привязанного пользователя.
      const chat = await this.db.telegramChat.findFirst({ where: { userId: { not: null } } });
      const userId = chat?.userId;
      if (!userId) return;

      await runWithUser(userId, async () => {
        const s = await new SettingService(this.db).get();
        if (!s.telegramEnabled || !s.telegramBotToken || !s.telegramChatId) return;
        for (const key of days) {
          await this.reconcileDay(keyToDate(key), userId, {
            token: s.telegramBotToken,
            chatId: s.telegramChatId,
            proxyUrl: s.proxyUrl,
          });
          await new Promise((r) => setTimeout(r, PER_DAY_DELAY_MS));
        }
      });
    } finally {
      this.flushing = false;
    }
  }

  private async reconcileDay(
    day: Date,
    userId: string,
    cfg: { token: string; chatId: string; proxyUrl: string | null },
  ): Promise<void> {
    const from = dayStart(day);
    const to = nextDay(day);
    const rows = await this.db.task.findMany({
      where: { userId, parentId: null, dueAt: { gte: from, lt: to } },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { importance: 'desc' }, { createdAt: 'asc' }],
    });
    const tasks: TgTask[] = rows.map((r) => ({ id: r.id, title: r.title, status: r.status }));
    const currentIds = tasks.map((t) => t.id);

    // Обновляем маппинг связей для этого дня
    for (let i = 0; i < tasks.length; i++) {
      await this.db.telegramTaskLink.upsert({
        where: { taskId: tasks[i].id },
        create: { taskId: tasks[i].id, date: from, tgItemIndex: i },
        update: { date: from, tgItemIndex: i },
      });
    }
    await this.db.telegramTaskLink.deleteMany({
      where: { date: from, taskId: { notIn: currentIds.length ? currentIds : ['__none__'] } },
    });

    const existing = await this.db.telegramDayList.findUnique({
      where: { chatId_date: { chatId: cfg.chatId, date: from } },
    });

    // День опустел → удаляем сообщение и запись
    if (tasks.length === 0) {
      if (existing) {
        await deleteMessage(cfg.token, cfg.chatId, existing.messageId, cfg.proxyUrl);
        await this.db.telegramDayList.delete({ where: { id: existing.id } });
      }
      return;
    }

    const { text, replyMarkup } = renderDayList(day, tasks);

    if (existing) {
      const res = await editMessageText(cfg.token, cfg.chatId, existing.messageId, text, {
        replyMarkup,
        proxyUrl: cfg.proxyUrl,
      });
      // «message is not modified» — норм; «message to edit not found» — пересоздаём
      if (!res.ok && /not found|message to edit/i.test(res.description ?? '')) {
        const sent = await sendMessage(cfg.token, cfg.chatId, text, { replyMarkup, proxyUrl: cfg.proxyUrl });
        if (sent.ok && sent.result) {
          await this.db.telegramDayList.update({
            where: { id: existing.id },
            data: { messageId: sent.result.message_id },
          });
        }
      }
      return;
    }

    const sent = await sendMessage(cfg.token, cfg.chatId, text, { replyMarkup, proxyUrl: cfg.proxyUrl });
    if (sent.ok && sent.result) {
      await this.db.telegramDayList.create({
        data: { chatId: cfg.chatId, date: from, messageId: sent.result.message_id },
      });
    }
  }
}
