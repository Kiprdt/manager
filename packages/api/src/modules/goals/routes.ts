import { FastifyPluginAsync } from 'fastify';
import { CreateGoalSchema, UpdateGoalSchema } from '@life-app/shared';
import { GoalService } from './service';

const goalRoutes: FastifyPluginAsync = async (server) => {
  const svc = new GoalService(server.prisma);

  server.get('/', async () => svc.list());
  server.post('/', async (req, reply) =>
    reply.status(201).send(await svc.create(CreateGoalSchema.parse(req.body))),
  );
  server.patch<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const g = await svc.update(req.params.id, UpdateGoalSchema.parse(req.body));
    return g ?? reply.status(404).send({ error: 'not found' });
  });
  server.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const ok = await svc.delete(req.params.id);
    return ok ? reply.status(204).send() : reply.status(404).send({ error: 'not found' });
  });
};

export default goalRoutes;
