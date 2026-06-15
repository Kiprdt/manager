import { useMemo, useState } from 'react';
import { Goal, Task } from '@life-app/shared';
import { useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal } from '../../api/goals';
import { useTasks, useUpdateTask, useCreateTask } from '../../api/tasks';
import { useUiStore } from '../../store/ui-store';
import { startOfDay, fromDateInput } from '../../lib/datetime';
import { priorityColor } from '../../lib/priority';
import styles from './GoalsView.module.css';

const PRIORITY_LABEL = ['без', 'низкий', 'средний', 'высокий'];

function fmtDue(d: Date): string {
  return new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

export function GoalsView() {
  const { data: goals = [] } = useGoals();
  const { data: tasks = [] } = useTasks({ limit: 200 });
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const del = useDeleteGoal();
  const updateTask = useUpdateTask();
  const createTask = useCreateTask();
  const { openTask } = useUiStore();

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState(2);
  const [due, setDue] = useState('');
  const [comment, setComment] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newTask, setNewTask] = useState('');

  const tasksByGoal = useMemo(() => {
    const m = new Map<string, Task[]>();
    tasks.filter((t) => t.goalId).forEach((t) => {
      const arr = m.get(t.goalId!) ?? [];
      arr.push(t);
      m.set(t.goalId!, arr);
    });
    return m;
  }, [tasks]);

  const unlinkedTasks = useMemo(() => tasks.filter((t) => !t.goalId && !t.parentId), [tasks]);
  const today = startOfDay(new Date());

  const add = () => {
    if (!title.trim()) return;
    create.mutate({
      title: title.trim(),
      priority,
      dueAt: due ? fromDateInput(due) : null,
      notes: comment.trim() || null,
    });
    setTitle('');
    setDue('');
    setComment('');
  };

  const cyclePriority = (g: Goal) =>
    update.mutate({ id: g.id, dto: { priority: (g.priority + 1) % 4 } });

  const addTaskToGoal = (goalId: string) => {
    const t = newTask.trim();
    if (!t) return;
    createTask.mutate({ title: t, goalId });
    setNewTask('');
  };

  return (
    <div className={styles.root}>
      <div className={styles.sheet}>
        <header className={styles.head}>
          <h2 className={styles.title}>Цели</h2>
          <span className={styles.count}>{goals.length}</span>
        </header>

        <div className={styles.addBox}>
          <input
            className={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Название цели…"
          />
          <select className={styles.sel} value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
            <option value={3}>!!! высокий</option>
            <option value={2}>!! средний</option>
            <option value={1}>! низкий</option>
            <option value={0}>— без</option>
          </select>
          <input
            type="date"
            className={styles.date}
            value={due}
            onChange={(e) => setDue(e.target.value)}
            title="Планируемый срок"
          />
          <button className={styles.addBtn} onClick={add} disabled={create.isPending}>
            Добавить
          </button>
          <input
            className={styles.comment}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Комментарий (необязательно)"
          />
        </div>

        <div className={styles.list}>
          {goals.length === 0 && <p className={styles.empty}>Целей пока нет</p>}
          {goals.map((g) => {
            const linked = tasksByGoal.get(g.id) ?? [];
            const doneCount = linked.filter((t) => t.status === 'DONE').length;
            const overdue = g.dueAt && !g.done && new Date(g.dueAt) < today;
            const isOpen = expanded === g.id;
            return (
              <div
                key={g.id}
                className={`${styles.goal} ${g.done ? styles.goalDone : ''}`}
                style={{ borderLeftColor: priorityColor(g.priority) }}
              >
                <div className={styles.goalMain}>
                  <button
                    className={styles.prio}
                    style={{ color: priorityColor(g.priority) }}
                    onClick={() => cyclePriority(g)}
                    title={`Приоритет: ${PRIORITY_LABEL[g.priority]} (клик — сменить)`}
                  >
                    {'!'.repeat(g.priority) || '○'}
                  </button>

                  <div className={styles.bodyCol}>
                    <div className={styles.line}>
                      <span className={styles.gtitle}>{g.title}</span>
                      {g.dueAt && (
                        <span className={`${styles.due} ${overdue ? styles.overdue : ''}`}>
                          до {fmtDue(new Date(g.dueAt))}
                        </span>
                      )}
                    </div>
                    {g.notes && <p className={styles.notes}>{g.notes}</p>}
                    <button className={styles.linkToggle} onClick={() => setExpanded(isOpen ? null : g.id)}>
                      {isOpen ? '▾' : '▸'} Связанные задачи
                      {linked.length > 0 && (
                        <span className={styles.linkCount}>
                          {doneCount}/{linked.length}
                        </span>
                      )}
                    </button>
                  </div>

                  <button
                    className={styles.doneBtn}
                    title={g.done ? 'Снять отметку' : 'Цель достигнута'}
                    onClick={() => update.mutate({ id: g.id, dto: { done: !g.done } })}
                  >
                    {g.done ? '✓' : '○'}
                  </button>
                  <button className={styles.del} onClick={() => del.mutate(g.id)} title="Удалить">
                    ×
                  </button>
                </div>

                {isOpen && (
                  <div className={styles.linkPanel}>
                    {linked.length === 0 && <p className={styles.linkEmpty}>Нет связанных задач</p>}
                    {linked.map((t) => (
                      <div key={t.id} className={styles.linkRow}>
                        <span className={`${styles.linkDot} ${t.status === 'DONE' ? styles.linkDotDone : ''}`} />
                        <button
                          className={`${styles.linkTitle} ${t.status === 'DONE' ? styles.linkDone : ''}`}
                          onClick={() => openTask(t.id)}
                        >
                          {t.title}
                        </button>
                        <button
                          className={styles.unlink}
                          title="Отвязать от цели"
                          onClick={() => updateTask.mutate({ id: t.id, dto: { goalId: null } })}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <div className={styles.linkAdd}>
                      <input
                        className={styles.linkInput}
                        value={isOpen ? newTask : ''}
                        onChange={(e) => setNewTask(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addTaskToGoal(g.id)}
                        placeholder="Новая задача к цели…"
                      />
                      <select
                        className={styles.linkSel}
                        value=""
                        onChange={(e) => {
                          if (e.target.value) updateTask.mutate({ id: e.target.value, dto: { goalId: g.id } });
                        }}
                      >
                        <option value="">+ привязать существующую…</option>
                        {unlinkedTasks.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
