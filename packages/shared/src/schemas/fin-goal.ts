import { z } from 'zod';

// Финансовая цель накопления (порт Goal.java из new_appl).
export const FinGoalSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(120),
  targetAmount: z.number().positive(),
  currentAmount: z.number().nonnegative(),
  deadline: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});
export type FinGoal = z.infer<typeof FinGoalSchema>;

export const CreateFinGoalSchema = z.object({
  name: z.string().min(1).max(120),
  targetAmount: z.number().positive(),
  currentAmount: z.number().nonnegative().optional(),
  deadline: z.coerce.date().optional().nullable(),
});
export type CreateFinGoalDto = z.infer<typeof CreateFinGoalSchema>;

export const UpdateFinGoalSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  targetAmount: z.number().positive().optional(),
  currentAmount: z.number().nonnegative().optional(),
  deadline: z.coerce.date().optional().nullable(),
});
export type UpdateFinGoalDto = z.infer<typeof UpdateFinGoalSchema>;

// Прогресс цели от 0 до 1 (порт Goal.getProgress()).
export function finGoalProgress(g: Pick<FinGoal, 'targetAmount' | 'currentAmount'>): number {
  if (g.targetAmount <= 0) return 0;
  return Math.min(g.currentAmount / g.targetAmount, 1);
}
