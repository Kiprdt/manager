import { z } from 'zod';

// Типы счетов (как в new_appl). "Кредитная" — кредитная карта/счёт.
export const FinAccountTypeSchema = z.enum([
  'Наличные',
  'Дебетовая',
  'Кредитная',
  'Вклад',
  'Накопительный',
]);
export type FinAccountType = z.infer<typeof FinAccountTypeSchema>;

export const FinAccountSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(120),
  currency: z.string().min(1).max(8),
  balance: z.number(),
  type: z.string().min(1),
  cardNumber: z.string().nullable(),
  color: z.string().nullable(),
  creditLimit: z.number().nonnegative(),
  interestRate: z.number().min(0).max(1000),
  minPaymentPct: z.number().min(0).max(100),
  paymentDay: z.number().int().min(1).max(31),
  createdAt: z.coerce.date(),
});
export type FinAccount = z.infer<typeof FinAccountSchema>;

export const CreateFinAccountSchema = z.object({
  name: z.string().min(1).max(120),
  currency: z.string().min(1).max(8).optional(),
  balance: z.number().optional(),
  type: z.string().min(1),
  cardNumber: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  creditLimit: z.number().nonnegative().optional(),
  interestRate: z.number().min(0).max(1000).optional(),
  minPaymentPct: z.number().min(0).max(100).optional(),
  paymentDay: z.number().int().min(1).max(31).optional(),
});
export type CreateFinAccountDto = z.infer<typeof CreateFinAccountSchema>;

export const UpdateFinAccountSchema = CreateFinAccountSchema.partial();
export type UpdateFinAccountDto = z.infer<typeof UpdateFinAccountSchema>;

// ── Производные расчёты (порт из Account.java / CreditCard.java) ───────────────

/** Кредитный ли счёт. */
export function isCreditAccount(a: Pick<FinAccount, 'type'>): boolean {
  return a.type === 'Кредитная';
}

/**
 * Текущий долг. Для кредитного счёта: creditLimit − balance (не меньше 0).
 * Для обычного счёта — всегда 0.
 */
export function accountCurrentDebt(
  a: Pick<FinAccount, 'type' | 'creditLimit' | 'balance'>,
): number {
  if (!isCreditAccount(a)) return 0;
  return Math.max(0, a.creditLimit - a.balance);
}

/** Утилизация кредита (долг / лимит), от 0 до 1. */
export function accountUtilization(
  a: Pick<FinAccount, 'type' | 'creditLimit' | 'balance'>,
): number {
  if (!isCreditAccount(a) || a.creditLimit <= 0) return 0;
  return Math.min(accountCurrentDebt(a) / a.creditLimit, 1);
}

/** Минимальный платёж по кредитке = долг × minPaymentPct%. */
export function creditMinPayment(
  a: Pick<FinAccount, 'type' | 'creditLimit' | 'balance' | 'minPaymentPct'>,
): number {
  return (accountCurrentDebt(a) * a.minPaymentPct) / 100;
}

/** Проценты за месяц по текущему долгу = долг × годовая ставка% / 12. */
export function creditMonthlyInterest(
  a: Pick<FinAccount, 'type' | 'creditLimit' | 'balance' | 'interestRate'>,
): number {
  return (accountCurrentDebt(a) * a.interestRate) / 100 / 12;
}
