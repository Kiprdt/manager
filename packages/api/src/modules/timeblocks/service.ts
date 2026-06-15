import { PrismaClient, Prisma } from '@prisma/client';
import {
  CreateTimeBlockDto,
  UpdateTimeBlockDto,
  TimeBlockRangeQuery,
  TimeBlock,
  TimeBlockSchema,
  TimeBlockWithTasks,
  TimeBlockWithTasksSchema,
} from '@life-app/shared';
import { hub } from '../../ws/hub';
import { currentUserId } from '../../lib/context';

function parseJsonArray(v: unknown): string[] {
  return typeof v === 'string' && v.length > 0 ? (JSON.parse(v) as string[]) : [];
}

const WORKOUT_TAG = 'тренировка';

// attendees/tags хранятся в SQLite как JSON-строки; конвертируем в массивы для API.
function toApiShape(raw: Record<string, unknown>): Record<string, unknown> {
  const shaped: Record<string, unknown> = {
    ...raw,
    attendees: parseJsonArray(raw.attendees),
    tags: parseJsonArray(raw.tags),
  };
  // Вложенные привязанные задачи тоже хранят tags строкой
  if (Array.isArray(raw.tasks)) {
    shaped.tasks = (raw.tasks as Record<string, unknown>[]).map((t) => ({
      ...t,
      tags: parseJsonArray(t.tags),
    }));
  }
  return shaped;
}

function serialize(raw: Record<string, unknown>): TimeBlock {
  return TimeBlockSchema.parse(toApiShape(raw));
}

function serializeWithTasks(raw: Record<string, unknown>): TimeBlockWithTasks {
  return TimeBlockWithTasksSchema.parse(toApiShape(raw));
}

export class TimeBlockService {
  constructor(private readonly db: PrismaClient) {}

  async list(query: TimeBlockRangeQuery): Promise<TimeBlock[]> {
    const rows = await this.db.timeBlock.findMany({
      where: {
        userId: currentUserId(),
        ...(query.taskId ? { taskId: query.taskId } : {}),
        OR: [
          // Блоки, которые пересекаются с запрошенным диапазоном
          { startAt: { gte: query.from, lte: query.to } },
          { endAt: { gte: query.from, lte: query.to } },
          { startAt: { lte: query.from }, endAt: { gte: query.to } },
          // Повторяющиеся блоки, начавшиеся до диапазона — проецируются вперёд
          { recurrenceRule: { not: null }, startAt: { lte: query.to } },
        ],
      },
      orderBy: { startAt: 'asc' },
    });
    return rows.map((r) => serialize(r as Record<string, unknown>));
  }

  async getById(id: string): Promise<TimeBlockWithTasks | null> {
    const row = await this.db.timeBlock.findFirst({
      where: { id, userId: currentUserId() },
      include: { tasks: { orderBy: { createdAt: 'asc' } } },
    });
    return row ? serializeWithTasks(row as Record<string, unknown>) : null;
  }

  async create(dto: CreateTimeBlockDto): Promise<TimeBlock> {
    const { attendees, tags, taskIds, ...rest } = dto;
    const data: Prisma.TimeBlockCreateInput = {
      ...rest,
      userId: currentUserId(),
      attendees: attendees && attendees.length > 0 ? JSON.stringify(attendees) : null,
      tags: tags && tags.length > 0 ? JSON.stringify(tags) : null,
      ...(taskIds && taskIds.length > 0
        ? { tasks: { connect: taskIds.map((id) => ({ id })) } }
        : {}),
    };
    const row = await this.db.timeBlock.create({ data });
    const block = serialize(row as Record<string, unknown>);
    hub.broadcast({ type: 'timeblock.created', payload: block });
    // TimeBlock → Workout, если есть тег «тренировка»
    if ((tags ?? []).includes(WORKOUT_TAG)) await this.ensureWorkoutForBlock(block);
    return block;
  }

  async update(id: string, dto: UpdateTimeBlockDto): Promise<TimeBlock | null> {
    const existing = await this.db.timeBlock.findFirst({ where: { id, userId: currentUserId() } });
    if (!existing) return null;
    const wasWorkout = parseJsonArray((existing as Record<string, unknown>).tags).includes(WORKOUT_TAG);

    const { attendees, tags, taskIds, ...rest } = dto;
    const data: Prisma.TimeBlockUpdateInput = {
      ...rest,
      ...(attendees !== undefined
        ? { attendees: attendees.length > 0 ? JSON.stringify(attendees) : null }
        : {}),
      ...(tags !== undefined ? { tags: tags.length > 0 ? JSON.stringify(tags) : null } : {}),
      ...(taskIds !== undefined
        ? { tasks: { set: taskIds.map((tid) => ({ id: tid })) } }
        : {}),
    };

    const row = await this.db.timeBlock.update({ where: { id }, data });
    const block = serialize(row as Record<string, unknown>);
    hub.broadcast({ type: 'timeblock.updated', payload: block });

    if (tags !== undefined) {
      const nowWorkout = tags.includes(WORKOUT_TAG);
      if (nowWorkout && !wasWorkout) await this.ensureWorkoutForBlock(block);
      if (!nowWorkout && wasWorkout)
        await this.db.workout.deleteMany({ where: { timeBlockId: id } });
    }
    return block;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.db.timeBlock.findFirst({ where: { id, userId: currentUserId() } });
    if (!existing) return false;
    // Удаляем связанную тренировку (если блок был тренировкой)
    await this.db.workout.deleteMany({ where: { timeBlockId: id } });
    await this.db.timeBlock.delete({ where: { id } });
    hub.broadcast({ type: 'timeblock.deleted', payload: { id } });
    return true;
  }

  // Создаёт Workout для блока-«тренировки», если ещё нет (прямой prisma, без обратного создания блока)
  private async ensureWorkoutForBlock(block: TimeBlock): Promise<void> {
    const existing = await this.db.workout.findUnique({ where: { timeBlockId: block.id } });
    if (existing) return;
    const durationMin = Math.max(
      1,
      Math.round((new Date(block.endAt).valueOf() - new Date(block.startAt).valueOf()) / 60_000),
    );
    await this.db.workout.create({
      data: {
        userId: currentUserId(),
        date: block.startAt,
        type: block.title.replace(/^[^\p{L}\d]+/u, '').trim() || 'Тренировка',
        kind: 'strength',
        durationMin: block.isAllDay ? null : durationMin,
        timeBlockId: block.id,
      },
    });
  }
}
