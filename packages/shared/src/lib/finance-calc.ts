// Финансовые расчёты: вклады/инвестиции (сложный процент) и кредиты (аннуитет).
// Чистые функции — используются веб-калькулятором и покрыты тестами.

export interface ForecastPoint {
  month: number;
  value: number; // баланс/остаток
  contributed?: number; // внесено всего (для вкладов)
  interest?: number; // накопленные проценты
}

export interface DepositResult {
  points: ForecastPoint[];
  finalValue: number;
  totalContributed: number;
  totalInterest: number;
  /** Эффективная доходность за весь срок, % от вложенного. */
  effectiveYieldPct: number;
}

// Вклад/инвестиция: ежемесячная капитализация + ежемесячные пополнения.
export function depositForecast(
  principal: number,
  annualRatePct: number,
  months: number,
  monthlyContribution = 0,
): DepositResult {
  const r = annualRatePct / 100 / 12;
  const points: ForecastPoint[] = [];
  let value = principal;
  let contributed = principal;
  for (let m = 1; m <= months; m++) {
    value = value * (1 + r) + monthlyContribution;
    contributed += monthlyContribution;
    points.push({
      month: m,
      value: Math.round(value),
      contributed: Math.round(contributed),
      interest: Math.round(value - contributed),
    });
  }
  const finalValue = points.length ? points[points.length - 1].value : principal;
  const totalContributed = Math.round(contributed);
  const totalInterest = Math.round(finalValue - contributed);
  return {
    points,
    finalValue,
    totalContributed,
    totalInterest,
    effectiveYieldPct: totalContributed > 0 ? (totalInterest / totalContributed) * 100 : 0,
  };
}

export interface LoanResult {
  points: ForecastPoint[];
  monthlyPayment: number;
  totalPaid: number;
  totalInterest: number;
}

// Кредит: аннуитетный платёж + график убывания остатка.
export function loanForecast(principal: number, annualRatePct: number, months: number): LoanResult {
  const r = annualRatePct / 100 / 12;
  const payment = r === 0 ? principal / months : (principal * r) / (1 - Math.pow(1 + r, -months));
  const points: ForecastPoint[] = [];
  let balance = principal;
  let interestSum = 0;
  for (let m = 1; m <= months; m++) {
    const interest = balance * r;
    interestSum += interest;
    balance = balance + interest - payment;
    points.push({
      month: m,
      value: Math.max(0, Math.round(balance)),
      interest: Math.round(interestSum),
    });
  }
  return {
    points,
    monthlyPayment: Math.round(payment),
    totalPaid: Math.round(payment * months),
    totalInterest: Math.round(payment * months - principal),
  };
}
