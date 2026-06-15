import { useEffect, useMemo, useRef, useState } from 'react';
import { useTasks } from '../../api/tasks';
import { useTimeBlocks } from '../../api/timeblocks';
import { useNotes } from '../../api/notes';
import { useUiStore, UiMainView } from '../../store/ui-store';
import { Modal } from '../../components/Modal';
import { startOfDay, addDays } from '../../lib/datetime';
import styles from './CommandPalette.module.css';

interface Item {
  id: string;
  icon: string;
  label: string;
  sub?: string;
  action: () => void;
}

const NAV: { view: UiMainView; label: string; icon: string }[] = [
  { view: 'dashboard', label: 'Сегодня', icon: '🏠' },
  { view: 'calendar', label: 'Календарь', icon: '📅' },
  { view: 'planner', label: 'Планнер', icon: '🗓️' },
  { view: 'habits', label: 'Привычки', icon: '🔁' },
  { view: 'health', label: 'Здоровье', icon: '❤️' },
  { view: 'finance', label: 'Финансы', icon: '💰' },
  { view: 'goals', label: 'Цели', icon: '🎯' },
  { view: 'reflection', label: 'Рефлексия', icon: '📖' },
  { view: 'notes', label: 'Заметки', icon: '📝' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setMainView, openTask, openEvent, openCreator } = useUiStore();

  const range = useMemo(() => {
    const t = startOfDay(new Date());
    return { from: addDays(t, -30), to: addDays(t, 60) };
  }, []);
  const { data: tasks = [] } = useTasks({ limit: 200 });
  const { data: blocks = [] } = useTimeBlocks(range.from, range.to);
  const { data: notes = [] } = useNotes();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const go = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  const items: Item[] = useMemo(() => {
    const query = q.trim().toLowerCase();
    const out: Item[] = [];

    if (!query) {
      out.push(
        { id: 'create', icon: '＋', label: 'Создать задачу или мероприятие', action: () => openCreator() },
      );
      NAV.forEach((n) => out.push({ id: 'nav_' + n.view, icon: n.icon, label: n.label, sub: 'раздел', action: () => setMainView(n.view) }));
      return out;
    }

    // навигация по совпадению
    NAV.filter((n) => n.label.toLowerCase().includes(query)).forEach((n) =>
      out.push({ id: 'nav_' + n.view, icon: n.icon, label: n.label, sub: 'раздел', action: () => setMainView(n.view) }),
    );
    // задачи
    tasks
      .filter((t) => !t.parentId && t.title.toLowerCase().includes(query))
      .slice(0, 6)
      .forEach((t) => out.push({ id: 'task_' + t.id, icon: t.status === 'DONE' ? '✓' : '○', label: t.title, sub: 'задача', action: () => openTask(t.id) }));
    // мероприятия
    blocks
      .filter((b) => b.title.toLowerCase().includes(query))
      .slice(0, 6)
      .forEach((b) => out.push({ id: 'evt_' + b.id, icon: '📅', label: b.title, sub: 'мероприятие', action: () => openEvent(b.id) }));
    // заметки
    notes
      .filter((n) => (n.title + ' ' + n.content).toLowerCase().includes(query))
      .slice(0, 6)
      .forEach((n) => out.push({ id: 'note_' + n.id, icon: '📝', label: n.title || 'Без названия', sub: 'заметка', action: () => setMainView('notes') }));

    return out;
  }, [q, tasks, blocks, notes, setMainView, openTask, openEvent, openCreator]);

  const clampedSel = Math.min(sel, Math.max(0, items.length - 1));

  return (
    <Modal open={open} onClose={() => setOpen(false)}>
      <div className={styles.box}>
        <input
          ref={inputRef}
          className={styles.input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSel(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSel((s) => Math.min(items.length - 1, s + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSel((s) => Math.max(0, s - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const it = items[clampedSel];
              if (it) go(it.action);
            }
          }}
          placeholder="Поиск и команды… (задачи, мероприятия, заметки, разделы)"
        />
        <div className={styles.list}>
          {items.length === 0 && <p className={styles.empty}>Ничего не найдено</p>}
          {items.map((it, i) => (
            <button
              key={it.id}
              className={`${styles.item} ${i === clampedSel ? styles.itemOn : ''}`}
              onMouseEnter={() => setSel(i)}
              onClick={() => go(it.action)}
            >
              <span className={styles.itemIcon}>{it.icon}</span>
              <span className={styles.itemLabel}>{it.label}</span>
              {it.sub && <span className={styles.itemSub}>{it.sub}</span>}
            </button>
          ))}
        </div>
        <div className={styles.hint}>↑↓ выбор · Enter открыть · Esc закрыть · ⌘/Ctrl+K вызов</div>
      </div>
    </Modal>
  );
}
