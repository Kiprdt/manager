import { z } from 'zod';

export const AttachmentSchema = z.object({
  id: z.string().cuid(),
  noteId: z.string(),
  filename: z.string(),
  storedAs: z.string(),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  createdAt: z.coerce.date(),
});
export type Attachment = z.infer<typeof AttachmentSchema>;

export const NoteSchema = z.object({
  id: z.string().cuid(),
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()).default([]),
  date: z.coerce.date().nullable(),
  taskId: z.string().nullable(),
  timeBlockId: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Note = z.infer<typeof NoteSchema>;

export const NoteWithAttachmentsSchema = NoteSchema.extend({
  attachments: z.array(AttachmentSchema),
});
export type NoteWithAttachments = z.infer<typeof NoteWithAttachmentsSchema>;

export const CreateNoteSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
  date: z.coerce.date().optional().nullable(),
  taskId: z.string().optional().nullable(),
  timeBlockId: z.string().optional().nullable(),
});
export type CreateNoteDto = z.infer<typeof CreateNoteSchema>;

export const UpdateNoteSchema = CreateNoteSchema.partial();
export type UpdateNoteDto = z.infer<typeof UpdateNoteSchema>;

export const NoteQuerySchema = z.object({
  taskId: z.string().optional(),
  timeBlockId: z.string().optional(),
});
export type NoteQuery = z.infer<typeof NoteQuerySchema>;
