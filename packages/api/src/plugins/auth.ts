import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import jwt from '@fastify/jwt';
import { runWithUser } from '../lib/context';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
  }
}

// Публичные пути (без авторизации)
const PUBLIC: RegExp[] = [
  /^\/health$/,
  /^\/api\/auth\/register$/,
  /^\/api\/auth\/login$/,
  /^\/uploads\//,
  /^\/ws(\/|$|\?)/,
];

const authPlugin: FastifyPluginAsync = fp(async (server) => {
  const DEV_SECRET = 'dev-insecure-secret-change-me';
  const secret = process.env.JWT_SECRET ?? DEV_SECRET;
  // В проде небезопасный дефолтный/короткий секрет недопустим — токены стали бы подделываемы.
  if (process.env.NODE_ENV === 'production' && (secret === DEV_SECRET || secret.length < 16)) {
    throw new Error(
      'JWT_SECRET обязателен в production и должен быть длиной ≥16 символов',
    );
  }
  await server.register(jwt, {
    secret,
    sign: { expiresIn: '30d' },
  });

  // 1) Проверяем токен и кладём userId на запрос
  server.addHook('onRequest', async (req, reply) => {
    if (req.method === 'OPTIONS') return;
    const path = req.url.split('?')[0];
    if (PUBLIC.some((re) => re.test(path))) return;
    try {
      await req.jwtVerify();
      req.userId = (req.user as { id: string }).id;
    } catch {
      return reply.code(401).send({ error: 'Не авторизован' });
    }
  });

  // 2) Оборачиваем остальную обработку запроса в контекст пользователя.
  //    callback-стиль + als.run(done) надёжно пробрасывает контекст в хендлер
  //    (в отличие от enterWith в async-хуке).
  server.addHook('preHandler', (req, _reply, done) => {
    if (req.userId) runWithUser(req.userId, done);
    else done();
  });
});

export default authPlugin;
