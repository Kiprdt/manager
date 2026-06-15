// Конвертация между Date и значением <input type="datetime-local"> (локальный TZ)

export function toLocalInput(d: Date | null | undefined): string {
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? null : d;
}

// Только дата — для дедлайнов «на весь день» (<input type="date">)
export function toDateInput(d: Date | null | undefined): string {
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDateInput(value: string): Date | null {
  if (!value) return null;
  const [y, m, day] = value.split('-').map(Number);
  if (!y || !m || !day) return null;
  return new Date(y, m - 1, day, 0, 0, 0, 0); // локальная полночь
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

// Начало недели (понедельник)
export function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  const dow = (s.getDay() + 6) % 7; // пн=0
  s.setDate(s.getDate() - dow);
  return s;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1, 0, 0, 0, 0);
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function formatMonthTitle(d: Date): string {
  return new Intl.DateTimeFormat('ru', { month: 'long', year: 'numeric' }).format(d);
}

export function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

const WEEKDAY_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
export function weekdayShort(d: Date): string {
  return WEEKDAY_SHORT[d.getDay()];
}

export type DueBucket = 'overdue' | 'today' | 'soon' | 'later' | 'none';

// Категория задачи по дедлайну относительно сегодня (для умных списков)
export function dueBucket(due: Date | null | undefined): DueBucket {
  if (!due) return 'none';
  const today = startOfDay(new Date());
  const d = startOfDay(new Date(due));
  const diffDays = Math.round((d.valueOf() - today.valueOf()) / 86_400_000);
  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'today';
  if (diffDays <= 7) return 'soon';
  return 'later';
}

export function formatDayTitle(d: Date): string {
  return new Intl.DateTimeFormat('ru', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d);
}

export function formatRange(start: Date, end: Date): string {
  const sameDay = start.toDateString() === end.toDateString();
  const date = new Intl.DateTimeFormat('ru', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(start);
  const time = (d: Date) =>
    new Intl.DateTimeFormat('ru', { hour: '2-digit', minute: '2-digit' }).format(d);
  const mins = Math.round((end.valueOf() - start.valueOf()) / 60000);
  const dur =
    mins >= 60
      ? `${Math.floor(mins / 60)} ч${mins % 60 ? ` ${mins % 60} мин` : ''}`
      : `${mins} мин`;
  if (sameDay) return `${date}, ${time(start)} – ${time(end)} · ${dur}`;
  return `${time(start)} ${date} → ${time(end)} · ${dur}`;
}
