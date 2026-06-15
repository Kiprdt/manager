import { PrismaClient } from '@prisma/client';
import { UpdateSettingDto, Setting } from '@life-app/shared';
import { InsightsService } from '../insights/service';
import { sendMessage } from '../telegram/client';
import { currentUserId } from '../../lib/context';

export class SettingService {
  constructor(private readonly db: PrismaClient) {}

  async get(): Promise<Setting> {
    const userId = currentUserId();
    const row = await this.db.setting.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    return {
      telegramBotToken: row.telegramBotToken,
      telegramChatId: row.telegramChatId,
      telegramEnabled: row.telegramEnabled,
      llmApiKey: row.llmApiKey,
      llmBaseUrl: row.llmBaseUrl,
      llmModel: row.llmModel,
      proxyUrl: row.proxyUrl,
    };
  }

  async update(dto: UpdateSettingDto): Promise<Setting> {
    const userId = currentUserId();
    await this.db.setting.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
    });
    return this.get();
  }

  // Отправка сообщения в Telegram (через общий клиент telegram/client)
  async sendTelegram(text: string): Promise<{ ok: boolean; error?: string }> {
    const s = await this.get();
    if (!s.telegramBotToken || !s.telegramChatId)
      return { ok: false, error: 'Telegram не настроен (нужны токен и chat id)' };
    const data = await sendMessage(s.telegramBotToken, s.telegramChatId, text, {
      proxyUrl: s.proxyUrl,
    });
    return data.ok ? { ok: true } : { ok: false, error: data.description ?? 'Ошибка Telegram' };
  }

  // Текст дневного дайджеста из снимка данных
  async buildDigestText(): Promise<string> {
    const snap = await new InsightsService(this.db).buildSnapshot();
    const lines: string[] = ['<b>📋 Дайджест на сегодня</b>'];
    lines.push(
      `Задачи: сегодня ${snap.tasks.dueToday}, просрочено ${snap.tasks.overdue}, активных ${snap.tasks.active}`,
    );
    if (snap.upcoming.length) {
      lines.push('', '<b>Ближайшие дедлайны:</b>');
      snap.upcoming.slice(0, 5).forEach((u) => {
        const d = new Date(u.dueAt).toLocaleDateString('ru', { day: 'numeric', month: 'short' });
        lines.push(`• ${u.title} — ${d}`);
      });
    }
    if (snap.habits.length) {
      const doneToday = snap.habits.filter((h) => h.doneToday).length;
      lines.push('', `Привычки: ${doneToday}/${snap.habits.length} выполнено сегодня`);
    }
    if (snap.health.latestWeightKg != null)
      lines.push('', `Вес: ${snap.health.latestWeightKg} кг`);
    return lines.join('\n');
  }
}
