import { useMemo, useState } from 'react';
import { HabitWithEntries } from '@life-app/shared';
import {
  useHabits,
  useCreateHabit,
  useDeleteHabit,
  useToggleHabit,
  useSetHabit,
} from '../../api/habits';
import styles from './HabitsView.module.css';

const PALETTE = ['#34c759', '#007aff', '#ff9500', '#af52de', '#ff2d55', '#00c7be'];
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const WD_PICK = [
  { n: 1, l: 'Пн' },
  { n: 2, l: 'Вт' },
  { n: 3, l: 'Ср' },
  { n: 4, l: 'Чт' },
  { n: 5, l: 'Пт' },
  { n: 6, l: 'Сб' },
  { n: 7, l: 'Вс' },
];
const DAY = 86_400_000;
const FUTURE_DAYS = 7;
const MAX_COLS = 35;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function utcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
// День недели пн=1..вс=7
function isoWeekday(d: Date): number {
  return ((d.getUTCDay() + 6) % 7) + 1;
}
function isScheduled(h: HabitWithEntries, d: Date): boolean {
  if (h.scheduleType === 'custom') return h.weekdays.includes(isoWeekday(d));
  return true; // daily / weekly — отмечать можно в любой день
}

export function HabitsView() {
  const { loadFrom, loadTo, today } = useMemo(() => {
    const base = utcMidnight(new Date());
    return {
      today: new Date(base),
      loadFrom: new Date(base - 371 * DAY),
      loadTo: new Date(base + FUTURE_DAYS * DAY),
    };
  }, []);

  const { data: habits = [] } = useHabits(loadFrom, loadTo);
  const createHabit = useCreateHabit();
  const deleteHabit = useDeleteHabit();
  const toggleHabit = useToggleHabit();
  const setHabit = useSetHabit();

  const todayKey = dayKey(today);

  // Форма создания
  const [title, setTitle] = useState('');
  const [showOpts, setShowOpts] = useState(false);
  const [target, setTarget] = useState(1);
  const [schedule, setSchedule] = useState<'daily' | 'custom'>('daily');
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [reminder, setReminder] = useState('');

  const add = () => {
    const t = title.trim();
    if (!t) return;
    createHabit.mutate({
      title: t,
      color: PALETTE[habits.length % PALETTE.length],
      targetCount: target,
      scheduleType: schedule,
      ...(schedule === 'custom' ? { weekdays } : {}),
      ...(reminder ? { reminderTime: reminder } : {}),
    });
    setTitle('');
    setTarget(1);
    setSchedule('daily');
    setReminder('');
    setShowOpts(false);
  };

  const countsOf = (h: HabitWithEntries) =>
    new Map(h.entries.map((e) => [dayKey(new Date(e.date)), e.count]));

  // Серия: подряд выполненные среди запланированных дней (непланируемые пропускаем)
  const streakOf = (h: HabitWithEntries, counts: Map<string, number>): number => {
    let streak = 0;
    const cur = new Date(today);
    if (isScheduled(h, cur) && (counts.get(dayKey(cur)) ?? 0) < h.targetCount) {
      cur.setUTCDate(cur.getUTCDate() - 1);
    }
    for (let i = 0; i < 400; i++) {
      if (!isScheduled(h, cur)) {
        cur.setUTCDate(cur.getUTCDate() - 1);
        continue;
      }
      if ((counts.get(dayKey(cur)) ?? 0) >= h.targetCount) {
        streak++;
        cur.setUTCDate(cur.getUTCDate() - 1);
      } else break;
    }
    return streak;
  };

  const todayDone = habits.filter((h) => {
    const c = countsOf(h).get(todayKey) ?? 0;
    return c >= h.targetCount;
  }).length;

  const heatmap = useMemo(() => {
    const counts = new Map<string, number>();
    let max = 1;
    for (const h of habits) {
      for (const e of h.entries) {
        if (e.count < h.targetCount) continue;
        const k = dayKey(new Date(e.date));
        const v = (counts.get(k) ?? 0) + 1;
        counts.set(k, v);
        if (v > max) max = v;
      }
    }
    const end = today.getTime();
    const endDow = (new Date(end).getUTCDay() + 6) % 7;
    const lastMonday = end - endDow * DAY;
    const firstMonday = lastMonday - 52 * 7 * DAY;
    const weeks: { key: string; count: number; future: boolean }[][] = [];
    for (let w = 0; w <= 52; w++) {
      const col: { key: string; count: number; future: boolean }[] = [];
      for (let dd = 0; dd < 7; dd++) {
        const t = firstMonday + (w * 7 + dd) * DAY;
        const k = dayKey(new Date(t));
        col.push({ key: k, count: counts.get(k) ?? 0, future: t > end });
      }
      weeks.push(col);
    }
    return { weeks, max };
  }, [habits, today]);

  const columns = useMemo(() => {
    const end = today.getTime() + FUTURE_DAYS * DAY;
    let start: number;
    if (habits.length) {
      const earliest = Math.min(...habits.map((h) => utcMidnight(new Date(h.createdAt))));
      start = earliest - DAY;
    } else start = today.getTime() - 6 * DAY;
    if (end - start > (MAX_COLS - 1) * DAY) start = end - (MAX_COLS - 1) * DAY;
    const cols: Date[] = [];
    for (let t = start; t <= end; t += DAY) cols.push(new Date(t));
    return cols;
  }, [habits, today]);

  const clickCell = (h: HabitWithEntries, d: Date, cur: number) => {
    if (h.targetCount === 1) {
      toggleHabit.mutate({ id: h.id, date: d });
    } else {
      const next = cur + 1 > h.targetCount ? 0 : cur + 1;
      setHabit.mutate({ id: h.id, date: d, count: next });
    }
  };

  const meta = (h: HabitWithEntries): string => {
    const parts: string[] = [];
    if (h.scheduleType === 'custom')
      parts.push(h.weekdays.map((n) => WD_PICK.find((w) => w.n === n)?.l).join(''));
    if (h.targetCount > 1) parts.push(`×${h.targetCount}/день`);
    if (h.reminderTime) parts.push(`⏰ ${h.reminderTime}`);
    return parts.join(' · ');
  };

  return (
    <div className={styles.root}>
      <div className={styles.sheet}>
        <header className={styles.header}>
          <h2 className={styles.title}>Привычки</h2>
          {habits.length > 0 && (
            <span className={styles.todayStat}>
              Сегодня: {todayDone}/{habits.length}
            </span>
          )}
        </header>

        {habits.length === 0 ? (
          <p className={styles.empty}>Пока нет привычек. Добавьте первую ниже 👇</p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.grid}>
              <thead>
                <tr>
                  <th className={styles.nameCol}></th>
                  {columns.map((d) => (
                    <th
                      key={dayKey(d)}
                      className={`${styles.dayHead} ${dayKey(d) === todayKey ? styles.todayHead : ''} ${
                        d.getTime() > today.getTime() ? styles.futureHead : ''
                      }`}
                    >
                      <span className={styles.wd}>{WD[d.getUTCDay()]}</span>
                      <span className={styles.dn}>{d.getUTCDate()}</span>
                    </th>
                  ))}
                  <th className={styles.streakCol}>🔥</th>
                </tr>
              </thead>
              <tbody>
                {habits.map((h) => {
                  const counts = countsOf(h);
                  const color = h.color ?? '#007aff';
                  const streak = streakOf(h, counts);
                  const startMs = utcMidnight(new Date(h.createdAt)) - DAY;
                  return (
                    <tr key={h.id}>
                      <td className={styles.nameCell}>
                        <span className={styles.nameWrap}>
                          <span className={styles.habitName}>{h.title}</span>
                          {meta(h) && <span className={styles.habitMeta}>{meta(h)}</span>}
                        </span>
                        <button className={styles.del} title="Удалить" onClick={() => deleteHabit.mutate(h.id)}>
                          ×
                        </button>
                      </td>
                      {columns.map((d) => {
                        const cur = counts.get(dayKey(d)) ?? 0;
                        const done = cur >= h.targetCount;
                        const before = d.getTime() < startMs;
                        const future = d.getTime() > today.getTime();
                        const offSched = !isScheduled(h, d);
                        if (before || offSched) return <td key={dayKey(d)} className={styles.cell}><span className={styles.dotEmpty} /></td>;
                        return (
                          <td key={dayKey(d)} className={styles.cell}>
                            <button
                              className={`${styles.dot} ${done ? styles.dotDone : ''} ${future ? styles.dotFuture : ''}`}
                              style={done ? { background: color, borderColor: color } : undefined}
                              onClick={() => clickCell(h, d, cur)}
                              title={`${dayKey(d)}${h.targetCount > 1 ? ` — ${cur}/${h.targetCount}` : ''}`}
                            >
                              {done ? '✓' : h.targetCount > 1 && cur > 0 ? cur : ''}
                            </button>
                          </td>
                        );
                      })}
                      <td className={styles.streakCell}>
                        <span className={styles.streak} style={{ color: streak > 0 ? color : undefined }}>
                          {streak}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {habits.length > 0 && (
          <div className={styles.heatSection}>
            <h3 className={styles.heatTitle}>Год выполнений</h3>
            <div className={styles.heatScroll}>
              <div className={styles.heat}>
                {heatmap.weeks.map((col, wi) => (
                  <div key={wi} className={styles.heatCol}>
                    {col.map((cell) => {
                      const level = cell.count === 0 ? 0 : Math.ceil((cell.count / heatmap.max) * 4);
                      return (
                        <span
                          key={cell.key}
                          className={`${styles.heatCell} ${cell.future ? styles.heatFuture : ''}`}
                          style={level > 0 ? { background: 'var(--accent-blue)', opacity: 0.25 + level * 0.18 } : undefined}
                          title={`${cell.key}: ${cell.count}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className={styles.createBox}>
          <div className={styles.addRow}>
            <input
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="Новая привычка (напр. «Спорт», «Вода»)…"
            />
            <button className={styles.optBtn} onClick={() => setShowOpts((v) => !v)} title="Настроить">
              ⚙
            </button>
            <button className={styles.addBtn} onClick={add} disabled={createHabit.isPending}>
              Добавить
            </button>
          </div>

          {showOpts && (
            <div className={styles.opts}>
              <label className={styles.opt}>
                <span>Цель в день</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  className={styles.optInput}
                  value={target}
                  onChange={(e) => setTarget(Math.max(1, Number(e.target.value) || 1))}
                />
              </label>
              <label className={styles.opt}>
                <span>Напоминание</span>
                <input
                  type="time"
                  className={styles.optInput}
                  value={reminder}
                  onChange={(e) => setReminder(e.target.value)}
                />
              </label>
              <label className={styles.opt}>
                <span>Периодичность</span>
                <select
                  className={styles.optInput}
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value as 'daily' | 'custom')}
                >
                  <option value="daily">Каждый день</option>
                  <option value="custom">По дням недели</option>
                </select>
              </label>
              {schedule === 'custom' && (
                <div className={styles.wdPick}>
                  {WD_PICK.map((w) => (
                    <button
                      key={w.n}
                      className={`${styles.wdBtn} ${weekdays.includes(w.n) ? styles.wdOn : ''}`}
                      onClick={() =>
                        setWeekdays((cur) =>
                          cur.includes(w.n) ? cur.filter((x) => x !== w.n) : [...cur, w.n].sort(),
                        )
                      }
                    >
                      {w.l}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
