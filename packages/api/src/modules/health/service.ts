import { PrismaClient, Prisma } from '@prisma/client';
import {
  HealthRangeQuery,
  CreateWeightDto,
  CreateWorkoutDto,
  UpdateWorkoutDto,
  CreateMealDto,
  UpdateMealDto,
  CreateSupplementDto,
  UpdateSupplementDto,
  UpdateHealthSettingsDto,
  WeightEntrySchema,
  WorkoutSchema,
  Workout,
  MealSchema,
  SupplementSchema,
  SupplementWithEntriesSchema,
  HealthSettingsSchema,
  HealthSettings,
  TimeBlockSchema,
  TimeBlock,
  NutritionRecommendation,
  WeightSeriesPoint,
  WorkoutProgressPoint,
  recommendedKbju,
  treadmillMet,
  caloriesBurned,
  ageFromBirthYear,
  Sex,
  ActivityLevel,
  NutritionGoal,
} from '@life-app/shared';
import { hub } from '../../ws/hub';
import { currentUserId } from '../../lib/context';

function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

const WORKOUT_TAG = 'тренировка';

// Сериализация блока в форму API (attendees/tags JSON → массив) для broadcast.
function serializeBlock(raw: Record<string, unknown>): TimeBlock {
  const parse = (v: unknown) =>
    typeof v === 'string' && v.length > 0 ? (JSON.parse(v) as string[]) : [];
  return TimeBlockSchema.parse({ ...raw, attendees: parse(raw.attendees), tags: parse(raw.tags) });
}

function serializeWorkout(raw: Record<string, unknown>): Workout {
  return WorkoutSchema.parse(raw);
}

export class HealthService {
  constructor(private readonly db: PrismaClient) {}

  // ── Вес ──
  async listWeight(q: HealthRangeQuery) {
    const rows = await this.db.weightEntry.findMany({
      where: { userId: currentUserId(), date: { gte: q.from, lte: q.to } },
      orderBy: { date: 'asc' },
    });
    return rows.map((r) => WeightEntrySchema.parse(r));
  }
  async upsertWeight(dto: CreateWeightDto) {
    const userId = currentUserId();
    const date = utcDay(dto.date);
    const row = await this.db.weightEntry.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, weightKg: dto.weightKg },
      update: { weightKg: dto.weightKg },
    });
    return WeightEntrySchema.parse(row);
  }
  async deleteWeight(id: string) {
    const r = await this.db.weightEntry.deleteMany({ where: { id, userId: currentUserId() } });
    return r.count > 0;
  }

  // ── Тренировки ──
  async listWorkouts(q: HealthRangeQuery) {
    const rows = await this.db.workout.findMany({
      where: { userId: currentUserId(), date: { gte: q.from, lte: q.to } },
      orderBy: { date: 'desc' },
      include: { exercises: { orderBy: { order: 'asc' } } },
    });
    return rows.map((r) => serializeWorkout(r as unknown as Record<string, unknown>));
  }

  // Расчёт сожжённых калорий для кардио по последнему весу
  private async cardioCalories(dto: { speedKmh?: number | null; inclinePct?: number | null; durationMin?: number | null }) {
    if (!dto.speedKmh || !dto.durationMin) return null;
    const lastWeight = await this.db.weightEntry.findFirst({
      where: { userId: currentUserId() },
      orderBy: { date: 'desc' },
    });
    const weightKg = lastWeight?.weightKg ?? 75;
    const met = treadmillMet(dto.speedKmh, dto.inclinePct ?? 0);
    return caloriesBurned(met, weightKg, dto.durationMin);
  }

  async createWorkout(dto: CreateWorkoutDto): Promise<Workout> {
    const { exercises, ...rest } = dto;
    const kind = rest.kind ?? 'strength';
    const burned = kind === 'cardio' ? await this.cardioCalories(rest) : null;

    const created = await this.db.workout.create({
      data: {
        userId: currentUserId(),
        date: rest.date,
        type: rest.type,
        categoryId: rest.categoryId ?? null,
        kind,
        durationMin: rest.durationMin ?? null,
        inclinePct: rest.inclinePct ?? null,
        speedKmh: rest.speedKmh ?? null,
        caloriesBurned: burned,
        notes: rest.notes ?? null,
        ...(exercises && exercises.length
          ? { exercises: { create: exercises.map((e, i) => ({ ...e, order: e.order ?? i })) } }
          : {}),
      },
    });

    // Workout → TimeBlock (двусторонняя связь): создаём блок напрямую, минуя TimeBlockService.
    const start = new Date(rest.date);
    const dur = rest.durationMin ?? 60;
    const end = new Date(start.valueOf() + dur * 60_000);
    const block = await this.db.timeBlock.create({
      data: {
        userId: currentUserId(),
        title: `🏋️ ${rest.type}`,
        startAt: start,
        endAt: end,
        isAllDay: !rest.durationMin,
        color: '#34c759',
        tags: JSON.stringify([WORKOUT_TAG]),
      },
    });
    await this.db.workout.update({ where: { id: created.id }, data: { timeBlockId: block.id } });
    hub.broadcast({ type: 'timeblock.created', payload: serializeBlock(block as unknown as Record<string, unknown>) });

    return (await this.getWorkout(created.id))!;
  }

  private async getWorkout(id: string): Promise<Workout | null> {
    const row = await this.db.workout.findFirst({
      where: { id, userId: currentUserId() },
      include: { exercises: { orderBy: { order: 'asc' } } },
    });
    return row ? serializeWorkout(row as unknown as Record<string, unknown>) : null;
  }

  async updateWorkout(id: string, dto: UpdateWorkoutDto): Promise<Workout | null> {
    const ex = await this.db.workout.findFirst({ where: { id, userId: currentUserId() } });
    if (!ex) return null;
    const { exercises, ...rest } = dto;
    const kind = rest.kind ?? (ex.kind as 'strength' | 'cardio');
    const burned =
      kind === 'cardio'
        ? await this.cardioCalories({
            speedKmh: rest.speedKmh ?? ex.speedKmh,
            inclinePct: rest.inclinePct ?? ex.inclinePct,
            durationMin: rest.durationMin ?? ex.durationMin,
          })
        : null;

    await this.db.workout.update({
      where: { id },
      data: {
        ...rest,
        kind,
        caloriesBurned: burned,
        ...(exercises !== undefined
          ? { exercises: { deleteMany: {}, create: exercises.map((e, i) => ({ ...e, order: e.order ?? i })) } }
          : {}),
      },
    });
    return this.getWorkout(id);
  }

  async deleteWorkout(id: string) {
    const ex = await this.db.workout.findFirst({ where: { id, userId: currentUserId() } });
    if (!ex) return false;
    await this.db.workout.delete({ where: { id } });
    // Удаляем связанный блок календаря напрямую
    if (ex.timeBlockId) {
      await this.db.timeBlock.delete({ where: { id: ex.timeBlockId } }).catch(() => {});
      hub.broadcast({ type: 'timeblock.deleted', payload: { id: ex.timeBlockId } });
    }
    return true;
  }

  // Прогресс тренировок: strength = Σ вес×подходы×повторы по дням, cardio = калории по дням
  async workoutProgress(kind: 'strength' | 'cardio'): Promise<WorkoutProgressPoint[]> {
    const rows = await this.db.workout.findMany({
      where: { kind, userId: currentUserId() },
      orderBy: { date: 'asc' },
      include: { exercises: true },
    });
    return rows.map((w) => {
      const value =
        kind === 'strength'
          ? w.exercises.reduce((s, e) => s + (e.weightKg ?? 0) * (e.sets ?? 0) * (e.reps ?? 0), 0)
          : (w.caloriesBurned ?? 0);
      return { date: w.date, value: Math.round(value) };
    });
  }

  // ── Питание ──
  async listMeals(q: HealthRangeQuery) {
    const rows = await this.db.meal.findMany({
      where: { userId: currentUserId(), date: { gte: q.from, lte: q.to } },
      orderBy: { date: 'desc' },
    });
    return rows.map((r) => MealSchema.parse(r));
  }
  async upsertMeal(dto: CreateMealDto) {
    const userId = currentUserId();
    const date = utcDay(dto.date);
    const { date: _, ...data } = dto;
    const row = await this.db.meal.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, ...data },
      update: data,
    });
    return MealSchema.parse(row);
  }
  async updateMeal(id: string, dto: UpdateMealDto) {
    const ex = await this.db.meal.findFirst({ where: { id, userId: currentUserId() } });
    if (!ex) return null;
    const row = await this.db.meal.update({ where: { id }, data: dto });
    return MealSchema.parse(row);
  }
  async deleteMeal(id: string) {
    const r = await this.db.meal.deleteMany({ where: { id, userId: currentUserId() } });
    return r.count > 0;
  }

  // ── Добавки/лекарства ──
  private suppShape(raw: Record<string, unknown>) {
    const w = raw.weekdays;
    return { ...raw, weekdays: typeof w === 'string' && w.length ? (JSON.parse(w) as number[]) : [] };
  }
  private suppData(dto: CreateSupplementDto | UpdateSupplementDto) {
    const { weekdays, ...rest } = dto as Record<string, unknown> & { weekdays?: number[] };
    const data: Record<string, unknown> = { ...rest };
    if (weekdays !== undefined) data.weekdays = weekdays.length ? JSON.stringify(weekdays) : null;
    return data as Prisma.SupplementUncheckedCreateInput;
  }
  async listSupplements(q: HealthRangeQuery) {
    const rows = await this.db.supplement.findMany({
      where: { userId: currentUserId() },
      orderBy: { createdAt: 'asc' },
      include: { entries: { where: { date: { gte: q.from, lte: q.to } }, select: { date: true } } },
    });
    return rows.map((r) =>
      SupplementWithEntriesSchema.parse({
        ...this.suppShape(r as Record<string, unknown>),
        entries: r.entries.map((e) => e.date),
      }),
    );
  }
  async createSupplement(dto: CreateSupplementDto) {
    const row = await this.db.supplement.create({
      data: { ...this.suppData(dto), userId: currentUserId() },
    });
    return SupplementSchema.parse(this.suppShape(row as Record<string, unknown>));
  }
  async updateSupplement(id: string, dto: UpdateSupplementDto) {
    const ex = await this.db.supplement.findFirst({ where: { id, userId: currentUserId() } });
    if (!ex) return null;
    const row = await this.db.supplement.update({ where: { id }, data: this.suppData(dto) });
    return SupplementSchema.parse(this.suppShape(row as Record<string, unknown>));
  }
  async deleteSupplement(id: string) {
    const r = await this.db.supplement.deleteMany({ where: { id, userId: currentUserId() } });
    return r.count > 0;
  }
  async toggleSupplement(id: string, date: Date) {
    const ex = await this.db.supplement.findFirst({ where: { id, userId: currentUserId() } });
    if (!ex) return null;
    const day = utcDay(date);
    const entry = await this.db.supplementEntry.findUnique({
      where: { supplementId_date: { supplementId: id, date: day } },
    });
    if (entry) {
      await this.db.supplementEntry.delete({ where: { id: entry.id } });
      return { date: day, done: false };
    }
    await this.db.supplementEntry.create({ data: { supplementId: id, date: day } });
    return { date: day, done: true };
  }

  // ── Настройки здоровья (профиль + цели) ──
  private settingToHealth(s: Record<string, unknown> | null): HealthSettings {
    return HealthSettingsSchema.parse({
      sex: s?.sex ?? null,
      birthYear: s?.birthYear ?? null,
      heightCm: s?.heightCm ?? null,
      weightGoalKg: s?.weightGoalKg ?? null,
      activityLevel: s?.activityLevel ?? null,
      goal: s?.goal ?? null,
      caloriesGoal: s?.caloriesGoal ?? null,
      proteinGoal: s?.proteinGoal ?? null,
      carbsGoal: s?.carbsGoal ?? null,
      fatGoal: s?.fatGoal ?? null,
      hrTargetMin: s?.hrTargetMin ?? null,
      hrTargetMax: s?.hrTargetMax ?? null,
    });
  }
  async getHealthSettings(): Promise<HealthSettings> {
    const s = await this.db.setting.findUnique({ where: { userId: currentUserId() } });
    return this.settingToHealth(s as Record<string, unknown> | null);
  }
  async updateHealthSettings(dto: UpdateHealthSettingsDto): Promise<HealthSettings> {
    const userId = currentUserId();
    const row = await this.db.setting.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
    });
    return this.settingToHealth(row as Record<string, unknown>);
  }

  // Рекомендуемое КБЖУ по профилю + последнему весу
  async getNutritionRecommendation(): Promise<NutritionRecommendation> {
    const s = await this.db.setting.findUnique({ where: { userId: currentUserId() } });
    const lastWeight = await this.db.weightEntry.findFirst({
      where: { userId: currentUserId() },
      orderBy: { date: 'desc' },
    });
    return recommendedKbju({
      sex: (s?.sex as Sex) ?? null,
      age: ageFromBirthYear(s?.birthYear ?? null),
      heightCm: s?.heightCm ?? null,
      weightKg: lastWeight?.weightKg ?? null,
      activityLevel: (s?.activityLevel as ActivityLevel) ?? null,
      goal: (s?.goal as NutritionGoal) ?? null,
    });
  }

  // Серия веса по корзинам (неделя/месяц) — среднее за бакет
  async weightSeries(by: 'week' | 'month'): Promise<WeightSeriesPoint[]> {
    const rows = await this.db.weightEntry.findMany({
      where: { userId: currentUserId() },
      orderBy: { date: 'asc' },
    });
    const buckets = new Map<string, { sum: number; n: number; date: Date }>();
    for (const r of rows) {
      const d = new Date(r.date);
      let key: string;
      let bucketDate: Date;
      if (by === 'week') {
        const dow = (d.getUTCDay() + 6) % 7;
        bucketDate = new Date(d.valueOf() - dow * 86_400_000);
        key = bucketDate.toISOString().slice(0, 10);
      } else {
        bucketDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
        key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
      }
      const b = buckets.get(key) ?? { sum: 0, n: 0, date: bucketDate };
      b.sum += r.weightKg;
      b.n += 1;
      buckets.set(key, b);
    }
    return [...buckets.values()].map((b) => ({
      label:
        by === 'week'
          ? b.date.toLocaleDateString('ru', { day: 'numeric', month: 'short' })
          : b.date.toLocaleDateString('ru', { month: 'short', year: '2-digit' }),
      date: b.date,
      weightKg: Math.round((b.sum / b.n) * 10) / 10,
    }));
  }
}
