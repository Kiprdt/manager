import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  accountCurrentDebt,
  accountUtilization,
  creditMinPayment,
  creditMonthlyInterest,
  budgetOverLimit,
  budgetOverThreshold,
  budgetRemaining,
  finGoalProgress,
  advanceByFrequency,
  depositForecast,
  loanForecast,
} from '../index';

const credit = { type: 'Кредитная', creditLimit: 100000, balance: 70000, minPaymentPct: 5, interestRate: 12 };
const debit = { type: 'Дебетовая', creditLimit: 0, balance: 50000, minPaymentPct: 0, interestRate: 0 };

test('accountCurrentDebt: кредитка = лимит − баланс, дебет = 0', () => {
  assert.equal(accountCurrentDebt(credit), 30000);
  assert.equal(accountCurrentDebt(debit), 0);
});

test('accountUtilization: долг/лимит', () => {
  assert.equal(accountUtilization(credit), 0.3);
  assert.equal(accountUtilization(debit), 0);
});

test('creditMinPayment и месячные проценты', () => {
  assert.equal(creditMinPayment(credit), 1500); // 30000 * 5%
  assert.equal(creditMonthlyInterest(credit), 300); // 30000 * 12% / 12
});

test('бюджет: остаток, порог, превышение', () => {
  const b = { plannedAmount: 1000, spentAmount: 1500, alertThreshold: 80 };
  assert.equal(budgetRemaining(b), -500);
  assert.equal(budgetOverLimit(b), true);
  assert.equal(budgetOverThreshold(b), true);
  const ok = { plannedAmount: 1000, spentAmount: 500, alertThreshold: 80 };
  assert.equal(budgetOverLimit(ok), false);
  assert.equal(budgetOverThreshold(ok), false);
});

test('прогресс цели ограничен 1', () => {
  assert.equal(finGoalProgress({ targetAmount: 100, currentAmount: 50 }), 0.5);
  assert.equal(finGoalProgress({ targetAmount: 100, currentAmount: 150 }), 1);
  assert.equal(finGoalProgress({ targetAmount: 0, currentAmount: 10 }), 0);
});

test('advanceByFrequency сдвигает дату', () => {
  const d = new Date(2026, 0, 15); // 15 янв
  assert.equal(advanceByFrequency(d, 'Ежедневно').getDate(), 16);
  assert.equal(advanceByFrequency(d, 'Еженедельно').getDate(), 22);
  assert.equal(advanceByFrequency(d, 'Ежемесячно').getMonth(), 1); // февраль
  assert.equal(advanceByFrequency(d, 'Ежегодно').getFullYear(), 2027);
});

test('вклад: сложный процент', () => {
  const r = depositForecast(100000, 12, 12, 0);
  // 100000 * 1.01^12 ≈ 112682.5
  assert.ok(Math.abs(r.finalValue - 112683) <= 2, `finalValue=${r.finalValue}`);
  assert.equal(r.totalContributed, 100000);
  assert.equal(r.totalInterest, r.finalValue - 100000);
  assert.ok(r.effectiveYieldPct > 12 && r.effectiveYieldPct < 13);
});

test('вклад с пополнениями увеличивает вложено', () => {
  const r = depositForecast(0, 12, 12, 10000);
  assert.equal(r.totalContributed, 120000);
  assert.ok(r.finalValue > 120000); // капитализация дала доход
});

test('кредит: 0% → платёж = тело/срок, переплата 0', () => {
  const r = loanForecast(120000, 0, 12);
  assert.equal(r.monthlyPayment, 10000);
  assert.equal(r.totalInterest, 0);
});

test('кредит: положительная ставка → переплата > 0', () => {
  const r = loanForecast(100000, 12, 12);
  assert.ok(r.monthlyPayment > 100000 / 12);
  assert.ok(r.totalInterest > 0);
});
