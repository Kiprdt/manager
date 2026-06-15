import { z } from 'zod';

export const HabitScheduleSchema = z.enum(['daily', 'weekly', 'custom']);
export type HabitScheduleType = z.infer<typeof HabitScheduleSchema>;

const ReminderSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'reminderTime must be HH:MM')
  .optional()
  .nullable();

export const HabitSchema = z.object({
  id: z.string().cuid(),
  title: z.string().min(1).max(120),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  active: z.boolean(),
  scheduleType: HabitScheduleSchema,
  weekdays: z.array(z.number().int().min(1).max(7)).default([]),
  weeklyTarget: z.number().int().min(1).max(7).nullable(),
  targetCount: z.number().int().min(1).max(99),
  reminderTime: ReminderSchema,
  createdAt: z.coerce.date(),
});
export type Habit = z.infer<typeof HabitSchema>;

// Отметка дня: дата + счётчик
export const HabitEntrySchema = z.object({
  date: z.coerce.date(),
  count: z.number().int().min(1),
});
export type HabitEntry = z.infer<typeof HabitEntrySchema>;

export const HabitWithEntriesSchema = HabitSchema.extend({
  entries: z.array(HabitEntrySchema),
});
export type HabitWithEntries = z.infer<typeof HabitWithEntriesSchema>;

export const CreateHabitSchema = z.object({
  title: z.string().min(1).max(120),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  scheduleType: HabitScheduleSchema.optional(),
  weekdays: z.array(z.number().int().min(1).max(7)).optional(),
  weeklyTarget: z.number().int().min(1).max(7).optional().nullable(),
  targetCount: z.number().int().min(1).max(99).optional(),
  reminderTime: ReminderSchema,
});
export type CreateHabitDto = z.input<typeof CreateHabitSchema>;

export const UpdateHabitSchema = CreateHabitSchema.partial().extend({
  active: z.boolean().optional(),
});
export type UpdateHabitDto = z.infer<typeof UpdateHabitSchema>;

export const HabitRangeQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});
export type HabitRangeQuery = z.infer<typeof HabitRangeQuerySchema>;

// Установить счётчик за день: count<=0 удаляет отметку
export const SetHabitSchema = z.object({
  date: z.coerce.date(),
  count: z.number().int().min(0).max(99),
});
export type SetHabitDto = z.infer<typeof SetHabitSchema>;

// Бинарное переключение (для targetCount=1)
export const ToggleHabitSchema = z.object({
  date: z.coerce.date(),
});
export type ToggleHabitDto = z.infer<typeof ToggleHabitSchema>;
