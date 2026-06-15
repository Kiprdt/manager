import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import cors from '@fastify/cors';

const corsPlugin: FastifyPluginAsync = fp(async (server) => {
  const origin = process.env.CORS_ORIGIN ?? '*';
  if (process.env.NODE_ENV === 'production' && origin === '*') {
    server.log.warn('CORS_ORIGIN не задан — в production рекомендуется указать конкретный домен');
  }
  server.register(cors, {
    origin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
});

export default corsPlugin;
