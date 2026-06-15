import { useState } from 'react';
import { useNotes, useCreateNote } from '../../api/notes';
import { useUiStore } from '../../store/ui-store';
import styles from './Card.module.css';

export function LinkedNotes({ taskId, timeBlockId }: { taskId?: string; timeBlockId?: string }) {
  const filter = taskId ? { taskId } : { timeBlockId };
  const { data: notes = [] } = useNotes(filter);
  const createNote = useCreateNote();
  const setMainView = useUiStore((s) => s.setMainView);
  const closeCards = useUiStore((s) => s.closeCards);
  const [draft, setDraft] = useState('');

  const add = () => {
    const t = draft.trim();
    if (!t) return;
    createNote.mutate({ title: t, ...filter });
    setDraft('');
  };

  const openNotes = () => {
    closeCards();
    setMainView('notes');
  };

  return (
    <div className={styles.field}>
      <label className={styles.label}>
        Заметки
        {notes.length > 0 && (
          <button className={styles.linkBtn} onClick={openNotes}>
            открыть раздел →
          </button>
        )}
      </label>
      <div className={styles.list}>
        {notes.map((n) => (
          <button key={n.id} className={styles.noteRow} onClick={openNotes}>
            📝 {n.title || 'Без названия'}
            {n.attachments.length > 0 && <span className={styles.noteAtt}>📎 {n.attachments.length}</span>}
          </button>
        ))}
      </div>
      <div className={styles.addRow}>
        <input
          className={styles.input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Новая связанная заметка…"
        />
        <button className={styles.addBtn} onClick={add}>
          +
        </button>
      </div>
    </div>
  );
}
