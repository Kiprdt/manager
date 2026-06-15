import { useMemo } from 'react';
import { Task } from '@life-app/shared';
import { useTasks, useUpdateTask } from '../../api/tasks';
import { useTimeBlocks } from '../../api/timeblocks';
import { useHabits, useToggleHabit } from '../../api/habits';
import { useMeals, useWeights, useHealthSettings } from '../../api/health';
import { useFinanceTx } from '../../api/finance';
import { useUiStore } from '../../store/ui-store';
import { startOfDay, addDays, isSameDay, dueBucket, startOfMonth, addMonths, formatDayTitle } from '../../lib/datetime';
import { fmtMoney } from '../../lib/finance';
import styles from './DashboardView.module.css';

function fmtTime(d: Date) {
  return new Intl.DateTimeFormat('ru', { hour: '2-digit', minute: '2-digit' }).format(d);
}

export function DashboardView() {
  const { openTask, openEvent, openCreator, setMainView, openPlanner } = useUiStore();
  const today = useMemo(() => startOfDay(new Date()), []);
  const dayEnd = addDays(today, 1);
  const month = useMemo(() => ({ from: startOfMonth(new Date()), to: addMonths(startOfMonth(new Date()), 1) }), []);

  const { data: tasks = [] } = useTasks({ limit: 200 });
  const { data: blocks = [] } = useTimeBlocks(today, dayEnd);
  const { data: habits = [] } = useHabits(addDays(today, -1), dayEnd);
  const { data: meals = [] } = useMeals(addDays(today, -1), dayEnd);
  const { data: weights = [] } = useWeights(addDays(today, -60), dayEnd);
  const { data: settings } = useHealthSettings();
  const { data: tx = [] } = useFinanceTx(month.from, month.to);
  const updateTask = useUpdateTask();
  const toggleHabit = useToggleHabit();

  const roots = tasks.filter((t) => !t.parentId);
  const dueToday = roots.filter((t) => t.status !== 'DONE' && t.dueAt && isSameDay(new Date(t.dueAt), today));
  const overdue = roots.filter((t) => t.status !== 'DONE' && dueBucket(t.dueAt) === 'overdue');
  const events = [...blocks].sort((a, b) => new Date(a.startAt).valueOf() - new Date(b.startAt).valueOf());

  const habitDayKey = today.toISOString().slice(0, 10);
  const habitDone = (h: (typeof habits)[number]) =>
    (h.entries.find((e) => new Date(e.date).toISOString().slice(0, 10) === habitDayKey)?.count ?? 0) >= h.targetCount;
  const habitsDoneCount = habits.filter(habitDone).length;

  const todayMeal = meals.find((m) => isSameDay(new Date(m.date), today));
  const cal = todayMeal?.calories ?? 0;
  const calGoal = settings?.caloriesGoal ?? 0;
  const latestWeight = [...weights].sort((a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf())[0];

  const income = tx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = tx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const toggle = (t: Task) =>
    updateTask.mutate({ id: t.id, dto: { status: t.status === 'DONE' ? 'TODO' : 'DONE' } });

  return (
    <div className={styles.root}>
      <div className={styles.sheet}>
        <header className={styles.header}>
          <h2 className={styles.title}>{formatDayTitle(today)}</h2>
          <button className={styles.addBtn} onClick={() => openCreator()}>＋ Создать</button>
        </header>

        {/* Сводка-плитки */}
        <div className={styles.tiles}>
          <button className={styles.tile} onClick={() => openPlanner()}>
            <span className={styles.tileNum} style={{ color: 'var(--accent-blue)' }}>{dueToday.length}</span>
            <span className={styles.tileLbl}>задач сегодня</span>
          </button>
          <button className={styles.tile} onClick={() => setMainView('calendar')}>
            <span className={styles.tileNum}>{events.length}</span>
            <span className={styles.tileLbl}>мероприятий</span>
          </button>
          <button className={styles.tile} onClick={() => setMainView('habits')}>
            <span className={styles.tileNum} style={{ color: '#34c759' }}>{habitsDoneCount}/{habits.length}</span>
            <span className={styles.tileLbl}>привычек</span>
          </button>
          <button className={styles.tile} onClick={() => setMainView('finance')}>
            <span className={styles.tileNum} style={{ color: income - expense >= 0 ? '#34c759' : 'var(--accent)' }}>{fmtMoney(income - expense)}</span>
            <span className={styles.tileLbl}>баланс месяца</span>
          </button>
        </div>

        {overdue.length > 0 && (
          <button className={styles.overdueBar} onClick={() => openPlanner()}>
            ⚠ Просрочено: {overdue.length} — открыть
          </button>
        )}

        <div className={styles.cols}>
          {/* Расписание дня */}
          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Сегодня</h3>
            {events.length === 0 && dueToday.length === 0 && <p className={styles.empty}>Свободный день 🎉</p>}
            {events.map((ev) => (
              <button key={ev.id} className={styles.row} onClick={() => openEvent(ev.id)}>
                <span className={styles.time}>{ev.isAllDay ? 'весь день' : fmtTime(new Date(ev.startAt))}</span>
                <span className={styles.dot} style={{ background: ev.color ?? '#007aff' }} />
                <span className={styles.rowText}>{ev.title}</span>
              </button>
            ))}
            {dueToday.map((t) => (
              <div key={t.id} className={styles.row}>
                <button className={`${styles.check} ${t.status === 'DONE' ? styles.checkDone : ''}`} onClick={() => toggle(t)}>
                  {t.status === 'DONE' ? '✓' : ''}
                </button>
                <button className={styles.rowText} onClick={() => openTask(t.id)} style={{ textAlign: 'left' }}>
                  {t.title}
                </button>
              </div>
            ))}
          </section>

          {/* Привычки + здоровье */}
          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Привычки и здоровье</h3>
            {habits.length === 0 && <p className={styles.empty}>Нет привычек</p>}
            {habits.map((h) => (
              <div key={h.id} className={styles.row}>
                <button
                  className={`${styles.check} ${habitDone(h) ? styles.checkDone : ''}`}
                  onClick={() => toggleHabit.mutate({ id: h.id, date: today })}
                  style={habitDone(h) ? { background: h.color ?? '#34c759', borderColor: h.color ?? '#34c759' } : undefined}
                >
                  {habitDone(h) ? '✓' : ''}
                </button>
                <span className={styles.rowText}>{h.title}</span>
              </div>
            ))}
            <div className={styles.healthRow}>
              <button className={styles.miniStat} onClick={() => setMainView('health')}>
                <b>{cal}{calGoal ? `/${calGoal}` : ''}</b>
                <span>ккал</span>
              </button>
              {latestWeight && (
                <button className={styles.miniStat} onClick={() => setMainView('health')}>
                  <b>{latestWeight.weightKg}</b>
                  <span>вес, кг</span>
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
