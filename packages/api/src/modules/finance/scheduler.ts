import { PrismaClient } from '@prisma/client';
import { FastifyBaseLogger } from 'fastify';
import { runWithUser } from '../../lib/context';
import { FinanceService } from './service';

// Планировщик авто-проведения регулярных платежей. Раз в час проверяет всех
// пользователей и проводит наступившие платежи (идемпотентно — сдвигает nextDate).
export function startFinanceScheduler(db: PrismaClient, log: FastifyBaseLogger): () => void {
  const INTERVAL_MS = 60 * 60 * 1000; // 1 час
  const finance = new FinanceService(db);

  const tick = async () => {
    try {
      const users = await db.user.findMany({ select: { id: true } });
      let total = 0;
      for (const u of users) {
        total += await runWithUser(u.id, () => finance.processRecurrent());
      }
      if (total > 0) log.info(`[finance] проведено регулярных платежей: ${total}`);
    } catch (e) {
      log.error(e, '[finance] ошибка планировщика регулярных платежей');
    }
  };

  // Первый прогон вскоре после старта, далее по интервалу.
  const kickoff = setTimeout(tick, 30_000);
  const timer = setInterval(tick, INTERVAL_MS);
  timer.unref?.();
  kickoff.unref?.();

  return () => {
    clearInterval(timer);
    clearTimeout(kickoff);
  };
}
