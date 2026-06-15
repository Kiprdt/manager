import { z } from 'zod';
import { TaskSchema } from './task';

// RRULE строка по RFC 5545, например: "FREQ=WEEKLY;BYDAY=MO,WE,FR"
const RRuleStringSchema = z
  .string()
  .regex(/^FREQ=/, 'recurrenceRule must be a valid RRULE string starting with FREQ=')
  .optional()
  .nullable();

const EmailListSchema = z.array(z.string().email()).default([]);

export const TimeBlockSchema = z.object({
  id: z.string().cuid(),
  title: z.string().min(1).max(255),
  taskId: z.string().nullable(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  isAllDay: z.boolean(),
  recurrenceRule: RRuleStringSchema,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  location: z.string().nullable(),
  notes: z.string().nullable(),
  attendees: EmailListSchema,
  categoryId: z.string().nullable(),
  tags: z.array(z.string()).default([]),
  createdAt: z.coerce.date(),
});
export type TimeBlock = z.infer<typeof TimeBlockSchema>;

// Мероприятие с развёрнутыми привязанными задачами (детальная карточка)
export const TimeBlockWithTasksSchema = TimeBlockSchema.extend({
  tasks: z.array(TaskSchema),
});
export type TimeBlockWithTasks = z.infer<typeof TimeBlockWithTasksSchema>;

export const CreateTimeBlockSchema = z
  .object({
    title: z.string().min(1).max(255),
    taskId: z.string().optional().nullable(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    isAllDay: z.boolean().default(false),
    recurrenceRule: RRuleStringSchema,
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
    location: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    attendees: EmailListSchema.optional(),
    categoryId: z.string().optional().nullable(),
    tags: z.array(z.string()).optional(),
    // Привязка существующих задач при создании
    taskIds: z.array(z.string()).optional(),
  })
  .refine((d) => d.endAt > d.startAt, {
    message: 'endAt must be after startAt',
    path: ['endAt'],
  });
export type CreateTimeBlockDto = z.input<typeof CreateTimeBlockSchema>;

export const UpdateTimeBlockSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    taskId: z.string().nullable().optional(),
    startAt: z.coerce.date().optional(),
    endAt: z.coerce.date().optional(),
    isAllDay: z.boolean().optional(),
    recurrenceRule: RRuleStringSchema,
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
    location: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    attendees: EmailListSchema.optional(),
    categoryId: z.string().optional().nullable(),
    tags: z.array(z.string()).optional(),
    // Полная замена набора привязанных задач
    taskIds: z.array(z.string()).optional(),
  })
  .refine(
    (d) => {
      if (d.startAt && d.endAt) return d.endAt > d.startAt;
      return true;
    },
    { message: 'endAt must be after startAt', path: ['endAt'] },
  );
export type UpdateTimeBlockDto = z.infer<typeof UpdateTimeBlockSchema>;

export const TimeBlockRangeQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  taskId: z.string().optional(),
});
export type TimeBlockRangeQuery = z.infer<typeof TimeBlockRangeQuerySchema>;
