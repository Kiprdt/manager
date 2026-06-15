import { useCallback, useMemo, useState } from 'react';
import { Task } from '@life-app/shared';
import { useTasks, useCreateTask, useUpdateTask } from '../../api/tasks';
import { useTimeBlocks } from '../../api/timeblocks';
import { useUiStore } from '../../store/ui-store';
import {
  startOfMonth,
  addMonths,
  isSameMonth,
  isSameDay,
  daysInMonth,
  startOfDay,
  formatMonthTitle,
  formatDayTitle,
} from '../../lib/datetime';
import { priorityColor } from '../../lib/priority';
import { EisenhowerView } from '../eisenhower/EisenhowerView';
import styles from './PlannerView.module.css';

type MatrixScope = 'day' | 'month' | 'year' | 'all';

const SCOPE_TABS: { key: MatrixScope; label: string }[] = [
  { key: 'day', label: 'День' },
  { key: 'month', label: 'Месяц' },
  { key: 'year', label: 'Год' },
  { key: 'all', label: 'Всё' },
];

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

function fmtTime(d: Date) {
  return new Intl.DateTimeFormat('ru', { hour: '2-digit', minute: '2-digit' }).format(d);
}

export function PlannerView() {
  const { openTask, openEvent, openCreator } = useUiStore();
  const today = useMemo(() => startOfDay(new Date()), []);
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date>(() => startOfDay(new Date()));
  const [matrixScope, setMatrixScope] = useState<MatrixScope>('day');
  const [quick, setQuick] = useState('');
  // Перетаскивание задачи на другой день календаря
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  const monthEnd = useMemo(() => addMonths(month, 1), [month]);
  const { data: tasks = [] } = useTasks({ limit: 200 });
  const { data: blocks = [] } = useTimeBlocks(month, monthEnd);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  // Сетка месяца (пн=0), с количеством задач+мероприятий на дне
  const weeks = useMemo(() => {
    const n = daysInMonth(month);
    const firstDow = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
    const cells: ({ date: Date; count: number } | null)[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let i = 1; i <= n; i++) {
      const d = new Date(month.getFullYear(), month.getMonth(), i);
      const tk = tasks.filter((t) => t.dueAt && t.status !== 'DONE' && isSameDay(new Date(t.dueAt), d)).length;
      const ev = blocks.filter((b) => isSameDay(new Date(b.startAt), d)).length;
      cells.push({ date: d, count: tk + ev });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (typeof cells)[] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [month, tasks, blocks]);

  // Задачи выбранного дня
  const dayTasks: Task[] = useMemo(
    () =>
      tasks
        .filter((t) => !t.parentId && t.dueAt && isSameDay(new Date(t.dueAt), selectedDay))
        .sort((a, b) => {
          const ad = a.status === 'DONE' ? 1 : 0;
          const bd = b.status === 'DONE' ? 1 : 0;
          if (ad !== bd) return ad - bd;
          return b.importance - a.importance;
        }),
    [tasks, selectedDay],
  );

  // Мероприятия выбранного дня
  const dayEvents = useMemo(
    () =>
      blocks
        .filter((b) => isSameDay(new Date(b.startAt), selectedDay))
        .sort((a, b) => new Date(a.startAt).valueOf() - new Date(b.startAt).valueOf()),
    [blocks, selectedDay],
  );

  // Просроченные задачи — не выполнены, дедлайн раньше сегодня (видны всегда)
  const overdue: Task[] = useMemo(
    () =>
      tasks
        .filter((t) => !t.parentId && t.status !== 'DONE' && t.dueAt && new Date(t.dueAt) < today)
        .sort((a, b) => new Date(a.dueAt!).valueOf() - new Date(b.dueAt!).valueOf()),
    [tasks, today],
  );

  const pickDay = (d: Date) => {
    setSelectedDay(d);
    if (!isSameMonth(d, month)) setMonth(startOfMonth(d));
  };

  const goToday = () => {
    setMonth(startOfMonth(new Date()));
    setSelectedDay(startOfDay(new Date()));
  };

  const toggleTask = (t: Task) =>
    updateTask.mutate({ id: t.id, dto: { status: t.status === 'DONE' ? 'TODO' : 'DONE' } });

  // Перенос задачи на другой день (drag из списка дня на ячейку календаря)
  const moveTaskToDay = (taskId: string, day: Date) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;
    // Сохраняем время суток у дедлайна со временем, иначе переносим как «весь день»
    let dueAt = startOfDay(day);
    if (t.dueAt && !t.dueAllDay) {
      const prev = new Date(t.dueAt);
      dueAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), prev.getHours(), prev.getMinutes());
    }
    updateTask.mutate({ id: taskId, dto: { dueAt, dueAllDay: t.dueAllDay } });
  };

  const addQuick = () => {
    const title = quick.trim();
    if (!title) return;
    createTask.mutate({ title, dueAt: selectedDay, dueAllDay: true, scope: 'day' });
    setQuick('');
  };

  // Фильтр горизонта для матрицы
  const horizonFilter = useCallback(
    (t: Task) => {
      if (matrixScope === 'all') return true;
      if (!t.dueAt) return false;
      const d = new Date(t.dueAt);
      if (matrixScope === 'day') return isSameDay(d, selectedDay);
      if (matrixScope === 'month') return isSameMonth(d, selectedDay);
      return d.getFullYear() === selectedDay.getFullYear();
    },
    [matrixScope, selectedDay],
  );

  const scopeSubtitle =
    matrixScope === 'day'
      ? formatDayTitle(selectedDay)
      : matrixScope === 'month'
        ? formatMonthTitle(selectedDay)
        : matrixScope === 'year'
          ? `${selectedDay.getFullYear()} год`
          : 'Все задачи';

  return (
    <div className={styles.root}>
      {/* Левая панель — bullet journal месяца + день */}
      <aside className={styles.left}>
        <header className={styles.monthHead}>
          <button className={styles.nav} onClick={() => setMonth(addMonths(month, -1))} title="Предыдущий месяц">
            ‹
          </button>
          <h2 className={styles.monthTitle}>{formatMonthTitle(month)}</h2>
          <button className={styles.nav} onClick={() => setMonth(addMonths(month, 1))} title="Следующий месяц">
            ›
          </button>
          <button className={styles.todayBtn} onClick={goToday}>
            Сегодня
          </button>
        </header>

        <div className={styles.cal}>
          <div className={styles.weekHead}>
            {WEEKDAYS.map((w) => (
              <span key={w} className={styles.wd}>
                {w}
              </span>
            ))}
          </div>
          {weeks.map((row, ri) => (
            <div key={ri} className={styles.week}>
              {row.map((c, ci) =>
                c ? (
                  <button
                    key={ci}
                    className={`${styles.day} ${isSameDay(c.date, selectedDay) ? styles.daySel : ''} ${
                      isSameDay(c.date, today) ? styles.dayToday : ''
                    } ${dragOverDay === c.date.toDateString() ? styles.dayDrop : ''}`}
                    onClick={() => pickDay(c.date)}
                    onDragOver={(e) => {
                      if (!dragTaskId) return;
                      e.preventDefault();
                      setDragOverDay(c.date.toDateString());
                    }}
                    onDragLeave={() =>
                      setDragOverDay((cur) => (cur === c.date.toDateString() ? null : cur))
                    }
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData('text/task') || dragTaskId;
                      if (id) moveTaskToDay(id, c.date);
                      setDragTaskId(null);
                      setDragOverDay(null);
                    }}
                  >
                    <span className={styles.dayNum}>{c.date.getDate()}</span>
                    {c.count > 0 && (
                      <span className={styles.dots}>
                        {Array.from({ length: Math.min(c.count, 3) }).map((_, di) => (
                          <span key={di} className={styles.dot} />
                        ))}
                      </span>
                    )}
                  </button>
                ) : (
                  <span key={ci} className={styles.dayEmpty} />
                ),
              )}
            </div>
          ))}
        </div>

        {/* Просрочено — всегда сверху, независимо от выбранного дня */}
        {overdue.length > 0 && (
          <section className={styles.overdueSection}>
            <h3 className={styles.overdueTitle}>⚠ Просрочено · {overdue.length}</h3>
            {overdue.map((t) => (
              <div key={t.id} className={styles.taskRow}>
                <button
                  className={styles.check}
                  onClick={() => toggleTask(t)}
                  title="Отметить выполненной"
                />
                <span className={styles.prioDot} style={{ background: priorityColor(t.importance) }} />
                <button className={styles.taskTitle} onClick={() => openTask(t.id)}>
                  {t.title}
                </button>
                <span className={styles.overdueDate}>
                  {new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' }).format(new Date(t.dueAt!))}
                </span>
                <button
                  className={styles.moveBtn}
                  onClick={() => moveTaskToDay(t.id, today)}
                  title="Перенести на сегодня"
                >
                  → сегодня
                </button>
              </div>
            ))}
          </section>
        )}

        {/* Задачи выбранного дня */}
        <section className={styles.dayPanel}>
          <h3 className={styles.dayTitle}>{formatDayTitle(selectedDay)}</h3>

          {dayEvents.length > 0 && (
            <div className={styles.events}>
              {dayEvents.map((ev) => (
                <button key={ev.id} className={styles.eventRow} onClick={() => openEvent(ev.id)}>
                  <span className={styles.eventTime}>
                    {ev.isAllDay ? 'весь день' : fmtTime(new Date(ev.startAt))}
                  </span>
                  <span className={styles.eventDot} style={{ background: ev.color ?? '#007aff' }} />
                  <span className={styles.eventTitle}>{ev.title}</span>
                </button>
              ))}
            </div>
          )}

          <div className={styles.tasks}>
            {dayTasks.length === 0 && <p className={styles.empty}>На этот день задач нет</p>}
            {dayTasks.map((t) => {
              const done = t.status === 'DONE';
              return (
                <div
                  key={t.id}
                  className={`${styles.taskRow} ${done ? styles.taskDone : ''} ${dragTaskId === t.id ? styles.taskDragging : ''}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/task', t.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setDragTaskId(t.id);
                  }}
                  onDragEnd={() => {
                    setDragTaskId(null);
                    setDragOverDay(null);
                  }}
                  title="Перетащите на день календаря, чтобы перенести"
                >
                  <button
                    className={`${styles.check} ${done ? styles.checkOn : ''}`}
                    onClick={() => toggleTask(t)}
                    title={done ? 'Снять отметку' : 'Выполнено'}
                  >
                    {done ? '✓' : ''}
                  </button>
                  <span className={styles.prioDot} style={{ background: priorityColor(t.importance) }} />
                  <button className={styles.taskTitle} onClick={() => openTask(t.id)}>
                    {t.title}
                  </button>
                  {t.dueAt && !t.dueAllDay && <span className={styles.taskTime}>{fmtTime(new Date(t.dueAt))}</span>}
                </div>
              );
            })}
          </div>

          <div className={styles.addRow}>
            <input
              className={styles.addInput}
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addQuick()}
              placeholder="Задача на этот день…"
            />
            <button className={styles.cardBtn} onClick={() => openCreator(selectedDay)} title="Создать через карточку">
              Карточка
            </button>
          </div>
        </section>
      </aside>

      {/* Правая панель — матрица Эйзенхауэра с горизонтом */}
      <section className={styles.right}>
        <header className={styles.matrixHead}>
          <div className={styles.matrixTitleWrap}>
            <h2 className={styles.matrixTitle}>Матрица Эйзенхауэра</h2>
            <span className={styles.matrixSub}>{scopeSubtitle}</span>
          </div>
          <div className={styles.scopeTabs}>
            {SCOPE_TABS.map((s) => (
              <button
                key={s.key}
                className={`${styles.scopeTab} ${matrixScope === s.key ? styles.scopeTabActive : ''}`}
                onClick={() => setMatrixScope(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </header>
        <div className={styles.matrixBody}>
          <EisenhowerView embedded taskFilter={horizonFilter} />
        </div>
      </section>
    </div>
  );
}
