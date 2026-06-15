import { FastifyPluginAsync } from 'fastify';
import {
  CreateTimeBlockSchema,
  UpdateTimeBlockSchema,
  TimeBlockRangeQuerySchema,
} from '@life-app/shared';
import { TimeBlockService } from './service';

const timeBlockRoutes: FastifyPluginAsync = async (server) => {
  const svc = new TimeBlockService(server.prisma);

  server.get('/', async (req, reply) => {
    const query = TimeBlockRangeQuerySchema.parse(req.query);
    return svc.list(query);
  });

  server.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const block = await svc.getById(req.params.id);
    if (!block) return reply.status(404).send({ error: 'TimeBlock not found' });
    return block;
  });

  server.post('/', async (req, reply) => {
    const dto = CreateTimeBlockSchema.parse(req.body);
    const block = await svc.create(dto);
    return reply.status(201).send(block);
  });

  server.patch<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const dto = UpdateTimeBlockSchema.parse(req.body);
    const block = await svc.update(req.params.id, dto);
    if (!block) return reply.status(404).send({ error: 'TimeBlock not found' });
    return block;
  });

  server.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const deleted = await svc.delete(req.params.id);
    if (!deleted) return reply.status(404).send({ error: 'TimeBlock not found' });
    return reply.status(204).send();
  });
};

export default timeBlockRoutes;
