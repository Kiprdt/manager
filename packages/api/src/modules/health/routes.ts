import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  HealthRangeQuerySchema,
  CreateWeightSchema,
  CreateWorkoutSchema,
  UpdateWorkoutSchema,
  CreateMealSchema,
  UpdateMealSchema,
  CreateSupplementSchema,
  UpdateSupplementSchema,
  ToggleSupplementSchema,
  UpdateHealthSettingsSchema,
} from '@life-app/shared';
import { HealthService } from './service';

const healthRoutes: FastifyPluginAsync = async (server) => {
  const svc = new HealthService(server.prisma);

  // Вес
  server.get('/weight', async (req) => svc.listWeight(HealthRangeQuerySchema.parse(req.query)));
  server.post('/weight', async (req, reply) =>
    reply.status(201).send(await svc.upsertWeight(CreateWeightSchema.parse(req.body))),
  );
  server.delete<{ Params: { id: string } }>('/weight/:id', async (req, reply) => {
    const ok = await svc.deleteWeight(req.params.id);
    return ok ? reply.status(204).send() : reply.status(404).send({ error: 'not found' });
  });
  server.get('/weight/series', async (req) => {
    const { by } = z.object({ by: z.enum(['week', 'month']).default('week') }).parse(req.query);
    return svc.weightSeries(by);
  });

  // Тренировки
  server.get('/workouts', async (req) => svc.listWorkouts(HealthRangeQuerySchema.parse(req.query)));
  server.post('/workouts', async (req, reply) =>
    reply.status(201).send(await svc.createWorkout(CreateWorkoutSchema.parse(req.body))),
  );
  server.patch<{ Params: { id: string } }>('/workouts/:id', async (req, reply) => {
    const r = await svc.updateWorkout(req.params.id, UpdateWorkoutSchema.parse(req.body));
    return r ?? reply.status(404).send({ error: 'not found' });
  });
  server.delete<{ Params: { id: string } }>('/workouts/:id', async (req, reply) => {
    const ok = await svc.deleteWorkout(req.params.id);
    return ok ? reply.status(204).send() : reply.status(404).send({ error: 'not found' });
  });
  server.get('/workouts/progress', async (req) => {
    const { kind } = z.object({ kind: z.enum(['strength', 'cardio']).default('strength') }).parse(req.query);
    return svc.workoutProgress(kind);
  });

  // Питание (одна запись на день — upsert)
  server.get('/meals', async (req) => svc.listMeals(HealthRangeQuerySchema.parse(req.query)));
  server.post('/meals', async (req, reply) =>
    reply.status(201).send(await svc.upsertMeal(CreateMealSchema.parse(req.body))),
  );
  server.patch<{ Params: { id: string } }>('/meals/:id', async (req, reply) => {
    const r = await svc.updateMeal(req.params.id, UpdateMealSchema.parse(req.body));
    return r ?? reply.status(404).send({ error: 'not found' });
  });
  server.delete<{ Params: { id: string } }>('/meals/:id', async (req, reply) => {
    const ok = await svc.deleteMeal(req.params.id);
    return ok ? reply.status(204).send() : reply.status(404).send({ error: 'not found' });
  });

  // Настройки здоровья (профиль + цели)
  server.get('/settings', async () => svc.getHealthSettings());
  server.patch('/settings', async (req) =>
    svc.updateHealthSettings(UpdateHealthSettingsSchema.parse(req.body)),
  );

  // Рекомендуемое КБЖУ по профилю
  server.get('/nutrition/recommendation', async () => svc.getNutritionRecommendation());

  // Добавки/лекарства
  server.get('/supplements', async (req) =>
    svc.listSupplements(HealthRangeQuerySchema.parse(req.query)),
  );
  server.post('/supplements', async (req, reply) =>
    reply.status(201).send(await svc.createSupplement(CreateSupplementSchema.parse(req.body))),
  );
  server.patch<{ Params: { id: string } }>('/supplements/:id', async (req, reply) => {
    const r = await svc.updateSupplement(req.params.id, UpdateSupplementSchema.parse(req.body));
    return r ?? reply.status(404).send({ error: 'not found' });
  });
  server.delete<{ Params: { id: string } }>('/supplements/:id', async (req, reply) => {
    const ok = await svc.deleteSupplement(req.params.id);
    return ok ? reply.status(204).send() : reply.status(404).send({ error: 'not found' });
  });
  server.post<{ Params: { id: string } }>('/supplements/:id/toggle', async (req, reply) => {
    const r = await svc.toggleSupplement(req.params.id, ToggleSupplementSchema.parse(req.body).date);
    return r ?? reply.status(404).send({ error: 'not found' });
  });
};

export default healthRoutes;
