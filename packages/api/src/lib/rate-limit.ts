import { FastifyReply, FastifyRequest } from 'fastify';

// Простой in-memory лимитер по ключу (обычно IP). Без внешних зависимостей.
// Достаточно для защиты auth-эндпоинтов от перебора на одном инстансе.
interface Bucket {
  count: number;
  resetAt: number;
}

export function rateLimit(opts: { windowMs: number; max: number; keyPrefix?: string }) {
  const buckets = new Map<string, Bucket>();

  // Периодическая чистка протухших корзин.
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }, opts.windowMs).unref?.();
  void cleanup;

  return async (req: FastifyRequest, reply: FastifyReply) => {
    const key = `${opts.keyPrefix ?? ''}${req.ip}`;
    const now = Date.now();
    const b = buckets.get(key);
    if (!b || b.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
      return;
    }
    b.count += 1;
    if (b.count > opts.max) {
      const retryAfter = Math.ceil((b.resetAt - now) / 1000);
      reply.header('Retry-After', String(retryAfter));
      return reply.code(429).send({ error: 'Слишком много попыток, попробуйте позже' });
    }
  };
}
