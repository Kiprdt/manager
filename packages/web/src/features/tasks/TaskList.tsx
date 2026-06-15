import { useEffect, useMemo, useRef, useState } from 'react';
import { Draggable } from '@fullcalendar/interaction';
import { Task } from '@life-app/shared';
import { useTasks, useUpdateTask, useDeleteTask } from '../../api/tasks';
import { useUiStore } from '../../store/ui-store';
import { DueBucket, dueBucket, startOfDay } from '../../lib/datetime';
import { tagColor } from '../../lib/tags';
import { priorityColor } from '../../lib/priority';
import styles from './TaskList.module.css';

const BUCKET_LABELS: Record<DueBucket, string> = {
  overdue: 'Просрочено',
  today: 'Сегодня',
  soon: 'Скоро (7 дней)',
  later: 'Позже',
  none: 'Без даты',
};
const BUCKET_ORDER: DueBucket[] = ['overdue', 'today', 'soon', 'later', 'none'];

export function TaskList() {
  const { data: tasks = [], isLoading } = useTasks({ limit: 200 });
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { setSelectedTask, selectedTaskId, openTask, openCreator } = useUiStore();
  const [showDone, setShowDone] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  // Делаем строки задач источником внешнего перетаскивания для календаря (тайм-блокинг)
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scrollRef.current) return;
    const draggable = new Draggable(scrollRef.current, {
      itemSelector: '.fc-task-drag',
    });
    return () => draggable.destroy();
  }, []);

  // Все теги активных задач — для фильтра
  const allTags = useMemo(() => {
    const set = new Set<string>();
    tasks.filter((t) => !t.parentId).forEach((t) => t.tags.forEach((tag) => set.add(tag)));
    return [...set].sort();
  }, [tasks]);

  const matchesTag = (t: Task) => !tagFilter || t.tags.includes(tagFilter);

  // Группировка по дедлайну (без подзадач, активные)
  const groups = useMemo(() => {
    const map: Record<DueBucket, Task[]> = {
      overdue: [],
      today: [],
      soon: [],
      later: [],
      none: [],
    };
    tasks
      .filter((t) => !t.parentId && t.status !== 'DONE' && (!tagFilter || t.tags.includes(tagFilter)))
      .forEach((t) => map[dueBucket(t.dueAt)].push(t));
    // внутри группы — по дедлайну, затем приоритету
    for (const k of BUCKET_ORDER) {
      map[k].sort((a, b) => {
        const ad = a.dueAt ? new Date(a.dueAt).valueOf() : Infinity;
        const bd = b.dueAt ? new Date(b.dueAt).valueOf() : Infinity;
        if (ad !== bd) return ad - bd;
        return b.priority - a.priority;
      });
    }
    return map;
  }, [tasks]);

  const doneTasks = useMemo(
    () => tasks.filter((t) => !t.parentId && t.status === 'DONE' && matchesTag(t)),
    [tasks, tagFilter],
  );

  if (isLoading) return <div className={styles.loading}>Загрузка задач…</div>;

  const toggle = (t: Task) =>
    updateTask.mutate({ id: t.id, dto: { status: t.status === 'DONE' ? 'TODO' : 'DONE' } });

  const moveToToday = (t: Task) =>
    updateTask.mutate({ id: t.id, dto: { dueAt: startOfDay(new Date()), dueAllDay: t.dueAllDay } });

  const renderTask = (task: Task, overdue: boolean) => (
    <li
      key={task.id}
      className={`${styles.item} fc-task-drag ${task.id === selectedTaskId ? styles.selected : ''}`}
      data-task-id={task.id}
      data-task-title={task.title}
      data-task-minutes={task.estimatedMinutes ?? ''}
      title="Перетащите на календарь, чтобы запланировать время"
      onClick={() => {
        setSelectedTask(task.id);
        openTask(task.id);
      }}
    >
      <button
        className={`${styles.check} ${task.status === 'DONE' ? styles.checkDone : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          toggle(task);
        }}
        title="Отметить выполненной"
      >
        {task.status === 'DONE' ? '✓' : ''}
      </button>
      <span
        className={styles.priority}
        style={{ background: priorityColor(task.priority) }}
        title={`Приоритет ${task.priority}`}
      />
      <span className={styles.title}>{task.title}</span>
      {task.tags.slice(0, 2).map((tag) => (
        <span key={tag} className={styles.tagDot} style={{ background: tagColor(tag) }} title={`#${tag}`} />
      ))}
      {overdue && (
        <button
          className={styles.moveBtn}
          onClick={(e) => {
            e.stopPropagation();
            moveToToday(task);
          }}
          title="Перенести на сегодня"
        >
          → сегодня
        </button>
      )}
      <button
        className={styles.deleteBtn}
        onClick={(e) => {
          e.stopPropagation();
          deleteTask.mutate(task.id);
        }}
        title="Удалить"
      >
        ×
      </button>
    </li>
  );

  return (
    <div className={styles.root}>
      <div className={styles.headerRow}>
        <h2 className={styles.heading}>Задачи</h2>
        <button
          className={styles.addBtn}
          onClick={() => openCreator()}
          title="Создать задачу или мероприятие"
        >
          +
        </button>
      </div>

      {allTags.length > 0 && (
        <div className={styles.tagBar}>
          {allTags.map((tag) => (
            <button
              key={tag}
              className={`${styles.tagChip} ${tagFilter === tag ? styles.tagChipActive : ''}`}
              style={
                tagFilter === tag
                  ? { background: tagColor(tag), color: '#fff' }
                  : { color: tagColor(tag), background: `${tagColor(tag)}1a` }
              }
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      <div className={styles.scroll} ref={scrollRef}>
        {BUCKET_ORDER.filter((b) => groups[b].length > 0).map((b) => (
          <section key={b} className={styles.group}>
            <h3 className={`${styles.groupTitle} ${b === 'overdue' ? styles.overdueTitle : ''}`}>
              {BUCKET_LABELS[b]}
              <span className={styles.count}>{groups[b].length}</span>
            </h3>
            <ul className={`${styles.list} ${b === 'overdue' ? styles.overdueList : ''}`}>
              {groups[b].map((t) => renderTask(t, b === 'overdue'))}
            </ul>
          </section>
        ))}

        {tasks.filter((t) => !t.parentId && t.status !== 'DONE').length === 0 && (
          <p className={styles.emptyAll}>Нет активных задач 🎉</p>
        )}

        {doneTasks.length > 0 && (
          <section className={styles.group}>
            <button className={styles.doneToggle} onClick={() => setShowDone((v) => !v)}>
              {showDone ? '▾' : '▸'} Выполнено ({doneTasks.length})
            </button>
            {showDone && <ul className={styles.list}>{doneTasks.map((t) => renderTask(t, false))}</ul>}
          </section>
        )}
      </div>
    </div>
  );
}
