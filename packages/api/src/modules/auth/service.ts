import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { RegisterDto, LoginDto, AuthUser } from '@life-app/shared';

// Таблицы, чьи «сиротские» строки (userId = null) забирает первый аккаунт
const OWNED_MODELS = [
  'task',
  'timeBlock',
  'habit',
  'goal',
  'category',
  'note',
  'financeTx',
  'financeInstrument',
  'weightEntry',
  'workout',
  'meal',
  'supplement',
  'reflection',
  'setting',
  'telegramChat',
] as const;

function toAuthUser(u: { id: string; email: string; name: string | null }): AuthUser {
  return { id: u.id, email: u.email, name: u.name };
}

export class AuthService {
  constructor(private readonly db: PrismaClient) {}

  async register(dto: RegisterDto): Promise<AuthUser> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.db.user.findUnique({ where: { email } });
    if (existing) {
      const e = new Error('Пользователь с таким email уже существует') as Error & { statusCode?: number };
      e.statusCode = 409;
      throw e;
    }
    const firstUser = (await this.db.user.count()) === 0;
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.db.user.create({
      data: { email, passwordHash, name: dto.name ?? null },
    });
    // Первый аккаунт забирает все существующие данные (миграция «как было»)
    if (firstUser) await this.claimOrphans(user.id);
    return toAuthUser(user);
  }

  async login(dto: LoginDto): Promise<AuthUser> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.db.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      const e = new Error('Неверный email или пароль') as Error & { statusCode?: number };
      e.statusCode = 401;
      throw e;
    }
    return toAuthUser(user);
  }

  async getById(id: string): Promise<AuthUser | null> {
    const u = await this.db.user.findUnique({ where: { id } });
    return u ? toAuthUser(u) : null;
  }

  // Присвоить все строки без владельца новому пользователю
  private async claimOrphans(userId: string): Promise<void> {
    const db = this.db as unknown as Record<string, { updateMany: (a: unknown) => Promise<unknown> }>;
    for (const model of OWNED_MODELS) {
      await db[model].updateMany({ where: { userId: null }, data: { userId } });
    }
  }
}
