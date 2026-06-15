import { z } from 'zod';

export const FinanceTxTypeSchema = z.enum(['income', 'expense']);

export const FinanceTxSchema = z.object({
  id: z.string().cuid(),
  type: FinanceTxTypeSchema,
  amount: z.number().positive(),
  category: z.string().nullable(),
  categoryId: z.string().nullable(),
  note: z.string().nullable(),
  date: z.coerce.date(),
  recurring: z.boolean(),
  createdAt: z.coerce.date(),
});
export type FinanceTx = z.infer<typeof FinanceTxSchema>;

export const CreateFinanceTxSchema = z.object({
  type: FinanceTxTypeSchema,
  amount: z.number().positive(),
  category: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  date: z.coerce.date(),
  recurring: z.boolean().optional(),
});
export type CreateFinanceTxDto = z.infer<typeof CreateFinanceTxSchema>;
export const UpdateFinanceTxSchema = CreateFinanceTxSchema.partial();
export type UpdateFinanceTxDto = z.infer<typeof UpdateFinanceTxSchema>;

export const FinanceKindSchema = z.enum(['deposit', 'investment', 'loan']);

export const FinanceInstrumentSchema = z.object({
  id: z.string().cuid(),
  kind: FinanceKindSchema,
  name: z.string().min(1).max(120),
  principal: z.number().nonnegative(),
  annualRate: z.number().min(0).max(1000),
  termMonths: z.number().int().min(1).max(1200),
  monthlyContribution: z.number().nonnegative(),
  createdAt: z.coerce.date(),
});
export type FinanceInstrument = z.infer<typeof FinanceInstrumentSchema>;

export const CreateFinanceInstrumentSchema = z.object({
  kind: FinanceKindSchema,
  name: z.string().min(1).max(120),
  principal: z.number().nonnegative(),
  annualRate: z.number().min(0).max(1000),
  termMonths: z.number().int().min(1).max(1200),
  monthlyContribution: z.number().nonnegative().optional(),
});
export type CreateFinanceInstrumentDto = z.infer<typeof CreateFinanceInstrumentSchema>;

export const FinanceRangeQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});
export type FinanceRangeQuery = z.infer<typeof FinanceRangeQuerySchema>;
