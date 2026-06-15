import { z } from 'zod';

// Категория цели (устаревшее поле, по умолчанию custom)
export const GoalTypeSchema = z.enum(['weight', 'finance', 'habit', 'tasks', 'custom']);
export type GoalType = z.infer<typeof GoalTypeSchema>;

export const GoalSchema = z.object({
  id: z.string().cuid(),
  title: z.string().min(1).max(200),
  priority: z.number().int().min(0).max(3),
  notes: z.string().nullable(),
  dueAt: z.coerce.date().nullable(),
  categoryId: z.string().nullable(),
  done: z.boolean(),
  createdAt: z.coerce.date(),
});
export type Goal = z.infer<typeof GoalSchema>;

export const CreateGoalSchema = z.object({
  title: z.string().min(1).max(200),
  priority: z.number().int().min(0).max(3).optional(),
  notes: z.string().optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
  categoryId: z.string().optional().nullable(),
});
export type CreateGoalDto = z.infer<typeof CreateGoalSchema>;

export const UpdateGoalSchema = CreateGoalSchema.partial().extend({
  done: z.boolean().optional(),
});
export type UpdateGoalDto = z.infer<typeof UpdateGoalSchema>;
