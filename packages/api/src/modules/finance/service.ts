import { PrismaClient } from '@prisma/client';
import {
  accountCurrentDebt,
  budgetOverLimit,
  currentMonthYear,
  advanceByFrequency,
  FinDashboard,
} from '@life-app/shared';
import { currentUserId } from '../../lib/context';

// Денежный формат для Telegram/текста (без зависимостей фронта).
export function fmtRub(n: number): string {
  const r = Math.round(n);
  return `${r.toLocaleString('ru-RU')} ₽`;
}

function monthRange(monthYear: string) {
  const [mm, yyyy] = monthYear.split('-').map(Number);
  return { start: new Date(yyyy, mm - 1, 1), end: new Date(yyyy, mm, 1) };
}

/**
 * Бизнес-логика раздела «Финансы», независимая от транспорта.
 * Используется HTTP-роутами и Telegram-поллером (через runWithUser).
 */
export class FinanceService {
  constructor(private readonly db: PrismaClient) {}

  /** Сводка по разделу (тот же объект, что отдаёт GET /finance/dashboard). */
  async dashboard(): Promise<FinDashboard> {
    const userId = currentUserId();
    const monthYear = currentMonthYear();
    const { start, end } = monthRange(monthYear);

    const [accounts, monthTx, budgets, goals, recurrent] = await Promise.all([
      this.db.finAccount.findMany({ where: { userId } }),
      this.db.finTransaction.findMany({ where: { userId, date: { gte: start, lt: end } } }),
      this.db.finBudget.findMany({ where: { userId, monthYear } }),
      this.db.finGoal.findMany({ where: { userId } }),
      this.db.finRecurrentPayment.findMany({ where: { userId }, orderBy: { nextDate: 'asc' } }),
    ]);

    // Разбивка по валютам (суммировать разные валюты нельзя).
    const curMap = new Map<string, { currency: string; netWorth: number; totalDebt: number }>();
    for (const a of accounts) {
      const cur = a.currency || 'RUB';
      const e = curMap.get(cur) ?? { currency: cur, netWorth: 0, totalDebt: 0 };
      const debt = accountCurrentDebt(a);
      e.netWorth += a.type === 'Кредитная' ? -debt : a.balance;
      e.totalDebt += debt;
      curMap.set(cur, e);
    }
    const byCurrency = [...curMap.values()].sort((x, y) => y.netWorth - x.netWorth);
    // Базовая валюта — самая частая у счетов (или RUB).
    const freq = new Map<string, number>();
    for (const a of accounts) freq.set(a.currency || 'RUB', (freq.get(a.currency || 'RUB') ?? 0) + 1);
    const baseCurrency =
      [...freq.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? 'RUB';
    const base = curMap.get(baseCurrency);
    const netWorth = base?.netWorth ?? 0;
    const totalDebt = base?.totalDebt ?? 0;
    const monthIncome = monthTx.filter((t) => t.type === 'Доход').reduce((s, t) => s + t.amount, 0);
    const monthExpense = monthTx.filter((t) => t.type === 'Расход').reduce((s, t) => s + t.amount, 0);

    const budgetData = await Promise.all(
      budgets.map(async (b) => {
        const agg = await this.db.finTransaction.aggregate({
          _sum: { amount: true },
          where: { userId, type: 'Расход', category: b.category, date: { gte: start, lt: end } },
        });
        return { plannedAmount: b.plannedAmount, spentAmount: agg._sum.amount ?? 0 };
      }),
    );
    const budgetPlanned = budgetData.reduce((s, b) => s + b.plannedAmount, 0);
    const budgetSpent = budgetData.reduce((s, b) => s + b.spentAmount, 0);
    const budgetOverCount = budgetData.filter((b) => budgetOverLimit(b)).length;

    const now = new Date();
    const byCat = new Map<string, number>();
    for (const t of monthTx) {
      if (t.type !== 'Расход') continue;
      const key = t.category || 'Прочее';
      byCat.set(key, (byCat.get(key) ?? 0) + t.amount);
    }

    return {
      baseCurrency,
      netWorth,
      totalDebt,
      byCurrency,
      accountsCount: accounts.length,
      monthIncome,
      monthExpense,
      monthNet: monthIncome - monthExpense,
      budgetPlanned,
      budgetSpent,
      budgetOverCount,
      goalsCount: goals.length,
      goalsSaved: goals.reduce((s, g) => s + g.currentAmount, 0),
      goalsTarget: goals.reduce((s, g) => s + g.targetAmount, 0),
      dueRecurrentCount: recurrent.filter((p) => p.nextDate <= now).length,
      upcoming: recurrent.slice(0, 5).map((p) => ({ name: p.name, amount: p.amount, nextDate: p.nextDate })),
      topExpenses: [...byCat.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category, amount]) => ({ category, amount })),
    };
  }

  /**
   * Быстрая транзакция (для Telegram): доход или расход на счёт по умолчанию.
   * Доход увеличивает баланс, расход — уменьшает.
   * Возвращает созданную транзакцию и новый баланс счёта.
   */
  async addQuickTransaction(
    type: 'Доход' | 'Расход',
    amount: number,
    category?: string | null,
    accountId?: string,
  ) {
    const userId = currentUserId();
    const account = accountId
      ? await this.db.finAccount.findFirst({ where: { id: accountId, userId } })
      : await this.db.finAccount.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
    if (!account) throw new Error('Нет счёта — создайте его в приложении');

    // Создание транзакции + изменение баланса + история — атомарно.
    return this.db.$transaction(async (cx) => {
      const tx = await cx.finTransaction.create({
        data: {
          userId,
          type,
          amount,
          category: category ?? null,
          accountId: account.id,
          toAccountId: null,
          date: new Date(),
          description: 'Добавлено из Telegram',
        },
      });
      const updated = await cx.finAccount.update({
        where: { id: account.id },
        data: { balance: type === 'Доход' ? { increment: amount } : { decrement: amount } },
      });
      const recordedDate = new Date();
      recordedDate.setHours(0, 0, 0, 0);
      await cx.finBalanceHistory.upsert({
        where: { accountId_recordedDate: { accountId: account.id, recordedDate } },
        create: { accountId: account.id, recordedDate, balance: updated.balance },
        update: { balance: updated.balance },
      });
      return { tx, account: updated };
    });
  }

  /**
   * Проводит все наступившие регулярные платежи текущего пользователя:
   * создаёт транзакции, меняет баланс, сдвигает nextDate. Возвращает число
   * проведённых платежей. Используется роутом, Telegram и планировщиком.
   */
  async processRecurrent(): Promise<number> {
    const userId = currentUserId();
    const now = new Date();
    const due = await this.db.finRecurrentPayment.findMany({
      where: { userId, nextDate: { lte: now } },
    });
    let processed = 0;
    for (const p of due) {
      processed += await this.db.$transaction(async (cx) => {
        let count = 0;
        let nextDate = p.nextDate;
        while (nextDate <= now) {
          await cx.finTransaction.create({
            data: {
              userId,
              type: p.type,
              category: p.category,
              subcategory: p.subcategory,
              amount: p.amount,
              accountId: p.accountId,
              toAccountId: null,
              date: nextDate,
              description: `Регулярный платёж: ${p.name}`,
            },
          });
          const updated = await cx.finAccount.update({
            where: { id: p.accountId },
            data: { balance: p.type === 'Доход' ? { increment: p.amount } : { decrement: p.amount } },
          });
          const recordedDate = new Date();
          recordedDate.setHours(0, 0, 0, 0);
          await cx.finBalanceHistory.upsert({
            where: { accountId_recordedDate: { accountId: p.accountId, recordedDate } },
            create: { accountId: p.accountId, recordedDate, balance: updated.balance },
            update: { balance: updated.balance },
          });
          count += 1;
          nextDate = advanceByFrequency(nextDate, p.frequency);
        }
        await cx.finRecurrentPayment.update({ where: { id: p.id }, data: { nextDate } });
        return count;
      });
    }
    return processed;
  }
}
