import { z } from 'zod';

// Тип категории: доход или расход (как в new_appl).
export const FinCategoryTypeSchema = z.enum(['Доход', 'Расход']);
export type FinCategoryType = z.infer<typeof FinCategoryTypeSchema>;

export const FinCategorySchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(80),
  type: z.string().min(1),
  icon: z.string().min(1).max(8),
  parentId: z.string().nullable(),
});
export type FinCategory = z.infer<typeof FinCategorySchema>;

export const CreateFinCategorySchema = z.object({
  name: z.string().min(1).max(80),
  type: z.string().min(1),
  icon: z.string().min(1).max(8).optional(),
  parentId: z.string().optional().nullable(),
});
export type CreateFinCategoryDto = z.infer<typeof CreateFinCategorySchema>;

export const UpdateFinCategorySchema = CreateFinCategorySchema.partial();
export type UpdateFinCategoryDto = z.infer<typeof UpdateFinCategorySchema>;

// Набор категорий по умолчанию (порт миграций 2/6 из new_appl).
export const DEFAULT_FIN_CATEGORIES: { name: string; type: string; icon: string }[] = [
  { name: 'Еда', type: 'Расход', icon: '🛒' },
  { name: 'Транспорт', type: 'Расход', icon: '🚗' },
  { name: 'Жильё', type: 'Расход', icon: '🏠' },
  { name: 'Развлечения', type: 'Расход', icon: '🎬' },
  { name: 'Здоровье', type: 'Расход', icon: '💊' },
  { name: 'Зарплата', type: 'Доход', icon: '💼' },
  { name: 'Премия', type: 'Доход', icon: '🎁' },
  { name: 'Инвестиции', type: 'Доход', icon: '📈' },
];
