import { PrismaClient } from '@prisma/client';
import {
  CreateNoteDto,
  UpdateNoteDto,
  NoteWithAttachments,
  NoteWithAttachmentsSchema,
} from '@life-app/shared';
import { currentUserId } from '../../lib/context';

// tags хранится в SQLite как JSON-строка; конвертируем в массив для API.
function shape(raw: Record<string, unknown>): Record<string, unknown> {
  const tags = raw.tags;
  return { ...raw, tags: typeof tags === 'string' && tags.length > 0 ? (JSON.parse(tags) as string[]) : [] };
}
function tagsToDb(tags: string[] | undefined): string | null | undefined {
  if (tags === undefined) return undefined;
  return tags.length > 0 ? JSON.stringify(tags) : null;
}

export class NoteService {
  constructor(private readonly db: PrismaClient) {}

  async list(filter?: { taskId?: string; timeBlockId?: string }): Promise<NoteWithAttachments[]> {
    const rows = await this.db.note.findMany({
      where: {
        userId: currentUserId(),
        ...(filter?.taskId ? { taskId: filter.taskId } : {}),
        ...(filter?.timeBlockId ? { timeBlockId: filter.timeBlockId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: { attachments: { orderBy: { createdAt: 'asc' } } },
    });
    return rows.map((r) => NoteWithAttachmentsSchema.parse(shape(r as Record<string, unknown>)));
  }

  async getById(id: string): Promise<NoteWithAttachments | null> {
    const row = await this.db.note.findFirst({
      where: { id, userId: currentUserId() },
      include: { attachments: true },
    });
    return row ? NoteWithAttachmentsSchema.parse(shape(row as Record<string, unknown>)) : null;
  }

  async create(dto: CreateNoteDto): Promise<NoteWithAttachments> {
    const { tags, ...rest } = dto;
    const row = await this.db.note.create({
      data: { ...rest, userId: currentUserId(), tags: tagsToDb(tags) },
      include: { attachments: true },
    });
    return NoteWithAttachmentsSchema.parse(shape(row as Record<string, unknown>));
  }

  async update(id: string, dto: UpdateNoteDto): Promise<NoteWithAttachments | null> {
    const ex = await this.db.note.findFirst({ where: { id, userId: currentUserId() } });
    if (!ex) return null;
    const { tags, ...rest } = dto;
    const data: Record<string, unknown> = { ...rest };
    if (tags !== undefined) data.tags = tagsToDb(tags);
    const row = await this.db.note.update({ where: { id }, data, include: { attachments: true } });
    return NoteWithAttachmentsSchema.parse(shape(row as Record<string, unknown>));
  }

  async delete(id: string): Promise<{ stored: string[] } | null> {
    const ex = await this.db.note.findFirst({
      where: { id, userId: currentUserId() },
      include: { attachments: true },
    });
    if (!ex) return null;
    const stored = ex.attachments.map((a) => a.storedAs);
    await this.db.note.delete({ where: { id } });
    return { stored };
  }

  async addAttachment(
    noteId: string,
    data: { filename: string; storedAs: string; mimeType: string; size: number },
  ) {
    const note = await this.db.note.findFirst({ where: { id: noteId, userId: currentUserId() } });
    if (!note) return null;
    await this.db.attachment.create({ data: { noteId, ...data } });
    return this.getById(noteId);
  }

  async deleteAttachment(id: string): Promise<{ storedAs: string } | null> {
    const a = await this.db.attachment.findFirst({
      where: { id, note: { userId: currentUserId() } },
    });
    if (!a) return null;
    await this.db.attachment.delete({ where: { id } });
    return { storedAs: a.storedAs };
  }
}
