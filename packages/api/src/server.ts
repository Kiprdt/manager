import Fastify from 'fastify';
import { ZodError } from 'zod';
import { mkdirSync } from 'node:fs';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import prismaPlugin from './plugins/prisma';
import corsPlugin from './plugins/cors';
import websocketPlugin from './plugins/websocket';
import authPlugin from './plugins/auth';
import authRoutes from './modules/auth/routes';
import taskRoutes from './modules/tasks/routes';
import timeBlockRoutes from './modules/timeblocks/routes';
import habitRoutes from './modules/habits/routes';
import healthRoutes from './modules/health/routes';
import noteRoutes, { UPLOAD_DIR } from './modules/notes/routes';
import categoryRoutes from './modules/categories/routes';
import insightsRoutes from './modules/insights/routes';
import settingRoutes from './modules/settings/routes';
import financeRoutes from './modules/finance/routes';
import goalRoutes from './modules/goals/routes';
import reflectionRoutes from './modules/reflections/routes';
import telegramRoutes from './modules/telegram/routes';
import wsRoutes from './ws/routes';
import { startFinanceScheduler } from './modules/finance/scheduler';

const server = Fastify({
  logger: {
    transport:
      process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty' }
        : undefined,
  },
});

// ── Plugins ──────────────────────────────────────────────────────────────────
mkdirSync(UPLOAD_DIR, { recursive: true });

server.register(corsPlugin);
server.register(websocketPlugin);
server.register(prismaPlugin);
server.register(authPlugin);
server.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } });
server.register(fastifyStatic, { root: UPLOAD_DIR, prefix: '/uploads/' });

// ── Routes ───────────────────────────────────────────────────────────────────
server.register(wsRoutes);
server.register(authRoutes, { prefix: '/api/auth' });
server.register(taskRoutes, { prefix: '/api/tasks' });
server.register(timeBlockRoutes, { prefix: '/api/timeblocks' });
server.register(habitRoutes, { prefix: '/api/habits' });
server.register(healthRoutes, { prefix: '/api/health' });
server.register(noteRoutes, { prefix: '/api/notes' });
server.register(categoryRoutes, { prefix: '/api/categories' });
server.register(insightsRoutes, { prefix: '/api/insights' });
server.register(settingRoutes, { prefix: '/api/settings' });
server.register(financeRoutes, { prefix: '/api/finance' });
server.register(goalRoutes, { prefix: '/api/goals' });
server.register(reflectionRoutes, { prefix: '/api/reflections' });
server.register(telegramRoutes, { prefix: '/api/telegram' });

// Healthcheck — используется Docker Compose и load-balancer'ами
server.get('/health', async () => ({ status: 'ok' }));

// ── Global error handler ──────────────────────────────────────────────────────
server.setErrorHandler((error, _req, reply) => {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: 'Validation error',
      issues: error.issues,
    });
  }

  server.log.error(error);
  const statusCode = error.statusCode ?? 500;
  return reply.status(statusCode).send({
    error: statusCode >= 500 ? 'Internal server error' : error.message,
  });
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const start = async () => {
  const port = Number(process.env.PORT ?? 3001);
  try {
    await server.listen({ port, host: '0.0.0.0' });
    // Авто-проведение регулярных платежей по расписанию.
    startFinanceScheduler(server.prisma, server.log);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
