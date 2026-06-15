import { useEffect, useRef, useState } from 'react';
import { TaskStatus } from '@life-app/shared';
import {
  useTimeBlock,
  useUpdateTimeBlock,
  useDeleteTimeBlock,
  useCreateTimeBlock,
} from '../../api/timeblocks';
import { useTasks, useCreateTask, useUpdateTask } from '../../api/tasks';
import { useUiStore } from '../../store/ui-store';
import { Modal } from '../../components/Modal';
import { toLocalInput, fromLocalInput, formatRange } from '../../lib/datetime';
import { CategoryPicker } from './CategoryPicker';
import { LinkedNotes } from './LinkedNotes';
import { tagColor, normalizeTag } from '../../lib/tags';
import styles from './Card.module.css';

export function EventCard() {
  const { openEventId, closeCards, openEvent } = useUiStore();
  const { data: event } = useTimeBlock(openEventId);
  const updateBlock = useUpdateTimeBlock();
  const deleteBlock = useDeleteTimeBlock();
  const createBlock = useCreateTimeBlock();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const { data: allTasks = [] } = useTasks({ limit: 200 });

  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [attendees, setAttendees] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [recurrence, setRecurrence] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [emailDraft, setEmailDraft] = useState('');
  const [newTask, setNewTask] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!event) return;
    setTitle(event.title);
    // Сразу даём задать название — фокус и выделение текста
    requestAnimationFrame(() => {
      titleRef.current?.focus();
      titleRef.current?.select();
    });
    setStart(toLocalInput(new Date(event.startAt)));
    setEnd(toLocalInput(new Date(event.endAt)));
    setLocation(event.location ?? '');
    setNotes(event.notes ?? '');
    setAttendees(event.attendees ?? []);
    setCategoryId(event.categoryId ?? null);
    setRecurrence(event.recurrenceRule ?? '');
    setTags(event.tags ?? []);
  }, [event?.id]);

  if (!openEventId) return null;

  const linkedIds = new Set(event?.tasks.map((t) => t.id) ?? []);
  const attachable = allTasks.filter((t) => !linkedIds.has(t.id) && !t.parentId);

  const addEmail = () => {
    const e = emailDraft.trim();
    if (!e || attendees.includes(e)) return;
    setAttendees([...attendees, e]);
    setEmailDraft('');
  };

  const handleSave = () => {
    const s = fromLocalInput(start);
    const en = fromLocalInput(end);
    if (!title.trim() || !s || !en) return;
    updateBlock.mutate(
      {
        id: openEventId,
        dto: {
          title: title.trim(),
          startAt: s,
          endAt: en,
          location: location.trim() || null,
          notes: notes.trim() || null,
          attendees,
          categoryId,
          recurrenceRule: recurrence || null,
          tags,
        },
      },
      { onSuccess: closeCards },
    );
  };

  const handleDelete = () => {
    if (confirm(`Удалить мероприятие «${event?.title}»?`)) {
      deleteBlock.mutate(openEventId, { onSuccess: closeCards });
    }
  };

  // Дублировать мероприятие — копия на СЛЕДУЮЩИЙ день (то же время), открываем для правки
  const handleDuplicate = () => {
    const s0 = fromLocalInput(start);
    const en0 = fromLocalInput(end);
    if (!title.trim() || !s0 || !en0) return;
    const DAY = 24 * 60 * 60 * 1000;
    const s = new Date(s0.valueOf() + DAY);
    const en = new Date(en0.valueOf() + DAY);
    createBlock.mutate(
      {
        title: `${title.trim()} (копия)`,
        startAt: s,
        endAt: en,
        location: location.trim() || null,
        notes: notes.trim() || null,
        attendees,
        categoryId,
        recurrenceRule: recurrence || null,
        tags,
      },
      { onSuccess: (blk) => openEvent(blk.id) },
    );
  };

  const createInlineTask = () => {
    const t = newTask.trim();
    if (!t) return;
    // Дедлайн новой задачи = конец мероприятия, привязка — к этому мероприятию
    createTask.mutate({
      title: t,
      eventId: openEventId,
      ...(event ? { dueAt: new Date(event.endAt) } : {}),
    });
    setNewTask('');
  };

  const attachExisting = (taskId: string) => {
    if (!taskId) return;
    const ids = [...linkedIds, taskId];
    updateBlock.mutate({ id: openEventId, dto: { taskIds: ids } });
  };

  const unlink = (taskId: string) => {
    const ids = [...linkedIds].filter((id) => id !== taskId);
    updateBlock.mutate({ id: openEventId, dto: { taskIds: ids } });
  };

  const toggleTask = (taskId: string, status: TaskStatus) => {
    updateTask.mutate({
      id: taskId,
      dto: { status: status === 'DONE' ? 'TODO' : 'DONE' },
    });
  };

  return (
    <Modal open={!!openEventId} onClose={closeCards}>
      <div className={styles.card}>
        <div className={styles.header}>
          <input
            ref={titleRef}
            className={styles.titleInput}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название мероприятия"
          />
          <button className={styles.closeBtn} onClick={closeCards} title="Закрыть">
            ×
          </button>
        </div>

        {event && (
          <div className={styles.meta}>
            {formatRange(new Date(event.startAt), new Date(event.endAt))}
          </div>
        )}

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Начало</label>
            <input
              type="datetime-local"
              className={styles.input}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Конец</label>
            <input
              type="datetime-local"
              className={styles.input}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Место</label>
          <input
            className={styles.input}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Необязательно — где проходит"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Зона / категория</label>
          <CategoryPicker value={categoryId} onChange={setCategoryId} />
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const t = normalizeTag(tagDraft);
                  if (t && !tags.includes(t)) setTags([...tags, t]);
                  setTagDraft('');
                }
              }}
              placeholder="напр.: тренировка"
            />
            <button
              className={styles.addBtn}
              onClick={() => {
                const t = normalizeTag(tagDraft);
                if (t && !tags.includes(t)) setTags([...tags, t]);
                setTagDraft('');
              }}
            >
              +
            </button>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Повторяемость</label>
          <select className={styles.select} value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
            <option value="">Не повторять</option>
            <option value="FREQ=DAILY">Ежедневно</option>
            <option value="FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR">По будням</option>
            <option value="FREQ=WEEKLY">Еженедельно</option>
            <option value="FREQ=WEEKLY;INTERVAL=2">Раз в 2 недели</option>
            <option value="FREQ=MONTHLY">Ежемесячно</option>
            <option value="FREQ=YEARLY">Ежегодно</option>
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Комментарий</label>
          <textarea
            className={styles.textarea}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Заметки к мероприятию"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Участники</label>
          {attendees.length > 0 && (
            <div className={styles.chips}>
              {attendees.map((e) => (
                <span key={e} className={styles.chip}>
                  {e}
                  <button onClick={() => setAttendees(attendees.filter((x) => x !== e))}>×</button>
                </span>
              ))}
            </div>
          )}
          <div className={styles.addRow}>
            <input
              type="email"
              className={styles.input}
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())}
              placeholder="email@пример.рф"
            />
            <button className={styles.addBtn} onClick={addEmail}>
              Добавить
            </button>
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.field}>
          <label className={styles.label}>Задачи мероприятия</label>
          <div className={styles.list}>
            {event?.tasks.length === 0 && (
              <span className={styles.empty}>Пока нет привязанных задач</span>
            )}
            {event?.tasks.map((t) => (
              <div key={t.id} className={styles.taskRow}>
                <button
                  className={`${styles.check} ${t.status === 'DONE' ? styles.done : ''}`}
                  onClick={() => toggleTask(t.id, t.status)}
                  title="Готово"
                >
                  {t.status === 'DONE' ? '✓' : ''}
                </button>
                <span className={`${styles.taskTitle} ${t.status === 'DONE' ? styles.done : ''}`}>
                  {t.title}
                </span>
                <button className={styles.removeBtn} onClick={() => unlink(t.id)} title="Отвязать">
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className={styles.addRow}>
            <input
              className={styles.input}
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createInlineTask()}
              placeholder="Новая задача в этом мероприятии…"
            />
            <button
              className={styles.addBtn}
              onClick={createInlineTask}
              disabled={createTask.isPending}
            >
              + Задача
            </button>
          </div>

          {attachable.length > 0 && (
            <select
              className={styles.select}
              value=""
              onChange={(e) => attachExisting(e.target.value)}
            >
              <option value="" disabled>
                Привязать существующую задачу…
              </option>
              {attachable.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          )}
        </div>

        {openEventId && <LinkedNotes timeBlockId={openEventId} />}

        <div className={styles.footer}>
          <button className={styles.deleteBtn} onClick={handleDelete}>
            Удалить
          </button>
          <button className={styles.dupBtn} onClick={handleDuplicate} disabled={createBlock.isPending} title="Создать копию мероприятия">
            ⧉ Дублировать
          </button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={updateBlock.isPending}>
            Сохранить
          </button>
        </div>
      </div>
    </Modal>
  );
}
