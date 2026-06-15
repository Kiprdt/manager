import { FastifyPluginAsync } from 'fastify';
import { TelegramService, telegramMode } from './service';
import { TelegramSync } from './sync';
import { TelegramPoller } from './poller';

const telegramRoutes: FastifyPluginAsync = async (server) => {
  const svc = new TelegramService(server.prisma);

  // Исходящая синхронизация app → Telegram (Фаза 2): подписка на события задач
  const sync = new TelegramSync(server.prisma);
  sync.start();

  // Входящая синхронизация Telegram → app (Фаза 3): long-polling (если включён)
  const poller = new TelegramPoller(server.prisma);
  poller.start();
  server.log.info(`[telegram] mode=${telegramMode()} polling=${poller.isRunning()}`);

  server.addHook('onClose', async () => {
    sync.stop();
    poller.stop();
  });

  // Состояние интеграции (для экрана настроек)
  server.get('/status', async () => svc.status());

  // Ручная отправка/обновление списков: сегодня + N ближайших дней
  server.post<{ Body: { days?: number } }>('/sync/today', async (req) => {
    const n = Math.max(0, Math.min(14, Number(req.body?.days ?? 0)));
    const base = new Date();
    const list = Array.from({ length: n + 1 }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      return d;
    });
    sync.requestDays(list);
    await sync.flushNow();
    return svc.status();
  });
};

export default telegramRoutes;
