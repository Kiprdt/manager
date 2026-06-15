import { PrismaClient } from '@prisma/client';
import { proxiedFetch } from '../../lib/proxy-fetch';
import { currentUserId } from '../../lib/context';

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function sameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export interface Snapshot {
  generatedAt: string;
  tasks: Record<string, number>;
  upcoming: { title: string; dueAt: string }[];
  habits: { title: string; streak: number; doneToday: boolean; targetPerDay: number }[];
  health: Record<string, number | null>;
  categoriesTimeMin: { name: string; minutes: number }[];
  finance: {
    monthIncome: number;
    monthExpense: number;
    balance: number;
    topExpenseCategories: { category: string; amount: number }[];
    instruments: { kind: string; name: string; principal: number; annualRate: number; termMonths: number }[];
  };
}

export class InsightsService {
  constructor(private readonly db: PrismaClient) {}

  async buildSnapshot(): Promise<Snapshot> {
    const now = new Date();
    const today = startOfDay(now);
    const weekAhead = addDays(today, 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const userId = currentUserId();
    const [tasks, habitRows, weights, workouts, meals, categories, finTx, instruments] = await Promise.all([
      this.db.task.findMany({ where: { userId, parentId: null } }),
      this.db.habit.findMany({ where: { userId }, include: { entries: { select: { date: true, count: true } } } }),
      this.db.weightEntry.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
      this.db.workout.findMany({ where: { userId, date: { gte: addDays(today, -30) } } }),
      this.db.meal.findMany({ where: { userId, date: { gte: addDays(today, -1) } } }),
      this.db.category.findMany({ where: { userId } }),
      this.db.financeTx.findMany({ where: { userId, date: { gte: monthStart } } }),
      this.db.financeInstrument.findMany({ where: { userId } }),
    ]);

    const active = tasks.filter((t) => t.status !== 'DONE');
    const done = tasks.filter((t) => t.status === 'DONE');
    const overdue = active.filter((t) => t.dueAt && new Date(t.dueAt) < today).length;
    const dueToday = active.filter((t) => t.dueAt && sameDay(new Date(t.dueAt), now)).length;
    const completedSince = (days: number) =>
      done.filter((t) => t.completedAt && new Date(t.completedAt) >= addDays(today, -days)).length;

    const upcoming = active
      .filter((t) => t.dueAt && new Date(t.dueAt) >= today && new Date(t.dueAt) <= weekAhead)
      .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime())
      .slice(0, 15)
      .map((t) => ({ title: t.title, dueAt: new Date(t.dueAt!).toISOString() }));

    // Категории — время по факту
    const catTime = new Map<string, number>();
    done.forEach((t) => {
      if (t.actualMinutes && t.categoryId)
        catTime.set(t.categoryId, (catTime.get(t.categoryId) ?? 0) + t.actualMinutes);
    });
    const categoriesTimeMin = categories
      .map((c) => ({ name: c.name, minutes: catTime.get(c.id) ?? 0 }))
      .filter((c) => c.minutes > 0);

    // Привычки + серии
    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const habits = habitRows.map((h) => {
      const counts = new Map(h.entries.map((e) => [dayKey(new Date(e.date)), e.count]));
      const todayKey = dayKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
      const doneToday = (counts.get(todayKey) ?? 0) >= h.targetCount;
      let streak = 0;
      const cur = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      if ((counts.get(dayKey(cur)) ?? 0) < h.targetCount) cur.setUTCDate(cur.getUTCDate() - 1);
      while ((counts.get(dayKey(cur)) ?? 0) >= h.targetCount) {
        streak++;
        cur.setUTCDate(cur.getUTCDate() - 1);
      }
      return { title: h.title, streak, doneToday, targetPerDay: h.targetCount };
    });

    // Здоровье
    const latestWeight = weights.length ? weights[weights.length - 1].weightKg : null;
    const monthAgo = weights.find((w) => new Date(w.date) >= addDays(today, -30));
    const weightDelta30 = latestWeight != null && monthAgo ? +(latestWeight - monthAgo.weightKg).toFixed(1) : null;
    const caloriesToday = meals
      .filter((m) => sameDay(new Date(m.date), now))
      .reduce((s, m) => s + (m.calories ?? 0), 0);

    // Финансы за текущий месяц
    const monthIncome = finTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const monthExpense = finTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const expByCat = new Map<string, number>();
    finTx
      .filter((t) => t.type === 'expense')
      .forEach((t) => expByCat.set(t.category ?? 'прочее', (expByCat.get(t.category ?? 'прочее') ?? 0) + t.amount));
    const topExpenseCategories = [...expByCat.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([category, amount]) => ({ category, amount: Math.round(amount) }));

    return {
      generatedAt: now.toISOString(),
      tasks: {
        total: tasks.length,
        active: active.length,
        done: done.length,
        overdue,
        dueToday,
        completedLast7: completedSince(7),
        completedLast30: completedSince(30),
        timeTrackedMin: done.reduce((s, t) => s + (t.actualMinutes ?? 0), 0),
      },
      upcoming,
      habits,
      health: {
        latestWeightKg: latestWeight,
        weightDelta30,
        workoutsLast30: workouts.length,
        workoutMinLast30: workouts.reduce((s, w) => s + (w.durationMin ?? 0), 0),
        caloriesToday,
      },
      categoriesTimeMin,
      finance: {
        monthIncome: Math.round(monthIncome),
        monthExpense: Math.round(monthExpense),
        balance: Math.round(monthIncome - monthExpense),
        topExpenseCategories,
        instruments: instruments.map((i) => ({
          kind: i.kind,
          name: i.name,
          principal: i.principal,
          annualRate: i.annualRate,
          termMonths: i.termMonths,
        })),
      },
    };
  }

  // Вызов LLM (OpenAI-совместимый chat/completions). Настройки из БД либо env.
  async analyze(question?: string): Promise<{ configured: boolean; text?: string; snapshot: Snapshot; error?: string }> {
    const snapshot = await this.buildSnapshot();

    const setting = await this.db.setting.findUnique({ where: { userId: currentUserId() } });
    const key = setting?.llmApiKey ?? process.env.LLM_API_KEY;
    if (!key) return { configured: false, snapshot };

    const url =
      setting?.llmBaseUrl ?? process.env.LLM_API_URL ?? 'https://api.openai.com/v1/chat/completions';
    const model = setting?.llmModel ?? process.env.LLM_MODEL ?? 'gpt-4o-mini';
    const system =
      'Ты ассистент по личной продуктивности и здоровью. На основе JSON-снимка данных дай КРАТКИЙ анализ (5–7 пунктов) и прогноз/рекомендации на ближайшую неделю. Пиши по-русски, конкретно, без воды.';
    const user = `${question ? question + '\n\n' : ''}Снимок данных:\n${JSON.stringify(snapshot)}`;

    try {
      const res = await proxiedFetch(
        url,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            temperature: 0.4,
          }),
        },
        setting?.proxyUrl,
      );
      if (!res.ok) {
        return { configured: true, snapshot, error: `LLM ответил ${res.status}` };
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content ?? '';
      return { configured: true, snapshot, text };
    } catch (e) {
      return { configured: true, snapshot, error: e instanceof Error ? e.message : 'LLM error' };
    }
  }
}
