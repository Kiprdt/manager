import { PrismaClient } from '@prisma/client';
import {
  CreateTaskDto,
  UpdateTaskDto,
  TaskListQuery,
  Task,
  TaskSchema,
  TaskWithSubtasks,
  TaskWithSubtasksSchema,
} from '@life-app/shared';
import { rrulestr } from 'rrule';
import { hub } from '../../ws/hub';
import { currentUserId } from '../../lib/context';

function rruleUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

// Следующая дата повторения после given по RRULE
function nextOccurrence(rule: string, after: Date): Date | null {
  try {
    const set = rrulestr(`DTSTART:${rruleUtc(after)}\nRRULE:${rule}`);
    return set.after(after, false);
  } catch {
    return null;
  }
}

// tags хранится в SQLite как JSON-строка; конвертируем в массив для API.
function toApiShape(raw: Record<string, unknown>): Record<string, unknown> {
  const tags = raw.tags;
  const shaped: Record<string, unknown> = {
    ...raw,
    tags: typeof tags === 'string' && tags.length > 0 ? (JSON.parse(tags) as string[]) : [],
  };
  if (Array.isArray(raw.subtasks)) {
    shaped.subtasks = (raw.subtasks as Record<string, unknown>[]).map(toApiShape);
  }
  return shaped;
}

function serialize(raw: Record<string, unknown>): Task {
  return TaskSchema.parse(toApiShape(raw));
}

function serializeWithSubtasks(raw: Record<string, unknown>): TaskWithSubtasks {
  return TaskWithSubtasksSchema.parse(toApiShape(raw));
}

function tagsToDb(tags: string[] | undefined): string | null | undefined {
  if (tags === undefined) return undefined;
  return tags.length > 0 ? JSON.stringify(tags) : null;
}

export class TaskService {
  constructor(private readonly db: PrismaClient) {}

  async list(query: TaskListQuery): Promise<Task[]> {
    const rows = await this.db.task.findMany({
      where: {
        userId: currentUserId(),
        ...(query.status ? { status: query.status } : {}),
        ...(query.parentId ? { parentId: query.parentId } : {}),
        ...(query.rootOnly ? { parentId: null } : {}),
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: query.limit,
      skip: query.offset,
    });
    return rows.map((r) => serialize(r as Record<string, unknown>));
  }

  async getById(id: string): Promise<TaskWithSubtasks | null> {
    const row = await this.db.task.findFirst({
      where: { id, userId: currentUserId() },
      include: { subtasks: { orderBy: { createdAt: 'asc' } } },
    });
    return row ? serializeWithSubtasks(row as Record<string, unknown>) : null;
  }

  async create(dto: CreateTaskDto): Promise<Task> {
    const { eventId, tags, ...rest } = dto;
    const row = await this.db.task.create({
      data: {
        ...rest,
        userId: currentUserId(),
        tags: tagsToDb(tags),
        ...(eventId ? { events: { connect: { id: eventId } } } : {}),
      },
    });
    const task = serialize(row as Record<string, unknown>);
    hub.broadcast({ type: 'task.created', payload: task });
    return task;
  }

  async update(id: string, dto: UpdateTaskDto): Promise<Task | null> {
    const existing = await this.db.task.findFirst({ where: { id, userId: currentUserId() } });
    if (!existing) return null;

    const { tags, ...rest } = dto;
    const data: Record<string, unknown> = { ...rest };
    if (tags !== undefined) data.tags = tagsToDb(tags);
    // Автоматически ставим completedAt при переводе в DONE
    if (dto.status === 'DONE' && existing.status !== 'DONE') {
      data.completedAt = new Date();
    } else if (dto.status && dto.status !== 'DONE') {
      data.completedAt = null;
    }

    const row = await this.db.task.update({ where: { id }, data });
    const task = serialize(row as Record<string, unknown>);
    hub.broadcast({ type: 'task.updated', payload: task });

    // Повторяющаяся задача завершена → создаём следующее повторение
    if (
      dto.status === 'DONE' &&
      existing.status !== 'DONE' &&
      existing.recurrenceRule &&
      existing.dueAt
    ) {
      const next = nextOccurrence(existing.recurrenceRule, existing.dueAt);
      if (next) {
        const clone = await this.db.task.create({
          data: {
            userId: existing.userId,
            title: existing.title,
            description: existing.description,
            notes: existing.notes,
            priority: existing.priority,
            importance: existing.importance,
            urgent: existing.urgent,
            scope: existing.scope,
            source: existing.source,
            estimatedMinutes: existing.estimatedMinutes,
            dueAt: next,
            dueAllDay: existing.dueAllDay,
            recurrenceRule: existing.recurrenceRule,
            tags: existing.tags,
            categoryId: existing.categoryId,
          },
        });
        hub.broadcast({ type: 'task.created', payload: serialize(clone as Record<string, unknown>) });
      }
    }
    return task;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.db.task.findFirst({ where: { id, userId: currentUserId() } });
    if (!existing) return false;
    await this.db.task.delete({ where: { id } });
    hub.broadcast({ type: 'task.deleted', payload: { id } });
    return true;
  }
}
