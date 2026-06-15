import { z } from 'zod';

// Сводка по разделу «Финансы». Считается на сервере — переиспользуется веб-UI
// и (в перспективе) Telegram-ботом.
export const FinDashboardSchema = z.object({
  // Счета. netWorth/totalDebt — в базовой валюте (самой частой у счетов).
  // byCurrency — разбивка по валютам (суммировать разные валюты нельзя).
  baseCurrency: z.string(),
  netWorth: z.number(),
  totalDebt: z.number().nonnegative(),
  byCurrency: z.array(
    z.object({
      currency: z.string(),
      netWorth: z.number(),
      totalDebt: z.number().nonnegative(),
    }),
  ),
  accountsCount: z.number().int().nonnegative(),
  // Текущий месяц
  monthIncome: z.number().nonnegative(),
  monthExpense: z.number().nonnegative(),
  monthNet: z.number(),
  // Бюджеты
  budgetPlanned: z.number().nonnegative(),
  budgetSpent: z.number().nonnegative(),
  budgetOverCount: z.number().int().nonnegative(),
  // Цели
  goalsCount: z.number().int().nonnegative(),
  goalsSaved: z.number().nonnegative(),
  goalsTarget: z.number().nonnegative(),
  // Регулярные платежи
  dueRecurrentCount: z.number().int().nonnegative(),
  upcoming: z.array(
    z.object({
      name: z.string(),
      amount: z.number(),
      nextDate: z.coerce.date(),
    }),
  ),
  // Топ категорий расходов за месяц
  topExpenses: z.array(z.object({ category: z.string(), amount: z.number() })),
});
export type FinDashboard = z.infer<typeof FinDashboardSchema>;
