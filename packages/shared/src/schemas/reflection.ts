import { z } from 'zod';

export const ReflectionSchema = z.object({
  id: z.string().cuid(),
  date: z.coerce.date(),
  text: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Reflection = z.infer<typeof ReflectionSchema>;

// Сохранение рефлексии за дату (upsert по дню)
export const UpsertReflectionSchema = z.object({
  date: z.coerce.date(),
  text: z.string().max(20000),
});
export type UpsertReflectionDto = z.infer<typeof UpsertReflectionSchema>;

export const ReflectionRangeQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});
export type ReflectionRangeQuery = z.infer<typeof ReflectionRangeQuerySchema>;
