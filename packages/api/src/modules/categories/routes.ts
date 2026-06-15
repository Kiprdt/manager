import { FastifyPluginAsync } from 'fastify';
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  CategorySchema,
} from '@life-app/shared';
import { currentUserId } from '../../lib/context';

const categoryRoutes: FastifyPluginAsync = async (server) => {
  const db = server.prisma;

  server.get('/', async () => {
    const rows = await db.category.findMany({
      where: { userId: currentUserId() },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => CategorySchema.parse(r));
  });

  server.post('/', async (req, reply) => {
    const dto = CreateCategorySchema.parse(req.body);
    const row = await db.category.create({ data: { ...dto, userId: currentUserId() } });
    return reply.status(201).send(CategorySchema.parse(row));
  });

  server.patch<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const dto = UpdateCategorySchema.parse(req.body);
    const ex = await db.category.findFirst({ where: { id: req.params.id, userId: currentUserId() } });
    if (!ex) return reply.status(404).send({ error: 'not found' });
    const row = await db.category.update({ where: { id: req.params.id }, data: dto });
    return CategorySchema.parse(row);
  });

  server.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const ex = await db.category.findFirst({ where: { id: req.params.id, userId: currentUserId() } });
    if (!ex) return reply.status(404).send({ error: 'not found' });
    await db.category.delete({ where: { id: req.params.id } });
    return reply.status(204).send();
  });
};

export default categoryRoutes;
