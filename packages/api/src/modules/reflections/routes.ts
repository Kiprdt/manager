import { FastifyPluginAsync } from 'fastify';
import { UpsertReflectionSchema, ReflectionRangeQuerySchema } from '@life-app/shared';
import { ReflectionService } from './service';

const reflectionRoutes: FastifyPluginAsync = async (server) => {
  const svc = new ReflectionService(server.prisma);

  server.get('/', async (req) => svc.listRange(ReflectionRangeQuerySchema.parse(req.query)));
  server.put('/', async (req, reply) =>
    reply.send(await svc.upsert(UpsertReflectionSchema.parse(req.body))),
  );
};

export default reflectionRoutes;
