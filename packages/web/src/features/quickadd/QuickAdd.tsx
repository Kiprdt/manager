import { useState } from 'react';
import { useCreateTask } from '../../api/tasks';
import { useCreateTimeBlock } from '../../api/timeblocks';
import { Modal } from '../../components/Modal';
import { parseQuickAdd } from '../../lib/quickparse';
import { tagColor } from '../../lib/tags';
import styles from './QuickAdd.module.css';

const PRIORITY_LABEL = ['обычный', 'низкий', 'средний', 'высокий'];
const EVENT_DEFAULT_MIN = 60; // длительность мероприятия по умолчанию
const DAY_MS = 24 * 60 * 60 * 1000;

type Mode = 'task' | 'event';

export function QuickAdd() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('task');
  const [text, setText] = useState('');
  const createTask = useCreateTask();
  const createBlock = useCreateTimeBlock();

  const parsed = parseQuickAdd(text);
  const pending = createTask.isPending || createBlock.isPending;

  const fmt = (d: Date, allDay: boolean) =>
    new Intl.DateTimeFormat('ru', {
      day: 'numeric',
      month: 'short',
      ...(allDay ? {} : { hour: '2-digit', minute: '2-digit' }),
    }).format(d);

  const reset = () => {
    setText('');
    setOpen(false);
  };

  const submit = () => {
    if (!parsed.title) return;
    if (mode === 'task') {
      // Задача НЕ создаёт блок в календаре — только запись в списке задач
      createTask.mutate(
        {
          title: parsed.title,
          priority: parsed.priority,
          importance: parsed.priority >= 2 ? parsed.priority : undefined,
          tags: parsed.tags,
          ...(parsed.dueAt ? { dueAt: parsed.dueAt, dueAllDay: parsed.dueAllDay } : {}),
        },
        { onSuccess: reset },
      );
      return;
    }
    // Мероприятие → блок в календаре на распарсенное время
    const start = parsed.dueAt ?? new Date();
    const isAllDay = parsed.dueAllDay;
    const end = isAllDay
      ? new Date(start.valueOf() + DAY_MS)
      : new Date(start.valueOf() + EVENT_DEFAULT_MIN * 60 * 1000);
    createBlock.mutate(
      {
        title: parsed.title,
        startAt: start,
        endAt: end,
        isAllDay,
        ...(parsed.tags.length ? { tags: parsed.tags } : {}),
      },
      { onSuccess: reset },
    );
  };

  return (
    <>
      <button className={styles.trigger} onClick={() => setOpen(true)} title="Быстрое добавление (естественный язык)">
        ＋
      </button>

      <Modal open={open} onClose={() => setOpen(false)}>
        <div className={styles.box}>
          <div className={styles.modeSwitch}>
            <button
              className={`${styles.modeBtn} ${mode === 'task' ? styles.modeActive : ''}`}
              onClick={() => setMode('task')}
            >
              ✓ Задача
            </button>
            <button
              className={`${styles.modeBtn} ${mode === 'event' ? styles.modeActive : ''}`}
              onClick={() => setMode('event')}
            >
              📅 Мероприятие
            </button>
          </div>

          <input
            autoFocus
            className={styles.input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') setOpen(false);
            }}
            placeholder={
              mode === 'task'
                ? 'Напр.: позвонить маме завтра в 18:00 #дом p1'
                : 'Напр.: встреча с командой завтра в 15:00 #работа'
            }
          />

          {text.trim() && (
            <div className={styles.preview}>
              <span className={styles.previewTitle}>{parsed.title || '…'}</span>
              <div className={styles.chips}>
                {parsed.dueAt && (
                  <span className={styles.chipDate}>
                    {mode === 'event' ? '🕒' : '📅'} {fmt(parsed.dueAt, parsed.dueAllDay)}
                    {mode === 'event' && !parsed.dueAllDay && ` (${EVENT_DEFAULT_MIN} мин)`}
                  </span>
                )}
                {mode === 'task' && parsed.priority > 0 && (
                  <span className={styles.chipPrio}>❗ {PRIORITY_LABEL[parsed.priority]}</span>
                )}
                {parsed.tags.map((t) => (
                  <span key={t} className={styles.chipTag} style={{ background: `${tagColor(t)}22`, color: tagColor(t) }}>
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className={styles.hint}>
            {mode === 'event'
              ? 'Мероприятие попадёт в календарь блоком. Поддерживается: завтра, в пятницу, в 18:00, #тег'
              : 'Задача попадёт только в список задач. Поддерживается: сегодня/завтра, в пятницу, через 3 дня, 25.12, в 18:00, #тег, p1–p4'}
          </div>

          <div className={styles.actions}>
            <button className={styles.cancel} onClick={() => setOpen(false)}>
              Отмена
            </button>
            <button className={styles.add} onClick={submit} disabled={!parsed.title || pending}>
              Добавить
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
