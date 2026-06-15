import { FastifyPluginAsync } from 'fastify';
import {
  CreateHabitSchema,
  UpdateHabitSchema,
  HabitRangeQuerySchema,
  ToggleHabitSchema,
  SetHabitSchema,
} from '@life-app/shared';
import { HabitService } from './service';

const habitRoutes: FastifyPluginAsync = async (server) => {
  const svc = new HabitService(server.prisma);

  server.get('/', async (req) => {
    const query = HabitRangeQuerySchema.parse(req.query);
    return svc.list(query);
  });

  server.post('/', async (req, reply) => {
    const dto = CreateHabitSchema.parse(req.body);
    const habit = await svc.create(dto);
    return reply.status(201).send(habit);
  });

  server.patch<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const dto = UpdateHabitSchema.parse(req.body);
    const habit = await svc.update(req.params.id, dto);
    if (!habit) return reply.status(404).send({ error: 'Habit not found' });
    return habit;
  });

  server.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const deleted = await svc.delete(req.params.id);
    if (!deleted) return reply.status(404).send({ error: 'Habit not found' });
    return reply.status(204).send();
  });

  server.post<{ Params: { id: string } }>('/:id/toggle', async (req, reply) => {
    const dto = ToggleHabitSchema.parse(req.body);
    const result = await svc.toggle(req.params.id, dto.date);
    if (!result) return reply.status(404).send({ error: 'Habit not found' });
    return result;
  });

  server.post<{ Params: { id: string } }>('/:id/set', async (req, reply) => {
    const dto = SetHabitSchema.parse(req.body);
    const result = await svc.setCount(req.params.id, dto.date, dto.count);
    if (!result) return reply.status(404).send({ error: 'Habit not found' });
    return result;
  });
};

export default habitRoutes;
