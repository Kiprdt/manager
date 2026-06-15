import { z } from 'zod';

// Бюджет на категорию за месяц. spent/forecast вычисляются сервером по транзакциям.
export const FinBudgetSchema = z.object({
  id: z.string().cuid(),
  category: z.string().min(1),
  plannedAmount: z.number().nonnegative(),
  monthYear: z.string().min(1), // "MM-yyyy"
  alertThreshold: z.number().min(0).max(100),
  spentAmount: z.number().nonnegative(),
  forecast: z.number().nonnegative(),
  createdAt: z.coerce.date(),
});
export type FinBudget = z.infer<typeof FinBudgetSchema>;

export const CreateFinBudgetSchema = z.object({
  category: z.string().min(1),
  plannedAmount: z.number().nonnegative(),
  monthYear: z.string().regex(/^\d{2}-\d{4}$/, 'Формат месяца: MM-yyyy'),
  alertThreshold: z.number().min(0).max(100).optional(),
});
export type CreateFinBudgetDto = z.infer<typeof CreateFinBudgetSchema>;

export const UpdateFinBudgetSchema = z.object({
  plannedAmount: z.number().nonnegative().optional(),
  alertThreshold: z.number().min(0).max(100).optional(),
});
export type UpdateFinBudgetDto = z.infer<typeof UpdateFinBudgetSchema>;

// ── Производные (порт из Budget.java) ─────────────────────────────────────────

export function budgetRemaining(b: Pick<FinBudget, 'plannedAmount' | 'spentAmount'>): number {
  return b.plannedAmount - b.spentAmount;
}

/** Достигнут ли порог уведомления (spent/planned ≥ threshold%). */
export function budgetOverThreshold(
  b: Pick<FinBudget, 'plannedAmount' | 'spentAmount' | 'alertThreshold'>,
): boolean {
  return b.plannedAmount > 0 && (b.spentAmount / b.plannedAmount) * 100 >= b.alertThreshold;
}

/** Превышен ли лимит (spent > planned). */
export function budgetOverLimit(b: Pick<FinBudget, 'plannedAmount' | 'spentAmount'>): boolean {
  return b.plannedAmount > 0 && b.spentAmount > b.plannedAmount;
}

/** Текущий месяц в формате "MM-yyyy". */
export function currentMonthYear(d = new Date()): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${mm}-${d.getFullYear()}`;
}
