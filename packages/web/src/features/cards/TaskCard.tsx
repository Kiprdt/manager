import { useEffect, useMemo, useRef, useState } from 'react';
import { TaskStatus, TaskScope } from '@life-app/shared';
import { useTask, useCreateTask, useUpdateTask, useDeleteTask } from '../../api/tasks';
import { useTimeBlocks, useUpdateTimeBlock } from '../../api/timeblocks';
import { apiClient } from '../../lib/api-client';
import { useUiStore } from '../../store/ui-store';
import { Modal } from '../../components/Modal';
import {
  toLocalInput,
  fromLocalInput,
  toDateInput,
  fromDateInput,
} from '../../lib/datetime';
import { tagColor, normalizeTag } from '../../lib/tags';
import { CategoryPicker } from './CategoryPicker';
import { GoalPicker } from './GoalPicker';
import { LinkedNotes } from './LinkedNotes';
import styles from './Card.module.css';

const RECURRENCE_OPTIONS: { label: string; value: string }[] = [
  { label: 'Не повторять', value: '' },
  { label: 'Ежедневно', value: 'FREQ=DAILY' },
  { label: 'По будням', value: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
  { label: 'Еженедельно', value: 'FREQ=WEEKLY' },
  { label: 'Ежемесячно', value: 'FREQ=MONTHLY' },
];

const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'К выполнению',
  IN_PROGRESS: 'В работе',
  DONE: 'Готово',
};

export function TaskCard() {
  const { openTaskId, closeCards, openTask } = useUiStore();
  const { data: task } = useTask(openTaskId);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const createTask = useCreateTask();
  const updateBlock = useUpdateTimeBlock();

  // Мероприятия для привязки (широкий диапазон)
  const range = useMemo(() => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const to = new Date();
    to.setDate(to.getDate() + 90);
    return { from, to };
  }, []);
  const { data: events = [] } = useTimeBlocks(range.from, range.to);

  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [priority, setPriority] = useState(0);
  const [importance, setImportance] = useState(0);
  const [urgent, setUrgent] = useState(false);
  const [scope, setScope] = useState<TaskScope>('day');
  const [dueAt, setDueAt] = useState('');
  const [dueAllDay, setDueAllDay] = useState(false);
  const [recurrence, setRecurrence] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const [newSub, setNewSub] = useState('');
  const [estimate, setEstimate] = useState('');
  const [actual, setActual] = useState(0);
  const [runningSince, setRunningSince] = useState<number | null>(null);
  const [pomoEnd, setPomoEnd] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const titleRef = useRef<HTMLInputElement>(null);

  // Тик раз в секунду, пока идёт таймер или помодоро
  useEffect(() => {
    if (runningSince === null && pomoEnd === null) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [runningSince, pomoEnd]);

  // Завершение помодоро: +25 мин в факт, уведомление
  useEffect(() => {
    if (pomoEnd !== null && nowTick >= pomoEnd) {
      setActual((a) => a + 25);
      setPomoEnd(null);
      try {
        if ('Notification' in window && Notification.permission === 'granted')
          new Notification('🍅 Помодоро завершён', { body: 'Перерыв 5 минут' });
      } catch {
        /* ignore */
      }
    }
  }, [nowTick, pomoEnd]);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    requestAnimationFrame(() => {
      titleRef.current?.focus();
      titleRef.current?.select();
    });
    setStatus(task.status);
    setPriority(task.priority);
    setImportance(task.importance);
    setUrgent(task.urgent);
    setScope(task.scope);
    setDueAllDay(task.dueAllDay);
    setDueAt(
      task.dueAt
        ? task.dueAllDay
          ? toDateInput(new Date(task.dueAt))
          : toLocalInput(new Date(task.dueAt))
        : '',
    );
    setRecurrence(task.recurrenceRule ?? '');
    setNotes(task.notes ?? '');
    setTags(task.tags ?? []);
    setCategoryId(task.categoryId ?? null);
    setGoalId(task.goalId ?? null);
    setEstimate(task.estimatedMinutes ? String(task.estimatedMinutes) : '');
    setActual(task.actualMinutes ?? 0);
    setRunningSince(null);
    setPomoEnd(null);
  }, [task?.id]);

  if (!openTaskId) return null;

  const parseDue = () => (dueAllDay ? fromDateInput(dueAt) : fromLocalInput(dueAt));

  const runningSec = runningSince !== null ? Math.floor((nowTick - runningSince) / 1000) : 0;
  const totalActual = actual + (runningSince !== null ? Math.round(runningSec / 60) : 0);

  const toggleTimer = () => {
    if (runningSince === null) {
      setRunningSince(Date.now());
      setNowTick(Date.now());
    } else {
      const mins = Math.round((Date.now() - runningSince) / 60000);
      setActual((a) => a + mins);
      setRunningSince(null);
    }
  };

  const addTag = () => {
    const t = normalizeTag(tagDraft);
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagDraft('');
  };

  const toggleAllDay = (v: boolean) => {
    const cur = parseDue();
    setDueAllDay(v);
    setDueAt(cur ? (v ? toDateInput(cur) : toLocalInput(cur)) : '');
  };

  const handleSave = () => {
    if (!title.trim()) return;
    updateTask.mutate(
      {
        id: openTaskId,
        dto: {
          title: title.trim(),
          status,
          priority,
          importance,
          urgent,
          scope,
          dueAt: dueAt ? parseDue() : null,
          dueAllDay,
          recurrenceRule: recurrence || null,
          notes: notes.trim() || null,
          tags,
          categoryId,
          goalId,
          estimatedMinutes: estimate && Number(estimate) > 0 ? Number(estimate) : null,
          actualMinutes: totalActual > 0 ? totalActual : null,
        },
      },
      { onSuccess: closeCards },
    );
  };

  const handleDelete = () => {
    if (confirm(`Удалить задачу «${task?.title}»?`)) {
      deleteTask.mutate(openTaskId, { onSuccess: closeCards });
    }
  };

  // Дублировать задачу — копия со всеми полями (без статуса/факта); дедлайн на +1 день
  const handleDuplicate = () => {
    if (!title.trim()) return;
    const due0 = dueAt ? parseDue() : null;
    const dueCopy = due0 ? new Date(due0.valueOf() + 24 * 60 * 60 * 1000) : null;
    createTask.mutate(
      {
        title: `${title.trim()} (копия)`,
        description: task?.description ?? undefined,
        notes: notes.trim() || null,
        priority,
        importance,
        urgent,
        scope,
        dueAt: dueCopy,
        dueAllDay,
        recurrenceRule: recurrence || null,
        tags,
        categoryId,
        goalId,
        parentId: task?.parentId ?? null,
        estimatedMinutes: estimate && Number(estimate) > 0 ? Number(estimate) : null,
      },
      { onSuccess: (t) => openTask(t.id) },
    );
  };

  const addSubtask = () => {
    const t = newSub.trim();
    if (!t) return;
    createTask.mutate({ title: t, parentId: openTaskId });
    setNewSub('');
  };

  const toggleSub = (id: string, s: TaskStatus) => {
    updateTask.mutate({ id, dto: { status: s === 'DONE' ? 'TODO' : 'DONE' } });
  };

  // Привязать задачу к выбранному мероприятию: дочитываем его задачи и добавляем себя
  const linkToEvent = async (eventId: string) => {
    if (!eventId) return;
    const detail = await apiClient.get<{ tasks: { id: string }[] }>(`/api/timeblocks/${eventId}`);
    const ids = Array.from(new Set([...detail.tasks.map((t) => t.id), openTaskId]));
    updateBlock.mutate({ id: eventId, dto: { taskIds: ids } });
  };

  return (
    <Modal open={!!openTaskId} onClose={closeCards}>
      <div className={styles.card}>
        <div className={styles.header}>
          <input
            ref={titleRef}
            className={styles.titleInput}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название задачи"
          />
          <button className={styles.closeBtn} onClick={closeCards} title="Закрыть">
            ×
          </button>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Статус</label>
            <select
              className={styles.select}
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
            >
              {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Приоритет</label>
            <select
              className={styles.select}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            >
              <option value={0}>Обычный</option>
              <option value={1}>Низкий</option>
              <option value={2}>Средний</option>
              <option value={3}>Высокий</option>
            </select>
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Важность (Эйзенхауэр)</label>
            <select
              className={styles.select}
              value={importance}
              onChange={(e) => setImportance(Number(e.target.value))}
            >
              <option value={0}>Не важно</option>
              <option value={1}>Скорее не важно</option>
              <option value={2}>Важно</option>
              <option value={3}>Очень важно</option>
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Срочность</label>
            <label className={styles.allDayToggle}>
              <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
              срочно (требует действия сейчас)
            </label>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Лог (Bullet Journal)</label>
          <select
            className={styles.select}
            value={scope}
            onChange={(e) => setScope(e.target.value as TaskScope)}
          >
            <option value="day">📆 Дневной — на конкретный день</option>
            <option value="week">🗓 Недельный — на неделю</option>
            <option value="month">📅 Месячный — на месяц</option>
          </select>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>
              Дедлайн
              <label className={styles.allDayToggle}>
                <input
                  type="checkbox"
                  checked={dueAllDay}
                  onChange={(e) => toggleAllDay(e.target.checked)}
                />
                весь день
              </label>
            </label>
            <input
              type={dueAllDay ? 'date' : 'datetime-local'}
              className={styles.input}
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Повторяемость</label>
            <select
              className={styles.select}
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
            >
              {RECURRENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Время</label>
          <div className={styles.timeRow}>
            <div className={styles.timeField}>
              <span className={styles.timeCap}>оценка, мин</span>
              <input
                type="number"
                min={0}
                className={styles.timeInput}
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
                placeholder="—"
              />
            </div>
            <div className={styles.timeField}>
              <span className={styles.timeCap}>потрачено, мин</span>
              <input
                type="number"
                min={0}
                className={styles.timeInput}
                value={totalActual || ''}
                onChange={(e) => {
                  setActual(Number(e.target.value) || 0);
                  setRunningSince(null);
                }}
                placeholder="—"
              />
            </div>
            <button
              className={`${styles.timerBtn} ${runningSince !== null ? styles.timerBtnRun : ''}`}
              onClick={toggleTimer}
              title={runningSince !== null ? 'Остановить таймер' : 'Запустить таймер'}
            >
              {runningSince !== null
                ? `⏸ ${String(Math.floor(runningSec / 60)).padStart(2, '0')}:${String(runningSec % 60).padStart(2, '0')}`
                : '▶ Старт'}
            </button>
            <button
              className={`${styles.timerBtn} ${pomoEnd !== null ? styles.timerBtnRun : ''}`}
              onClick={() => setPomoEnd(pomoEnd !== null ? null : Date.now() + 25 * 60 * 1000)}
              title={pomoEnd !== null ? 'Прервать помодоро' : 'Фокус 25 минут (Pomodoro)'}
            >
              {pomoEnd !== null
                ? `🍅 ${String(Math.floor(Math.max(0, pomoEnd - nowTick) / 60000)).padStart(2, '0')}:${String(
                    Math.floor((Math.max(0, pomoEnd - nowTick) % 60000) / 1000),
                  ).padStart(2, '0')}`
                : '🍅 Фокус'}
            </button>
          </div>
          {estimate && totalActual > 0 && (
            <span className={styles.timeHint}>
              {totalActual <= Number(estimate)
                ? `в рамках оценки (${Math.round((totalActual / Number(estimate)) * 100)}%)`
                : `превышение оценки на ${totalActual - Number(estimate)} мин`}
            </span>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Комментарий</label>
          <textarea
            className={styles.textarea}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Заметки к задаче"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Зона / категория</label>
          <CategoryPicker value={categoryId} onChange={setCategoryId} />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Цель</label>
          <GoalPicker value={goalId} onChange={setGoalId} />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Теги</label>
          {tags.length > 0 && (
            <div className={styles.chips}>
              {tags.map((t) => (
                <span key={t} className={styles.chip} style={{ background: `${tagColor(t)}22`, color: tagColor(t) }}>
                  #{t}
                  <button onClick={() => setTags(tags.filter((x) => x !== t))}>×</button>
                </span>
              ))}
            </div>
          )}
          <div className={styles.addRow}>
            <input
              className={styles.input}
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder="например: работа, дом, важное"
            />
            <button className={styles.addBtn} onClick={addTag}>
              Добавить
            </button>
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.field}>
          <label className={styles.label}>
            Подзадачи
            {task && task.subtasks.length > 0 && (
              <span className={styles.subProgress}>
                <span className={styles.subBar}>
                  <span
                    className={styles.subFill}
                    style={{
                      width: `${Math.round(
                        (task.subtasks.filter((s) => s.status === 'DONE').length /
                          task.subtasks.length) *
                          100,
                      )}%`,
                    }}
                  />
                </span>
                {task.subtasks.filter((s) => s.status === 'DONE').length}/{task.subtasks.length}
              </span>
            )}
          </label>
          <div className={styles.list}>
            {task?.subtasks.length === 0 && <span className={styles.empty}>Нет подзадач</span>}
            {task?.subtasks.map((s) => (
              <div key={s.id} className={styles.taskRow}>
                <button
                  className={`${styles.check} ${s.status === 'DONE' ? styles.done : ''}`}
                  onClick={() => toggleSub(s.id, s.status)}
                >
                  {s.status === 'DONE' ? '✓' : ''}
                </button>
                <span className={`${styles.taskTitle} ${s.status === 'DONE' ? styles.done : ''}`}>
                  {s.title}
                </span>
                <button className={styles.removeBtn} onClick={() => deleteTask.mutate(s.id)}>
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className={styles.addRow}>
            <input
              className={styles.input}
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
              placeholder="Новая подзадача…"
            />
            <button className={styles.addBtn} onClick={addSubtask} disabled={createTask.isPending}>
              +
            </button>
          </div>
        </div>

        {openTaskId && <LinkedNotes taskId={openTaskId} />}

        <div className={styles.field}>
          <label className={styles.label}>Привязать к мероприятию</label>
          <select className={styles.select} value="" onChange={(e) => linkToEvent(e.target.value)}>
            <option value="" disabled>
              Выбрать мероприятие…
            </option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.footer}>
          <button className={styles.deleteBtn} onClick={handleDelete}>
            Удалить
          </button>
          <button className={styles.dupBtn} onClick={handleDuplicate} disabled={createTask.isPending} title="Создать копию задачи">
            ⧉ Дублировать
          </button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={updateTask.isPending}>
            Сохранить
          </button>
        </div>
      </div>
    </Modal>
  );
}
