import { TimeBlock, Task } from '@life-app/shared';
import { useTimeBlocks } from '../../api/timeblocks';
import { useTasks, useUpdateTask } from '../../api/tasks';
import { useUiStore } from '../../store/ui-store';
import { Modal } from '../../components/Modal';
import { formatDayTitle, isSameDay } from '../../lib/datetime';
import { priorityColor } from '../../lib/priority';
import styles from './Card.module.css';
import dayStyles from './DayCard.module.css';

function fmtTime(d: Date) {
  return new Intl.DateTimeFormat('ru', { hour: '2-digit', minute: '2-digit' }).format(d);
}

function DayCardInner({ date }: { date: Date }) {
  const { closeDay, openEvent, openTask, openCreator } = useUiStore();
  const updateTask = useUpdateTask();

  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const dayEnd = new Date(dayStart.valueOf() + 24 * 60 * 60 * 1000);

  const { data: blocks = [] } = useTimeBlocks(dayStart, dayEnd);
  const { data: tasks = [] } = useTasks({ limit: 200 });

  const events: TimeBlock[] = [...blocks].sort(
    (a, b) => new Date(a.startAt).valueOf() - new Date(b.startAt).valueOf(),
  );
  const dayTasks: Task[] = tasks
    .filter((t) => t.dueAt && isSameDay(new Date(t.dueAt), date))
    .sort((a, b) => Number(b.status !== 'DONE') - Number(a.status !== 'DONE'));

  const toggle = (t: Task) =>
    updateTask.mutate({ id: t.id, dto: { status: t.status === 'DONE' ? 'TODO' : 'DONE' } });

  return (
    <Modal open onClose={closeDay}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={dayStyles.dayTitle}>{formatDayTitle(date)}</span>
          <button className={styles.closeBtn} onClick={closeDay} title="Закрыть">
            ×
          </button>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Мероприятия</label>
          <div className={styles.list}>
            {events.length === 0 && <span className={styles.empty}>Нет мероприятий</span>}
            {events.map((ev) => (
              <button
                key={ev.id}
                className={dayStyles.eventRow}
                onClick={() => openEvent(ev.id)}
              >
                <span
                  className={dayStyles.dot}
                  style={{ background: ev.color ?? '#007aff' }}
                />
                <span className={dayStyles.time}>
                  {ev.isAllDay
                    ? 'весь день'
                    : `${fmtTime(new Date(ev.startAt))}–${fmtTime(new Date(ev.endAt))}`}
                </span>
                <span className={dayStyles.rowTitle}>{ev.title}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Задачи</label>
          <div className={styles.list}>
            {dayTasks.length === 0 && <span className={styles.empty}>Нет задач</span>}
            {dayTasks.map((t) => (
              <div key={t.id} className={styles.taskRow}>
                <button
                  className={`${styles.check} ${t.status === 'DONE' ? styles.done : ''}`}
                  onClick={() => toggle(t)}
                  title="Готово"
                >
                  {t.status === 'DONE' ? '✓' : ''}
                </button>
                <span
                  className={dayStyles.taskBadge}
                  style={{ background: priorityColor(t.priority) }}
                />
                <button
                  className={`${styles.taskTitle} ${t.status === 'DONE' ? styles.done : ''} ${dayStyles.taskOpen}`}
                  onClick={() => openTask(t.id)}
                >
                  {t.title}
                  {t.dueAt && !t.dueAllDay && (
                    <span className={dayStyles.taskTime}> · {fmtTime(new Date(t.dueAt))}</span>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.footer}>
          <span />
          <button className={styles.saveBtn} onClick={() => openCreator(dayStart)}>
            + Добавить
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function DayCard() {
  const openDayDate = useUiStore((s) => s.openDayDate);
  if (!openDayDate) return null;
  return <DayCardInner date={openDayDate} />;
}
