import { PrismaClient } from '@prisma/client';
import {
  Reflection,
  ReflectionSchema,
  UpsertReflectionDto,
  ReflectionRangeQuery,
} from '@life-app/shared';
import { currentUserId } from '../../lib/context';

// Приводим дату к полуночи (день — ключ рефлексии)
function dayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function serialize(raw: Record<string, unknown>): Reflection {
  return ReflectionSchema.parse(raw);
}

export class ReflectionService {
  constructor(private readonly db: PrismaClient) {}

  async listRange(q: ReflectionRangeQuery): Promise<Reflection[]> {
    const rows = await this.db.reflection.findMany({
      where: { userId: currentUserId(), date: { gte: dayStart(q.from), lt: q.to } },
      orderBy: { date: 'desc' },
    });
    return rows.map((r) => serialize(r as Record<string, unknown>));
  }

  async upsert(dto: UpsertReflectionDto): Promise<Reflection> {
    const userId = currentUserId();
    const date = dayStart(dto.date);
    const row = await this.db.reflection.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, text: dto.text },
      update: { text: dto.text },
    });
    return serialize(row as Record<string, unknown>);
  }
}
