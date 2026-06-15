import { z } from 'zod';
import { TaskSchema } from './task';
import { TimeBlockSchema } from './timeblock';

// Дискриминированный union — тип события определяется полем `type`
export const WsEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('task.created'), payload: TaskSchema }),
  z.object({ type: z.literal('task.updated'), payload: TaskSchema }),
  z.object({ type: z.literal('task.deleted'), payload: z.object({ id: z.string() }) }),
  z.object({ type: z.literal('timeblock.created'), payload: TimeBlockSchema }),
  z.object({ type: z.literal('timeblock.updated'), payload: TimeBlockSchema }),
  z.object({ type: z.literal('timeblock.deleted'), payload: z.object({ id: z.string() }) }),
]);
export type WsEvent = z.infer<typeof WsEventSchema>;
export type WsEventType = WsEvent['type'];
