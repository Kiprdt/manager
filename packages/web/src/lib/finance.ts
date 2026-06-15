// Расчёты вкладов/кредитов перенесены в @life-app/shared (тестируются там).
export { depositForecast, loanForecast } from '@life-app/shared';
export type { ForecastPoint, DepositResult, LoanResult } from '@life-app/shared';

export function fmtMoney(n: number): string {
  return new Intl.NumberFormat('ru', { maximumFractionDigits: 0 }).format(n) + ' ₽';
}
