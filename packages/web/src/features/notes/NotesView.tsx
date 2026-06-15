import { useEffect, useMemo, useRef, useState } from 'react';
import { NoteWithAttachments } from '@life-app/shared';
import {
  useNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  useUploadAttachment,
  useDeleteAttachment,
} from '../../api/notes';
import { useTasks } from '../../api/tasks';
import { useTimeBlocks } from '../../api/timeblocks';
import { API_BASE } from '../../lib/api-client';
import { tagColor, normalizeTag } from '../../lib/tags';
import { addDays, startOfDay } from '../../lib/datetime';
import styles from './NotesView.module.css';

function fmtSize(n: number) {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} КБ`;
  return `${(n / 1024 / 1024).toFixed(1)} МБ`;
}
function isImage(mime: string) {
  return mime.startsWith('image/');
}
const fmtDate = (d: string | Date) =>
  new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d));

export function NotesView() {
  const { data: notes = [] } = useNotes();
  const createNote = useCreateNote();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const create = () =>
    createNote.mutate({ title: 'Новая заметка', content: '' }, { onSuccess: (n) => setSelectedId(n.id) });

  if (selectedId) {
    const note = notes.find((n) => n.id === selectedId);
    if (!note) {
      // заметка ещё не подгрузилась — покажем список
      return <NotesList notes={notes} onOpen={setSelectedId} onCreate={create} />;
    }
    return <NoteEditor note={note} onBack={() => setSelectedId(null)} />;
  }

  return <NotesList notes={notes} onOpen={setSelectedId} onCreate={create} />;
}

function NotesList({
  notes,
  onOpen,
  onCreate,
}: {
  notes: NoteWithAttachments[];
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const [filter, setFilter] = useState<string | null>(null);
  const allTags = useMemo(() => {
    const s = new Set<string>();
    notes.forEach((n) => n.tags.forEach((t) => s.add(t)));
    return [...s].sort();
  }, [notes]);
  const shown = filter ? notes.filter((n) => n.tags.includes(filter)) : notes;

  return (
    <div className={styles.root}>
      <div className={styles.listPage}>
        <div className={styles.listHead}>
          <h2 className={styles.pageTitle}>Заметки</h2>
          <button className={styles.newBtn} onClick={onCreate}>
            ＋ Новая
          </button>
        </div>

        {allTags.length > 0 && (
          <div className={styles.tagBar}>
            {allTags.map((t) => (
              <button
                key={t}
                className={`${styles.tagChip} ${filter === t ? styles.tagChipOn : ''}`}
                style={filter === t ? { background: tagColor(t), color: '#fff' } : { color: tagColor(t), background: `${tagColor(t)}1a` }}
                onClick={() => setFilter(filter === t ? null : t)}
              >
                #{t}
              </button>
            ))}
          </div>
        )}

        {shown.length === 0 && <p className={styles.empty}>Нет заметок. Создайте первую.</p>}
        <div className={styles.cards}>
          {shown.map((n) => (
            <button key={n.id} className={styles.card} onClick={() => onOpen(n.id)}>
              <span className={styles.cardTitle}>{n.title || 'Без названия'}</span>
              {n.content && <span className={styles.cardPreview}>{n.content.slice(0, 120)}</span>}
              <span className={styles.cardMeta}>
                {fmtDate(n.updatedAt)}
                {n.attachments.length > 0 && ` · 📎 ${n.attachments.length}`}
                {(n.taskId || n.timeBlockId) && ' · 🔗'}
              </span>
              {n.tags.length > 0 && (
                <span className={styles.cardTags}>
                  {n.tags.map((t) => (
                    <span key={t} className={styles.miniTag} style={{ background: `${tagColor(t)}22`, color: tagColor(t) }}>
                      #{t}
                    </span>
                  ))}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function NoteEditor({ note, onBack }: { note: NoteWithAttachments; onBack: () => void }) {
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const upload = useUploadAttachment();
  const delAtt = useDeleteAttachment();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [tags, setTags] = useState<string[]>(note.tags);
  const [tagDraft, setTagDraft] = useState('');
  const [taskId, setTaskId] = useState<string | null>(note.taskId);
  const [timeBlockId, setTimeBlockId] = useState<string | null>(note.timeBlockId);

  const { data: tasks = [] } = useTasks({ limit: 200 });
  const eventRange = useMemo(() => {
    const t = startOfDay(new Date());
    return { from: addDays(t, -90), to: addDays(t, 90) };
  }, []);
  const { data: events = [] } = useTimeBlocks(eventRange.from, eventRange.to);

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setTags(note.tags);
    setTaskId(note.taskId);
    setTimeBlockId(note.timeBlockId);
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const addTag = () => {
    const t = normalizeTag(tagDraft);
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagDraft('');
  };

  const save = () =>
    updateNote.mutate(
      { id: note.id, dto: { title, content, tags, taskId, timeBlockId } },
      { onSuccess: onBack },
    );

  const remove = () => deleteNote.mutate(note.id, { onSuccess: onBack });

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) upload.mutate({ noteId: note.id, file: f });
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className={styles.root}>
      <div className={styles.editorPage}>
        <div className={styles.editorTop}>
          <button className={styles.backBtn} onClick={onBack}>
            ‹ К списку
          </button>
          <div className={styles.topActions}>
            <button className={styles.deleteBtn} onClick={remove}>
              Удалить
            </button>
            <button className={styles.saveBtn} onClick={save} disabled={updateNote.isPending}>
              Сохранить
            </button>
          </div>
        </div>

        <input
          className={styles.titleInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Заголовок"
        />
        <textarea
          className={styles.contentInput}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Текст заметки…"
        />

        {/* Теги */}
        <div className={styles.section}>
          <label className={styles.label}>Теги</label>
          <div className={styles.chips}>
            {tags.map((t) => (
              <span key={t} className={styles.chip} style={{ background: `${tagColor(t)}22`, color: tagColor(t) }}>
                #{t}
                <button onClick={() => setTags(tags.filter((x) => x !== t))}>×</button>
              </span>
            ))}
            <input
              className={styles.tagInput}
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder="+ тег"
            />
          </div>
        </div>

        {/* Привязки */}
        <div className={styles.linkRow}>
          <label className={styles.linkField}>
            <span>Задача</span>
            <select className={styles.select} value={taskId ?? ''} onChange={(e) => setTaskId(e.target.value || null)}>
              <option value="">— нет —</option>
              {tasks
                .filter((t) => !t.parentId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
            </select>
          </label>
          <label className={styles.linkField}>
            <span>Мероприятие</span>
            <select className={styles.select} value={timeBlockId ?? ''} onChange={(e) => setTimeBlockId(e.target.value || null)}>
              <option value="">— нет —</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} ({fmtDate(ev.startAt)})
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Вложения */}
        <div className={styles.section}>
          <input ref={fileRef} type="file" hidden onChange={onFile} />
          <button className={styles.attachBtn} onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
            📎 Прикрепить файл
          </button>
          {note.attachments.length > 0 && (
            <div className={styles.attachments}>
              {note.attachments.map((a) => {
                const url = `${API_BASE}/uploads/${a.storedAs}`;
                return (
                  <div key={a.id} className={styles.att}>
                    {isImage(a.mimeType) ? (
                      <a href={url} target="_blank" rel="noreferrer">
                        <img src={url} className={styles.thumb} alt={a.filename} />
                      </a>
                    ) : (
                      <div className={styles.fileIcon}>📄</div>
                    )}
                    <a className={styles.attName} href={url} target="_blank" rel="noreferrer" download={a.filename}>
                      {a.filename}
                    </a>
                    <span className={styles.attSize}>{fmtSize(a.size)}</span>
                    <button className={styles.attDel} onClick={() => delAtt.mutate(a.id)}>
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
