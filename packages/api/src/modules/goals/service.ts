import { PrismaClient } from '@prisma/client';
import { CreateGoalDto, UpdateGoalDto, Goal, GoalSchema } from '@life-app/shared';
import { currentUserId } from '../../lib/context';

function serialize(raw: Record<string, unknown>): Goal {
  return GoalSchema.parse(raw);
}

export class GoalService {
  constructor(private readonly db: PrismaClient) {}

  async list(): Promise<Goal[]> {
    const goals = await this.db.goal.findMany({
      where: { userId: currentUserId() },
      orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
    });
    return goals.map((g) => serialize(g as Record<string, unknown>));
  }

  async create(dto: CreateGoalDto): Promise<Goal> {
    const row = await this.db.goal.create({ data: { ...dto, userId: currentUserId() } });
    return serialize(row as Record<string, unknown>);
  }

  async update(id: string, dto: UpdateGoalDto): Promise<Goal | null> {
    const ex = await this.db.goal.findFirst({ where: { id, userId: currentUserId() } });
    if (!ex) return null;
    const row = await this.db.goal.update({ where: { id }, data: dto });
    return serialize(row as Record<string, unknown>);
  }

  async delete(id: string): Promise<boolean> {
    const ex = await this.db.goal.findFirst({ where: { id, userId: currentUserId() } });
    if (!ex) return false;
    await this.db.goal.delete({ where: { id } });
    return true;
  }
}
