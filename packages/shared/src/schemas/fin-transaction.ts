import { z } from 'zod';

// Тип операции: доход, расход или перевод между счетами (как в new_appl).
export const FinTxTypeSchema = z.enum(['Доход', 'Расход', 'Перевод']);
export type FinTxType = z.infer<typeof FinTxTypeSchema>;

export const FinTransactionSchema = z.object({
  id: z.string().cuid(),
  type: z.string().min(1),
  category: z.string().nullable(),
  subcategory: z.string().nullable(),
  amount: z.number().positive(),
  accountId: z.string(),
  toAccountId: z.string().nullable(),
  date: z.coerce.date(),
  description: z.string().nullable(),
  tags: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type FinTransaction = z.infer<typeof FinTransactionSchema>;

export const CreateFinTransactionSchema = z
  .object({
    type: FinTxTypeSchema,
    category: z.string().optional().nullable(),
    subcategory: z.string().optional().nullable(),
    amount: z.number().positive(),
    accountId: z.string().min(1),
    toAccountId: z.string().optional().nullable(),
    date: z.coerce.date(),
    description: z.string().optional().nullable(),
    tags: z.string().optional().nullable(),
  })
  .refine((d) => d.type !== 'Перевод' || !!d.toAccountId, {
    message: 'Для перевода нужен счёт назначения',
    path: ['toAccountId'],
  })
  .refine((d) => d.type !== 'Перевод' || d.toAccountId !== d.accountId, {
    message: 'Счёт назначения должен отличаться от счёта списания',
    path: ['toAccountId'],
  });
export type CreateFinTransactionDto = z.infer<typeof CreateFinTransactionSchema>;

// Частичное обновление (без смены типа/счетов — чтобы не усложнять пересчёт баланса).
export const UpdateFinTransactionSchema = z.object({
  category: z.string().optional().nullable(),
  subcategory: z.string().optional().nullable(),
  amount: z.number().positive().optional(),
  date: z.coerce.date().optional(),
  description: z.string().optional().nullable(),
  tags: z.string().optional().nullable(),
});
export type UpdateFinTransactionDto = z.infer<typeof UpdateFinTransactionSchema>;
