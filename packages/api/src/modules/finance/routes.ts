import { FastifyPluginAsync } from 'fastify';
import { Prisma } from '@prisma/client';
import { FinanceService } from './service';
import {
  CreateFinanceTxSchema,
  UpdateFinanceTxSchema,
  CreateFinanceInstrumentSchema,
  FinanceRangeQuerySchema,
  FinanceTxSchema,
  FinanceInstrumentSchema,
  CreateFinAccountSchema,
  UpdateFinAccountSchema,
  FinAccountSchema,
  CreateFinCategorySchema,
  UpdateFinCategorySchema,
  FinCategorySchema,
  DEFAULT_FIN_CATEGORIES,
  CreateFinTransactionSchema,
  UpdateFinTransactionSchema,
  FinTransactionSchema,
  CreateFinBudgetSchema,
  UpdateFinBudgetSchema,
  FinBudgetSchema,
  currentMonthYear,
  CreateFinGoalSchema,
  UpdateFinGoalSchema,
  FinGoalSchema,
  CreateFinRecurrentPaymentSchema,
  UpdateFinRecurrentPaymentSchema,
  FinRecurrentPaymentSchema,
  CreateFinShoppingItemSchema,
  UpdateFinShoppingItemSchema,
  FinShoppingItemSchema,
  FinDashboardSchema,
} from '@life-app/shared';
import { currentUserId } from '../../lib/context';

const financeRoutes: FastifyPluginAsync = async (server) => {
  const db = server.prisma;

  // Транзакции (доходы/расходы)
  server.get('/tx', async (req) => {
    const q = FinanceRangeQuerySchema.parse(req.query);
    const rows = await db.financeTx.findMany({
      where: { userId: currentUserId(), date: { gte: q.from, lte: q.to } },
      orderBy: { date: 'desc' },
    });
    return rows.map((r) => FinanceTxSchema.parse(r));
  });
  server.post('/tx', async (req, reply) => {
    const dto = CreateFinanceTxSchema.parse(req.body);
    const row = await db.financeTx.create({ data: { ...dto, userId: currentUserId() } });
    return reply.status(201).send(FinanceTxSchema.parse(row));
  });
  server.patch<{ Params: { id: string } }>('/tx/:id', async (req, reply) => {
    const dto = UpdateFinanceTxSchema.parse(req.body);
    const ex = await db.financeTx.findFirst({ where: { id: req.params.id, userId: currentUserId() } });
    if (!ex) return reply.status(404).send({ error: 'not found' });
    const row = await db.financeTx.update({ where: { id: req.params.id }, data: dto });
    return FinanceTxSchema.parse(row);
  });
  server.delete<{ Params: { id: string } }>('/tx/:id', async (req, reply) => {
    const ex = await db.financeTx.findFirst({ where: { id: req.params.id, userId: currentUserId() } });
    if (!ex) return reply.status(404).send({ error: 'not found' });
    await db.financeTx.delete({ where: { id: req.params.id } });
    return reply.status(204).send();
  });

  // Инструменты (вклады/инвестиции/кредиты)
  server.get('/instruments', async () => {
    const rows = await db.financeInstrument.findMany({
      where: { userId: currentUserId() },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => FinanceInstrumentSchema.parse(r));
  });
  server.post('/instruments', async (req, reply) => {
    const dto = CreateFinanceInstrumentSchema.parse(req.body);
    const row = await db.financeInstrument.create({ data: { ...dto, userId: currentUserId() } });
    return reply.status(201).send(FinanceInstrumentSchema.parse(row));
  });
  server.delete<{ Params: { id: string } }>('/instruments/:id', async (req, reply) => {
    const ex = await db.financeInstrument.findFirst({
      where: { id: req.params.id, userId: currentUserId() },
    });
    if (!ex) return reply.status(404).send({ error: 'not found' });
    await db.financeInstrument.delete({ where: { id: req.params.id } });
    return reply.status(204).send();
  });

  // ── Счета ──────────────────────────────────────────────────────────────────
  // Записываем срез баланса в историю (одна запись на счёт+день) при изменении.
  // cx — клиент Prisma (обычный или транзакционный из $transaction).
  const snapshotBalance = async (
    cx: Prisma.TransactionClient,
    accountId: string,
    balance: number,
  ) => {
    const recordedDate = new Date();
    recordedDate.setHours(0, 0, 0, 0);
    await cx.finBalanceHistory.upsert({
      where: { accountId_recordedDate: { accountId, recordedDate } },
      create: { accountId, recordedDate, balance },
      update: { balance },
    });
  };

  server.get('/accounts', async () => {
    const rows = await db.finAccount.findMany({
      where: { userId: currentUserId() },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => FinAccountSchema.parse(r));
  });
  server.post('/accounts', async (req, reply) => {
    const dto = CreateFinAccountSchema.parse(req.body);
    const userId = currentUserId();
    const row = await db.$transaction(async (cx) => {
      const created = await cx.finAccount.create({ data: { ...dto, userId } });
      await snapshotBalance(cx, created.id, created.balance);
      return created;
    });
    return reply.status(201).send(FinAccountSchema.parse(row));
  });
  server.patch<{ Params: { id: string } }>('/accounts/:id', async (req, reply) => {
    const dto = UpdateFinAccountSchema.parse(req.body);
    const ex = await db.finAccount.findFirst({
      where: { id: req.params.id, userId: currentUserId() },
    });
    if (!ex) return reply.status(404).send({ error: 'not found' });
    const row = await db.$transaction(async (cx) => {
      const updated = await cx.finAccount.update({ where: { id: req.params.id }, data: dto });
      if (dto.balance !== undefined) await snapshotBalance(cx, updated.id, updated.balance);
      return updated;
    });
    return FinAccountSchema.parse(row);
  });
  server.delete<{ Params: { id: string } }>('/accounts/:id', async (req, reply) => {
    const ex = await db.finAccount.findFirst({
      where: { id: req.params.id, userId: currentUserId() },
    });
    if (!ex) return reply.status(404).send({ error: 'not found' });
    await db.finAccount.delete({ where: { id: req.params.id } });
    return reply.status(204).send();
  });

  // ── Категории ──────────────────────────────────────────────────────────────
  // При первом обращении без категорий — лениво создаём набор по умолчанию.
  server.get('/categories', async () => {
    const userId = currentUserId();
    let rows = await db.finCategory.findMany({ where: { userId }, orderBy: { name: 'asc' } });
    if (rows.length === 0) {
      await db.finCategory.createMany({
        data: DEFAULT_FIN_CATEGORIES.map((c) => ({ ...c, userId })),
      });
      rows = await db.finCategory.findMany({ where: { userId }, orderBy: { name: 'asc' } });
    }
    return rows.map((r) => FinCategorySchema.parse(r));
  });
  server.post('/categories', async (req, reply) => {
    const dto = CreateFinCategorySchema.parse(req.body);
    const row = await db.finCategory.create({ data: { ...dto, userId: currentUserId() } });
    return reply.status(201).send(FinCategorySchema.parse(row));
  });
  server.patch<{ Params: { id: string } }>('/categories/:id', async (req, reply) => {
    const dto = UpdateFinCategorySchema.parse(req.body);
    const ex = await db.finCategory.findFirst({
      where: { id: req.params.id, userId: currentUserId() },
    });
    if (!ex) return reply.status(404).send({ error: 'not found' });
    const row = await db.finCategory.update({ where: { id: req.params.id }, data: dto });
    return FinCategorySchema.parse(row);
  });
  server.delete<{ Params: { id: string } }>('/categories/:id', async (req, reply) => {
    const ex = await db.finCategory.findFirst({
      where: { id: req.params.id, userId: currentUserId() },
    });
    if (!ex) return reply.status(404).send({ error: 'not found' });
    await db.finCategory.delete({ where: { id: req.params.id } });
    return reply.status(204).send();
  });

  // ── Транзакции ─────────────────────────────────────────────────────────────
  // Влияние на баланс счёта списания: Доход +amount, Расход/Перевод −amount.
  // Для перевода счёт назначения получает +amount.
  // sign=+1 — применить эффект, sign=−1 — откатить.
  const applyTxEffect = async (
    cx: Prisma.TransactionClient,
    tx: { type: string; amount: number; accountId: string; toAccountId: string | null },
    sign: 1 | -1,
  ) => {
    const fromDelta = sign * (tx.type === 'Доход' ? tx.amount : -tx.amount);
    const from = await cx.finAccount.update({
      where: { id: tx.accountId },
      data: { balance: { increment: fromDelta } },
    });
    await snapshotBalance(cx, from.id, from.balance);
    if (tx.type === 'Перевод' && tx.toAccountId) {
      const to = await cx.finAccount.update({
        where: { id: tx.toAccountId },
        data: { balance: { increment: sign * tx.amount } },
      });
      await snapshotBalance(cx, to.id, to.balance);
    }
  };

  server.get('/transactions', async (req) => {
    const userId = currentUserId();
    const q = req.query as { from?: string; to?: string };
    const where: Record<string, unknown> = { userId };
    if (q.from || q.to) {
      where.date = {
        ...(q.from ? { gte: new Date(q.from) } : {}),
        ...(q.to ? { lte: new Date(q.to) } : {}),
      };
    }
    const rows = await db.finTransaction.findMany({ where, orderBy: { date: 'desc' } });
    return rows.map((r) => FinTransactionSchema.parse(r));
  });
  server.post('/transactions', async (req, reply) => {
    const dto = CreateFinTransactionSchema.parse(req.body);
    const userId = currentUserId();
    // Проверяем принадлежность счетов пользователю.
    const acc = await db.finAccount.findFirst({ where: { id: dto.accountId, userId } });
    if (!acc) return reply.status(400).send({ error: 'Счёт не найден' });
    if (dto.type === 'Перевод' && dto.toAccountId) {
      const to = await db.finAccount.findFirst({ where: { id: dto.toAccountId, userId } });
      if (!to) return reply.status(400).send({ error: 'Счёт назначения не найден' });
    }
    const row = await db.$transaction(async (cx) => {
      const created = await cx.finTransaction.create({
        data: { ...dto, toAccountId: dto.toAccountId ?? null, userId },
      });
      await applyTxEffect(cx, created, 1);
      return created;
    });
    return reply.status(201).send(FinTransactionSchema.parse(row));
  });
  server.patch<{ Params: { id: string } }>('/transactions/:id', async (req, reply) => {
    const dto = UpdateFinTransactionSchema.parse(req.body);
    const ex = await db.finTransaction.findFirst({
      where: { id: req.params.id, userId: currentUserId() },
    });
    if (!ex) return reply.status(404).send({ error: 'not found' });
    // Если меняется сумма — откатываем старый эффект и применяем новый.
    if (dto.amount !== undefined && dto.amount !== ex.amount) {
      const updated = await db.$transaction(async (cx) => {
        await applyTxEffect(cx, ex, -1);
        const u = await cx.finTransaction.update({ where: { id: ex.id }, data: dto });
        await applyTxEffect(cx, u, 1);
        return u;
      });
      return FinTransactionSchema.parse(updated);
    }
    const row = await db.finTransaction.update({ where: { id: ex.id }, data: dto });
    return FinTransactionSchema.parse(row);
  });
  server.delete<{ Params: { id: string } }>('/transactions/:id', async (req, reply) => {
    const ex = await db.finTransaction.findFirst({
      where: { id: req.params.id, userId: currentUserId() },
    });
    if (!ex) return reply.status(404).send({ error: 'not found' });
    await db.$transaction(async (cx) => {
      await applyTxEffect(cx, ex, -1);
      await cx.finTransaction.delete({ where: { id: ex.id } });
    });
    return reply.status(204).send();
  });

  // ── Бюджеты ────────────────────────────────────────────────────────────────
  // spent — сумма расходов по категории за месяц; forecast — прогноз на месяц
  // по текущему темпу трат (только для текущего месяца).
  const monthRange = (monthYear: string) => {
    const [mm, yyyy] = monthYear.split('-').map(Number);
    const start = new Date(yyyy, mm - 1, 1);
    const end = new Date(yyyy, mm, 1);
    const daysInMonth = new Date(yyyy, mm, 0).getDate();
    return { start, end, daysInMonth };
  };

  const withSpent = async (
    userId: string,
    budget: { category: string; monthYear: string; plannedAmount: number; alertThreshold: number; id: string; createdAt: Date },
  ) => {
    const { start, end, daysInMonth } = monthRange(budget.monthYear);
    const agg = await db.finTransaction.aggregate({
      _sum: { amount: true },
      where: { userId, type: 'Расход', category: budget.category, date: { gte: start, lt: end } },
    });
    const spentAmount = agg._sum.amount ?? 0;
    // Прогноз только для текущего месяца: экстраполируем по пройденным дням.
    let forecast = spentAmount;
    if (budget.monthYear === currentMonthYear()) {
      const dayOfMonth = Math.max(1, new Date().getDate());
      forecast = (spentAmount / dayOfMonth) * daysInMonth;
    }
    return FinBudgetSchema.parse({ ...budget, spentAmount, forecast });
  };

  server.get('/budgets', async (req) => {
    const userId = currentUserId();
    const q = req.query as { monthYear?: string };
    const monthYear = q.monthYear || currentMonthYear();
    const rows = await db.finBudget.findMany({
      where: { userId, monthYear },
      orderBy: { category: 'asc' },
    });
    return Promise.all(rows.map((b) => withSpent(userId, b)));
  });
  server.post('/budgets', async (req, reply) => {
    const dto = CreateFinBudgetSchema.parse(req.body);
    const userId = currentUserId();
    const row = await db.finBudget.create({ data: { ...dto, userId } });
    return reply.status(201).send(await withSpent(userId, row));
  });
  server.patch<{ Params: { id: string } }>('/budgets/:id', async (req, reply) => {
    const dto = UpdateFinBudgetSchema.parse(req.body);
    const userId = currentUserId();
    const ex = await db.finBudget.findFirst({ where: { id: req.params.id, userId } });
    if (!ex) return reply.status(404).send({ error: 'not found' });
    const row = await db.finBudget.update({ where: { id: ex.id }, data: dto });
    return withSpent(userId, row);
  });
  server.delete<{ Params: { id: string } }>('/budgets/:id', async (req, reply) => {
    const ex = await db.finBudget.findFirst({
      where: { id: req.params.id, userId: currentUserId() },
    });
    if (!ex) return reply.status(404).send({ error: 'not found' });
    await db.finBudget.delete({ where: { id: ex.id } });
    return reply.status(204).send();
  });

  // ── Цели накопления ────────────────────────────────────────────────────────
  server.get('/goals', async () => {
    const rows = await db.finGoal.findMany({
      where: { userId: currentUserId() },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => FinGoalSchema.parse(r));
  });
  server.post('/goals', async (req, reply) => {
    const dto = CreateFinGoalSchema.parse(req.body);
    const row = await db.finGoal.create({ data: { ...dto, userId: currentUserId() } });
    return reply.status(201).send(FinGoalSchema.parse(row));
  });
  server.patch<{ Params: { id: string } }>('/goals/:id', async (req, reply) => {
    const dto = UpdateFinGoalSchema.parse(req.body);
    const ex = await db.finGoal.findFirst({
      where: { id: req.params.id, userId: currentUserId() },
    });
    if (!ex) return reply.status(404).send({ error: 'not found' });
    const row = await db.finGoal.update({ where: { id: ex.id }, data: dto });
    return FinGoalSchema.parse(row);
  });
  server.delete<{ Params: { id: string } }>('/goals/:id', async (req, reply) => {
    const ex = await db.finGoal.findFirst({
      where: { id: req.params.id, userId: currentUserId() },
    });
    if (!ex) return reply.status(404).send({ error: 'not found' });
    await db.finGoal.delete({ where: { id: ex.id } });
    return reply.status(204).send();
  });

  // ── Регулярные платежи / подписки ────────────────────────────────────────────
  server.get('/recurrent', async () => {
    const rows = await db.finRecurrentPayment.findMany({
      where: { userId: currentUserId() },
      orderBy: { nextDate: 'asc' },
    });
    return rows.map((r) => FinRecurrentPaymentSchema.parse(r));
  });
  server.post('/recurrent', async (req, reply) => {
    const dto = CreateFinRecurrentPaymentSchema.parse(req.body);
    const userId = currentUserId();
    const acc = await db.finAccount.findFirst({ where: { id: dto.accountId, userId } });
    if (!acc) return reply.status(400).send({ error: 'Счёт не найден' });
    const row = await db.finRecurrentPayment.create({
      data: { ...dto, type: dto.type ?? 'Расход', userId },
    });
    return reply.status(201).send(FinRecurrentPaymentSchema.parse(row));
  });
  server.patch<{ Params: { id: string } }>('/recurrent/:id', async (req, reply) => {
    const dto = UpdateFinRecurrentPaymentSchema.parse(req.body);
    const ex = await db.finRecurrentPayment.findFirst({
      where: { id: req.params.id, userId: currentUserId() },
    });
    if (!ex) return reply.status(404).send({ error: 'not found' });
    const row = await db.finRecurrentPayment.update({ where: { id: ex.id }, data: dto });
    return FinRecurrentPaymentSchema.parse(row);
  });
  server.delete<{ Params: { id: string } }>('/recurrent/:id', async (req, reply) => {
    const ex = await db.finRecurrentPayment.findFirst({
      where: { id: req.params.id, userId: currentUserId() },
    });
    if (!ex) return reply.status(404).send({ error: 'not found' });
    await db.finRecurrentPayment.delete({ where: { id: ex.id } });
    return reply.status(204).send();
  });
  // Провести наступившие платежи (логика в FinanceService — общая с планировщиком).
  server.post('/recurrent/process', async () => {
    const processed = await new FinanceService(db).processRecurrent();
    return { processed };
  });

  // ── Список покупок ───────────────────────────────────────────────────────────
  server.get('/shopping', async () => {
    const rows = await db.finShoppingItem.findMany({
      where: { userId: currentUserId() },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => FinShoppingItemSchema.parse(r));
  });
  server.post('/shopping', async (req, reply) => {
    const dto = CreateFinShoppingItemSchema.parse(req.body);
    const row = await db.finShoppingItem.create({ data: { ...dto, userId: currentUserId() } });
    return reply.status(201).send(FinShoppingItemSchema.parse(row));
  });
  server.patch<{ Params: { id: string } }>('/shopping/:id', async (req, reply) => {
    const dto = UpdateFinShoppingItemSchema.parse(req.body);
    const ex = await db.finShoppingItem.findFirst({
      where: { id: req.params.id, userId: currentUserId() },
    });
    if (!ex) return reply.status(404).send({ error: 'not found' });
    const row = await db.finShoppingItem.update({ where: { id: ex.id }, data: dto });
    return FinShoppingItemSchema.parse(row);
  });
  server.delete<{ Params: { id: string } }>('/shopping/:id', async (req, reply) => {
    const ex = await db.finShoppingItem.findFirst({
      where: { id: req.params.id, userId: currentUserId() },
    });
    if (!ex) return reply.status(404).send({ error: 'not found' });
    await db.finShoppingItem.delete({ where: { id: ex.id } });
    return reply.status(204).send();
  });

  // ── Сводка (дашборд) ─────────────────────────────────────────────────────────
  server.get('/dashboard', async () => {
    const summary = await new FinanceService(db).dashboard();
    return FinDashboardSchema.parse(summary);
  });
};

export default financeRoutes;
