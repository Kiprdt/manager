import { FastifyPluginAsync } from 'fastify';
import { RegisterSchema, LoginSchema } from '@life-app/shared';
import { AuthService } from './service';
import { rateLimit } from '../../lib/rate-limit';

const authRoutes: FastifyPluginAsync = async (server) => {
  const svc = new AuthService(server.prisma);

  // Защита от перебора: не более 10 попыток за 15 минут с одного IP.
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: 'auth:' });

  server.post('/register', { preHandler: authLimiter }, async (req, reply) => {
    const user = await svc.register(RegisterSchema.parse(req.body));
    const token = server.jwt.sign({ id: user.id, email: user.email });
    return reply.code(201).send({ token, user });
  });

  server.post('/login', { preHandler: authLimiter }, async (req) => {
    const user = await svc.login(LoginSchema.parse(req.body));
    const token = server.jwt.sign({ id: user.id, email: user.email });
    return { token, user };
  });

  // Защищено глобальным guard (req.user уже проверен)
  server.get('/me', async (req) => {
    const u = req.user as { id: string };
    return { user: await svc.getById(u.id) };
  });
};

export default authRoutes;
