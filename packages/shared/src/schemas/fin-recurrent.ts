import { z } from 'zod';

// Периодичность регулярного платежа (порт frequency из new_appl).
export const FinFrequencySchema = z.enum(['Ежедневно', 'Еженедельно', 'Ежемесячно', 'Ежегодно']);
export type FinFrequency = z.infer<typeof FinFrequencySchema>;

export const FinRecurrentPaymentSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(120),
  type: z.string().min(1),
  category: z.string().nullable(),
  subcategory: z.string().nullable(),
  amount: z.number().positive(),
  accountId: z.string(),
  frequency: z.string().min(1),
  nextDate: z.coerce.date(),
  createdAt: z.coerce.date(),
});
export type FinRecurrentPayment = z.infer<typeof FinRecurrentPaymentSchema>;

export const CreateFinRecurrentPaymentSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.string().min(1).optional(), // по умолчанию "Расход"
  category: z.string().optional().nullable(),
  subcategory: z.string().optional().nullable(),
  amount: z.number().positive(),
  accountId: z.string().min(1),
  frequency: FinFrequencySchema,
  nextDate: z.coerce.date(),
});
export type CreateFinRecurrentPaymentDto = z.infer<typeof CreateFinRecurrentPaymentSchema>;

export const UpdateFinRecurrentPaymentSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  amount: z.number().positive().optional(),
  category: z.string().optional().nullable(),
  frequency: FinFrequencySchema.optional(),
  nextDate: z.coerce.date().optional(),
});
export type UpdateFinRecurrentPaymentDto = z.infer<typeof UpdateFinRecurrentPaymentSchema>;

/** Следующая дата по периодичности (порт логики advance в new_appl). */
export function advanceByFrequency(from: Date, frequency: string): Date {
  const d = new Date(from);
  switch (frequency) {
    case 'Ежедневно':
      d.setDate(d.getDate() + 1);
      break;
    case 'Еженедельно':
      d.setDate(d.getDate() + 7);
      break;
    case 'Ежегодно':
      d.setFullYear(d.getFullYear() + 1);
      break;
    case 'Ежемесячно':
    default:
      d.setMonth(d.getMonth() + 1);
      break;
  }
  return d;
}
