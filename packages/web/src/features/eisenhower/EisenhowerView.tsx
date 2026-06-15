import { useMemo, useState, DragEvent } from 'react';
import { Task } from '@life-app/shared';
import { useTasks, useUpdateTask } from '../../api/tasks';
import { useUiStore } from '../../store/ui-store';
import { priorityColor } from '../../lib/priority';
import { tagColor } from '../../lib/tags';
import { dueBucket } from '../../lib/datetime';
import styles from './EisenhowerView.module.css';

// Квадрант = (важность, срочность). Важной считаем задачу с importance >= 2.
type QuadKey = 'do' | 'plan' | 'delegate' | 'drop';

interface QuadMeta {
  key: QuadKey;
  title: string;
  hint: string;
  important: boolean;
  urgent: boolean;
  color: string;
}

const QUADRANTS: QuadMeta[] = [
  { key: 'do', title: 'Сделать сейчас', hint: 'Важно и срочно', important: true, urgent: true, color: '#ff3b30' },
  { key: 'plan', title: 'Запланировать', hint: 'Важно, не срочно', important: true, urgent: false, color: '#34c759' },
  { key: 'delegate', title: 'Делегировать', hint: 'Срочно, не важно', important: false, urgent: true, color: '#ff9500' },
  { key: 'drop', title: 'Потом / удалить', hint: 'Не важно и не срочно', important: false, urgent: false, color: '#8e8e93' },
];

function quadOf(t: Task): QuadKey {
  const important = t.importance >= 2;
  if (important && t.urgent) return 'do';
  if (important && !t.urgent) return 'plan';
  if (!important && t.urgent) return 'delegate';
  return 'drop';
}

interface EisenhowerViewProps {
  // Доп. фильтр задач (например, по горизонту: день/месяц/год)
  taskFilter?: (t: Task) => boolean;
  // Встроенный режим (внутри Планера) — без крупной шапки
  embedded?: boolean;
}

export function EisenhowerView({ taskFilter, embedded }: EisenhowerViewProps = {}) {
  const { data: tasks = [], isLoading } = useTasks({ limit: 200 });
  const updateTask = useUpdateTask();
  const { openTask } = useUiStore();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overQuad, setOverQuad] = useState<QuadKey | null>(null);

  // Активные корневые задачи, разложенные по квадрантам
  const byQuad = useMemo(() => {
    const map: Record<QuadKey, Task[]> = { do: [], plan: [], delegate: [], drop: [] };
    tasks
      .filter((t) => !t.parentId && t.status !== 'DONE' && (!taskFilter || taskFilter(t)))
      .forEach((t) => map[quadOf(t)].push(t));
    for (const k of Object.keys(map) as QuadKey[]) {
      map[k].sort((a, b) => {
        const ad = a.dueAt ? new Date(a.dueAt).valueOf() : Infinity;
        const bd = b.dueAt ? new Date(b.dueAt).valueOf() : Infinity;
        if (ad !== bd) return ad - bd;
        return b.importance - a.importance;
      });
    }
    return map;
  }, [tasks, taskFilter]);

  const drop = (q: QuadMeta) => {
    setOverQuad(null);
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    // Целевое значение важности: важный квадрант → не ниже 2, иначе не выше 1
    const importance = q.important ? Math.max(task.importance, 2) : Math.min(task.importance, 1);
    if (importance === task.importance && q.urgent === task.urgent) return;
    updateTask.mutate({ id, dto: { importance, urgent: q.urgent } });
  };

  if (isLoading) return <div className={styles.loading}>Загрузка…</div>;

  const onDragStart = (e: DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className={`${styles.root} ${embedded ? styles.embedded : ''}`}>
      {!embedded && (
        <div className={styles.head}>
          <h2 className={styles.heading}>Матрица Эйзенхауэра</h2>
          <span className={styles.sub}>Перетащите задачу в нужный квадрант — важность и срочность обновятся</span>
        </div>
      )}
      <div className={styles.grid}>
        {QUADRANTS.map((q) => (
          <section
            key={q.key}
            className={`${styles.quad} ${overQuad === q.key ? styles.quadOver : ''}`}
            style={{ ['--quad' as string]: q.color }}
            onDragOver={(e) => {
              e.preventDefault();
              if (overQuad !== q.key) setOverQuad(q.key);
            }}
            onDragLeave={() => setOverQuad((cur) => (cur === q.key ? null : cur))}
            onDrop={() => drop(q)}
          >
            <header className={styles.quadHead}>
              <span className={styles.quadTitle}>{q.title}</span>
              <span className={styles.quadHint}>{q.hint}</span>
              <span className={styles.quadCount}>{byQuad[q.key].length}</span>
            </header>
            <ul className={styles.list}>
              {byQuad[q.key].length === 0 && <li className={styles.empty}>Пусто</li>}
              {byQuad[q.key].map((t) => (
                <li
                  key={t.id}
                  className={`${styles.item} ${dragId === t.id ? styles.dragging : ''}`}
                  draggable
                  onDragStart={(e) => onDragStart(e, t.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverQuad(null);
                  }}
                  onClick={() => openTask(t.id)}
                  title="Перетащите в другой квадрант или нажмите для редактирования"
                >
                  <span className={styles.dot} style={{ background: priorityColor(t.importance) }} />
                  <span className={styles.title}>{t.title}</span>
                  {t.dueAt && (
                    <span
                      className={`${styles.due} ${dueBucket(t.dueAt) === 'overdue' ? styles.overdue : ''}`}
                    >
                      {new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' }).format(
                        new Date(t.dueAt),
                      )}
                    </span>
                  )}
                  {t.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className={styles.tagDot} style={{ background: tagColor(tag) }} />
                  ))}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
