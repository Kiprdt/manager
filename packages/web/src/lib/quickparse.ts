import { normalizeTag } from './tags';

export interface ParsedQuick {
  title: string;
  dueAt: Date | null;
  dueAllDay: boolean;
  tags: string[];
  priority: number;
}

const WEEKDAYS: Record<string, number> = {
  понедельник: 1,
  вторник: 2,
  среда: 3,
  среду: 3,
  четверг: 4,
  пятница: 5,
  пятницу: 5,
  суббота: 6,
  субботу: 6,
  воскресенье: 0,
  пн: 1,
  вт: 2,
  ср: 3,
  чт: 4,
  пт: 5,
  сб: 6,
  вс: 0,
};

function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function nextWeekday(target: number): Date {
  const now = new Date();
  let diff = (target - now.getDay() + 7) % 7;
  if (diff === 0) diff = 7; // ближайший будущий
  const d = atMidnight(now);
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * Разбирает строку вида «позвонить маме завтра в 18:00 #дом p1»
 * в задачу: заголовок + дедлайн + теги + приоритет.
 */
export function parseQuickAdd(raw: string): ParsedQuick {
  let s = ` ${raw} `;
  const tags: string[] = [];
  let priority = 0;
  let dateBase: Date | null = null;
  let hasTime = false;
  let hours = 9;
  let minutes = 0;

  // Теги #...
  s = s.replace(/#([\p{L}\d_-]+)/gu, (_m, t: string) => {
    const n = normalizeTag(t);
    if (n) tags.push(n);
    return ' ';
  });

  // Приоритет p1..p4 (p1 — высший) или !1..!3
  s = s.replace(/(^|\s)[pрP!]([1-4])(?=\s)/u, (_m, sp: string, n: string) => {
    priority = Math.max(0, 4 - Number(n));
    return sp;
  });

  // Явная дата DD.MM или DD.MM.YYYY
  s = s.replace(/(^|\s)(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?(?=\s)/u, (_m, sp, dd, mm, yy) => {
    const now = new Date();
    let year = yy ? Number(yy) : now.getFullYear();
    if (year < 100) year += 2000;
    dateBase = new Date(year, Number(mm) - 1, Number(dd), 0, 0, 0, 0);
    return sp;
  });

  // Относительные слова
  const rel: [RegExp, () => Date][] = [
    [/(^|\s)сегодня(?=\s)/u, () => atMidnight(new Date())],
    [/(^|\s)завтра(?=\s)/u, () => { const d = atMidnight(new Date()); d.setDate(d.getDate() + 1); return d; }],
    [/(^|\s)послезавтра(?=\s)/u, () => { const d = atMidnight(new Date()); d.setDate(d.getDate() + 2); return d; }],
  ];
  for (const [re, fn] of rel) {
    if (re.test(s)) {
      dateBase = fn();
      s = s.replace(re, ' ');
      break;
    }
  }

  // «через N дней/недель»
  s = s.replace(/(^|\s)через\s+(\d+)\s+(дн(?:я|ей|ень)|недел(?:ю|и|ь))(?=\s)/u, (_m, sp, n, unit) => {
    const d = atMidnight(new Date());
    const mult = /недел/u.test(unit) ? 7 : 1;
    d.setDate(d.getDate() + Number(n) * mult);
    dateBase = d;
    return sp;
  });

  // День недели (опционально с «в»/«во»). Матчим именно слово-день из словаря,
  // а не первое слово строки — длинные ключи раньше коротких («среду» прежде «ср»).
  if (!dateBase) {
    const wdKeys = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length);
    const wdRe = new RegExp(`(^|\\s)(?:в|во)?\\s*(${wdKeys.join('|')})(?=\\s)`, 'iu');
    s = s.replace(wdRe, (_m, sp: string, word: string) => {
      dateBase = nextWeekday(WEEKDAYS[word.toLowerCase()]);
      return sp;
    });
  }

  // Время: «в 18:00», «18:00», «в 9»
  s = s.replace(/(^|\s)(?:в\s*)?([01]?\d|2[0-3]):([0-5]\d)(?=\s)/u, (_m, sp, h, mi) => {
    hasTime = true;
    hours = Number(h);
    minutes = Number(mi);
    return sp;
  });
  if (!hasTime) {
    s = s.replace(/(^|\s)в\s+([01]?\d|2[0-3])(?=\s)/u, (_m, sp, h) => {
      hasTime = true;
      hours = Number(h);
      minutes = 0;
      return sp;
    });
  }

  let dueAt: Date | null = null;
  let dueAllDay = false;
  if (dateBase || hasTime) {
    const base = dateBase ? new Date(dateBase) : atMidnight(new Date());
    if (hasTime) {
      base.setHours(hours, minutes, 0, 0);
      dueAllDay = false;
    } else {
      dueAllDay = true;
    }
    dueAt = base;
  }

  const title = s.replace(/\s+/g, ' ').trim();
  return { title, dueAt, dueAllDay, tags, priority };
}
