import { Task } from '@life-app/shared';

export interface Interval {
  start: Date;
  end: Date;
}
export interface Planned {
  task: Task;
  start: Date;
  end: Date;
}

export interface AutoScheduleOptions {
  startHour?: number; // начало рабочего окна
  endHour?: number; // конец рабочего окна
  bufferMin?: number; // перерыв между задачами
  lunch?: { startHour: number; endHour: number } | null; // обеденный перерыв
  defaultDurationMin?: number; // длительность задачи без оценки
  now?: Date; // «текущий момент» (для тестов)
}

const DEFAULTS: Required<Omit<AutoScheduleOptions, 'lunch' | 'now'>> & {
  lunch: { startHour: number; endHour: number } | null;
} = {
  startHour: 9,
  endHour: 21,
  bufferMin: 10,
  lunch: { startHour: 13, endHour: 14 },
  defaultDurationMin: 30,
};

function at(day: Date, hour: number, min = 0): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, min, 0, 0);
}

/**
 * Оценка длительности задачи: явная оценка, иначе зависит от важности
 * (важные дела по умолчанию получают больше времени).
 */
function durationMs(task: Task, fallbackMin: number): number {
  if (task.estimatedMinutes && task.estimatedMinutes > 0) return task.estimatedMinutes * 60_000;
  const byImportance = [fallbackMin, fallbackMin, 45, 60][task.importance] ?? fallbackMin;
  return byImportance * 60_000;
}

/**
 * Дедлайн-ограничение: к какому моменту задача должна быть завершена.
 * Если у задачи есть точное время дедлайна в этот день — не планируем позже него.
 */
function deadlineLimit(task: Task, windowEnd: Date): Date {
  if (!task.dueAt) return windowEnd;
  const due = new Date(task.dueAt);
  if (task.dueAllDay) return windowEnd;
  // Точный дедлайн в пределах окна — финиш не позже него
  return due < windowEnd ? due : windowEnd;
}

/**
 * Композитный приоритет: матрица Эйзенхауэра (важность + срочность) плюс
 * близость дедлайна. Чем больше — тем раньше задачу ставим.
 */
export function taskScore(task: Task, now: Date): number {
  let score = task.importance * 10 + (task.urgent ? 6 : 0);
  if (task.dueAt) {
    const hoursLeft = (new Date(task.dueAt).valueOf() - now.valueOf()) / 3_600_000;
    if (hoursLeft < 0) score += 20; // просрочено — максимум вверх
    else if (hoursLeft < 24) score += 12;
    else if (hoursLeft < 72) score += 6;
  }
  return score;
}

/**
 * Раскладывает задачи по свободным слотам дня.
 *
 * Логика:
 *  • рабочее окно [startHour, endHour) минус занятые мероприятия и обед → свободные слоты;
 *  • для «сегодня» слоты в прошлом отбрасываются;
 *  • порядок задач: сначала по дедлайну (EDF — earliest deadline first, надёжно
 *    укладывается в сроки), при равенстве — по Эйзенхауэр-score (важные/срочные выше);
 *  • между задачами оставляется буфер;
 *  • задача с точным дедлайном не планируется так, чтобы закончиться после него.
 */
export function autoSchedule(
  day: Date,
  busy: Interval[],
  tasks: Task[],
  options: AutoScheduleOptions = {},
): Planned[] {
  const opt = { ...DEFAULTS, ...options };
  const now = options.now ?? new Date();
  const windowStart = at(day, opt.startHour);
  const windowEnd = at(day, opt.endHour);

  // Занятые интервалы = мероприятия + обеденный перерыв
  const blocked = busy
    .map((b) => ({ start: new Date(b.start), end: new Date(b.end) }))
    .concat(opt.lunch ? [{ start: at(day, opt.lunch.startHour), end: at(day, opt.lunch.endHour) }] : [])
    .map((b) => ({
      start: new Date(Math.max(b.start.valueOf(), windowStart.valueOf())),
      end: new Date(Math.min(b.end.valueOf(), windowEnd.valueOf())),
    }))
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start.valueOf() - b.start.valueOf());

  // Свободные слоты между занятыми интервалами
  const free: Interval[] = [];
  let cursor = windowStart;
  for (const b of blocked) {
    if (b.start > cursor) free.push({ start: cursor, end: b.start });
    if (b.end > cursor) cursor = b.end;
  }
  if (cursor < windowEnd) free.push({ start: cursor, end: windowEnd });

  // Для «сегодня» не планируем в прошлое
  const slots = free
    .map((s) => ({ cursor: new Date(Math.max(s.start.valueOf(), now.valueOf())), end: s.end }))
    .filter((s) => s.end > s.cursor);

  // Порядок: EDF по дедлайну, затем по Эйзенхауэр-score
  const ordered = [...tasks].sort((a, b) => {
    const ad = a.dueAt ? new Date(a.dueAt).valueOf() : Infinity;
    const bd = b.dueAt ? new Date(b.dueAt).valueOf() : Infinity;
    if (ad !== bd) return ad - bd;
    return taskScore(b, now) - taskScore(a, now);
  });

  const bufferMs = opt.bufferMin * 60_000;
  const planned: Planned[] = [];

  for (const task of ordered) {
    const durMs = durationMs(task, opt.defaultDurationMin);
    const limit = deadlineLimit(task, windowEnd);

    // Первый слот, где задача помещается и успевает до дедлайна
    const slot = slots.find((s) => {
      const available = Math.min(s.end.valueOf(), limit.valueOf()) - s.cursor.valueOf();
      return available >= durMs;
    });
    if (!slot) continue;

    const start = new Date(slot.cursor);
    const end = new Date(start.valueOf() + durMs);
    planned.push({ task, start, end });
    // Сдвигаем курсор слота с учётом буфера
    slot.cursor = new Date(end.valueOf() + bufferMs);
  }

  return planned;
}
