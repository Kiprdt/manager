import { FastifyPluginAsync } from 'fastify';
import { UpdateSettingSchema } from '@life-app/shared';
import { SettingService } from './service';

const settingRoutes: FastifyPluginAsync = async (server) => {
  const svc = new SettingService(server.prisma);

  server.get('/', async () => svc.get());

  server.patch('/', async (req) => svc.update(UpdateSettingSchema.parse(req.body)));

  // Тестовое сообщение
  server.post('/telegram/test', async () =>
    svc.sendTelegram('✅ Life Manager: интеграция с Telegram работает.'),
  );

  // Отправить дайджест в Telegram
  server.post('/telegram/digest', async () => {
    const text = await svc.buildDigestText();
    return svc.sendTelegram(text);
  });
};

export default settingRoutes;
