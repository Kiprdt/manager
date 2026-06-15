import { PrismaClient, Prisma } from '@prisma/client';
import {
  CreateHabitDto,
  UpdateHabitDto,
  HabitRangeQuery,
  Habit,
  HabitSchema,
  HabitWithEntries,
  HabitWithEntriesSchema,
} from '@life-app/shared';
import { currentUserId } from '../../lib/context';

function toApiShape(raw: Record<string, unknown>): Record<string, unknown> {
  const weekdays = raw.weekdays;
  return {
    ...raw,
    weekdays:
      typeof weekdays === 'string' && weekdays.length > 0 ? (JSON.parse(weekdays) as number[]) : [],
  };
}

function serialize(raw: Record<string, unknown>): Habit {
  return HabitSchema.parse(toApiShape(raw));
}

function buildData(dto: CreateHabitDto | UpdateHabitDto): Prisma.HabitUncheckedUpdateInput {
  const { weekdays, ...rest } = dto as Record<string, unknown> & { weekdays?: number[] };
  const data: Record<string, unknown> = { ...rest };
  if (weekdays !== undefined) data.weekdays = weekdays.length > 0 ? JSON.stringify(weekdays) : null;
  return data as Prisma.HabitUncheckedUpdateInput;
}

export class HabitService {
  constructor(private readonly db: PrismaClient) {}

  async list(query: HabitRangeQuery): Promise<HabitWithEntries[]> {
    const rows = await this.db.habit.findMany({
      where: { userId: currentUserId() },
      orderBy: { createdAt: 'asc' },
      include: {
        entries: {
          where: { date: { gte: query.from, lte: query.to } },
          select: { date: true, count: true },
        },
      },
    });
    return rows.map((r) =>
      HabitWithEntriesSchema.parse({
        ...toApiShape(r as Record<string, unknown>),
        entries: r.entries.map((e) => ({ date: e.date, count: e.count })),
      }),
    );
  }

  async create(dto: CreateHabitDto): Promise<Habit> {
    const row = await this.db.habit.create({
      data: { ...(buildData(dto) as Prisma.HabitUncheckedCreateInput), userId: currentUserId() },
    });
    return serialize(row as Record<string, unknown>);
  }

  async update(id: string, dto: UpdateHabitDto): Promise<Habit | null> {
    const existing = await this.db.habit.findFirst({ where: { id, userId: currentUserId() } });
    if (!existing) return null;
    const row = await this.db.habit.update({ where: { id }, data: buildData(dto) });
    return serialize(row as Record<string, unknown>);
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.db.habit.findFirst({ where: { id, userId: currentUserId() } });
    if (!existing) return false;
    await this.db.habit.delete({ where: { id } });
    return true;
  }

  private utcDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  async toggle(id: string, date: Date): Promise<{ date: Date; count: number } | null> {
    const habit = await this.db.habit.findFirst({ where: { id, userId: currentUserId() } });
    if (!habit) return null;
    const day = this.utcDay(date);
    const existing = await this.db.habitEntry.findUnique({
      where: { habitId_date: { habitId: id, date: day } },
    });
    if (existing) {
      await this.db.habitEntry.delete({ where: { id: existing.id } });
      return { date: day, count: 0 };
    }
    await this.db.habitEntry.create({ data: { habitId: id, date: day, count: habit.targetCount } });
    return { date: day, count: habit.targetCount };
  }

  // Установить счётчик за день; count<=0 удаляет отметку
  async setCount(id: string, date: Date, count: number): Promise<{ date: Date; count: number } | null> {
    const habit = await this.db.habit.findFirst({ where: { id, userId: currentUserId() } });
    if (!habit) return null;
    const day = this.utcDay(date);
    const existing = await this.db.habitEntry.findUnique({
      where: { habitId_date: { habitId: id, date: day } },
    });
    if (count <= 0) {
      if (existing) await this.db.habitEntry.delete({ where: { id: existing.id } });
      return { date: day, count: 0 };
    }
    if (existing) {
      await this.db.habitEntry.update({ where: { id: existing.id }, data: { count } });
    } else {
      await this.db.habitEntry.create({ data: { habitId: id, date: day, count } });
    }
    return { date: day, count };
  }
}
