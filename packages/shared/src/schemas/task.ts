import { z } from 'zod';

export const TaskStatusSchema = z.enum(['TODO', 'IN_PROGRESS', 'DONE']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

// Bullet Journal: к какому логу относится задача
export const TaskScopeSchema = z.enum(['day', 'week', 'month']);
export type TaskScope = z.infer<typeof TaskScopeSchema>;

// RRULE строка по RFC 5545, например: "FREQ=WEEKLY;BYDAY=MO,WE,FR"
const RRuleStringSchema = z
  .string()
  .regex(/^FREQ=/, 'recurrenceRule must be a valid RRULE string starting with FREQ=')
  .optional()
  .nullable();

export const TaskSchema = z.object({
  id: z.string().cuid(),
  title: z.string().min(1).max(255),
  description: z.string().nullable(),
  notes: z.string().nullable(),
  status: TaskStatusSchema,
  priority: z.number().int().min(0).max(10),
  // Матрица Эйзенхауэра: важность (0..3) и срочность (ручная отметка)
  importance: z.number().int().min(0).max(3),
  urgent: z.boolean(),
  scope: TaskScopeSchema,
  source: z.enum(['app', 'telegram']),
  estimatedMinutes: z.number().int().positive().nullable(),
  actualMinutes: z.number().int().nonnegative().nullable(),
  dueAt: z.coerce.date().nullable(),
  dueAllDay: z.boolean(),
  recurrenceRule: RRuleStringSchema,
  tags: z.array(z.string()).default([]),
  categoryId: z.string().nullable(),
  goalId: z.string().nullable(),
  parentId: z.string().nullable(),
  createdAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
});
export type Task = z.infer<typeof TaskSchema>;

// Задача с разворотом подзадач (для карточек/детального вида)
export const TaskWithSubtasksSchema = TaskSchema.extend({
  subtasks: z.array(TaskSchema),
});
export type TaskWithSubtasks = z.infer<typeof TaskWithSubtasksSchema>;

export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  notes: z.string().optional().nullable(),
  priority: z.number().int().min(0).max(10).default(0),
  importance: z.number().int().min(0).max(3).optional(),
  urgent: z.boolean().optional(),
  scope: TaskScopeSchema.optional(),
  source: z.enum(['app', 'telegram']).optional(),
  estimatedMinutes: z.number().int().positive().optional().nullable(),
  actualMinutes: z.number().int().nonnegative().optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
  dueAllDay: z.boolean().optional(),
  recurrenceRule: RRuleStringSchema,
  tags: z.array(z.string()).optional(),
  categoryId: z.string().optional().nullable(),
  goalId: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  // При создании задачи можно сразу привязать её к мероприятию
  eventId: z.string().optional().nullable(),
});
export type CreateTaskDto = z.input<typeof CreateTaskSchema>;

export const UpdateTaskSchema = CreateTaskSchema.partial().omit({ eventId: true }).extend({
  status: TaskStatusSchema.optional(),
  completedAt: z.coerce.date().nullable().optional(),
});
export type UpdateTaskDto = z.infer<typeof UpdateTaskSchema>;

export const TaskListQuerySchema = z.object({
  status: TaskStatusSchema.optional(),
  parentId: z.string().optional(),
  rootOnly: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type TaskListQuery = z.input<typeof TaskListQuerySchema>;
