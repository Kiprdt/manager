import { FastifyPluginAsync } from 'fastify';
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  TaskListQuerySchema,
} from '@life-app/shared';
import { TaskService } from './service';

const taskRoutes: FastifyPluginAsync = async (server) => {
  const svc = new TaskService(server.prisma);

  server.get('/', async (req, reply) => {
    const query = TaskListQuerySchema.parse(req.query);
    return svc.list(query);
  });

  server.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const task = await svc.getById(req.params.id);
    if (!task) return reply.status(404).send({ error: 'Task not found' });
    return task;
  });

  server.post('/', async (req, reply) => {
    const dto = CreateTaskSchema.parse(req.body);
    const task = await svc.create(dto);
    return reply.status(201).send(task);
  });

  server.patch<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const dto = UpdateTaskSchema.parse(req.body);
    const task = await svc.update(req.params.id, dto);
    if (!task) return reply.status(404).send({ error: 'Task not found' });
    return task;
  });

  server.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const deleted = await svc.delete(req.params.id);
    if (!deleted) return reply.status(404).send({ error: 'Task not found' });
    return reply.status(204).send();
  });
};

export default taskRoutes;
