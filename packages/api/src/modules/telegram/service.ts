import { PrismaClient } from '@prisma/client';
import { SettingService } from '../settings/service';
import { currentUserId } from '../../lib/context';

// Конфигурация транспорта Telegram (Фаза 1 — только чтение состояния)
export function telegramMode(): 'polling' | 'webhook' | 'off' {
  const m = (process.env.TELEGRAM_MODE ?? 'off').toLowerCase();
  return m === 'polling' || m === 'webhook' ? m : 'off';
}

export interface TelegramStatus {
  configured: boolean; // есть токен и chatId в настройках
  linked: boolean; // чат привязан (TelegramChat)
  enabled: boolean; // включено в настройках
  mode: 'polling' | 'webhook' | 'off';
}

export class TelegramService {
  constructor(private readonly db: PrismaClient) {}

  async getLinkedChat() {
    return this.db.telegramChat.findFirst({ where: { userId: currentUserId() } });
  }

  async status(): Promise<TelegramStatus> {
    const s = await new SettingService(this.db).get();
    const chat = await this.getLinkedChat();
    return {
      configured: !!s.telegramBotToken && !!s.telegramChatId,
      linked: !!chat,
      enabled: s.telegramEnabled,
      mode: telegramMode(),
    };
  }
}
