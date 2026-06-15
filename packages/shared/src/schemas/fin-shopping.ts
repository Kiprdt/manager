import { z } from 'zod';

// Пункт списка покупок (порт ShoppingItem.java; теперь персистентный).
export const FinShoppingItemSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(120),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(16),
  price: z.number().nonnegative(),
  checked: z.boolean(),
  createdAt: z.coerce.date(),
});
export type FinShoppingItem = z.infer<typeof FinShoppingItemSchema>;

export const CreateFinShoppingItemSchema = z.object({
  name: z.string().min(1).max(120),
  quantity: z.number().positive().optional(),
  unit: z.string().min(1).max(16).optional(),
  price: z.number().nonnegative().optional(),
});
export type CreateFinShoppingItemDto = z.infer<typeof CreateFinShoppingItemSchema>;

export const UpdateFinShoppingItemSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  quantity: z.number().positive().optional(),
  unit: z.string().min(1).max(16).optional(),
  price: z.number().nonnegative().optional(),
  checked: z.boolean().optional(),
});
export type UpdateFinShoppingItemDto = z.infer<typeof UpdateFinShoppingItemSchema>;

/** Итог по пункту = количество × цена. */
export function shoppingItemTotal(i: Pick<FinShoppingItem, 'quantity' | 'price'>): number {
  return i.quantity * i.price;
}
