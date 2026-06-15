import { useEffect, useMemo, useState } from 'react';
import { useReflections, useUpsertReflection } from '../../api/reflections';
import { useTasks } from '../../api/tasks';
import { useTimeBlocks } from '../../api/timeblocks';
import {
  startOfDay,
  addDays,
  isSameDay,
  toDateInput,
  fromDateInput,
  formatDayTitle,
} from '../../lib/datetime';
import { downloadReport } from '../../lib/report';
import styles from './ReflectionView.module.css';

export function ReflectionView() {
  const [selectedDay, setSelectedDay] = useState<Date>(() => startOfDay(new Date()));
  const today = useMemo(() => startOfDay(new Date()), []);

  // ── Левый список: диапазон дат + поиск по словам ──
  const [query, setQuery] = useState('');
  const [listFrom, setListFrom] = useState(() => toDateInput(addDays(today, -180)));
  const [listTo, setListTo] = useState(() => toDateInput(today));
  const lf = fromDateInput(listFrom) ?? addDays(today, -180);
  const lt = fromDateInput(listTo) ?? today;
  const { data: listRefs = [] } = useReflections(lf, addDays(lt, 1));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return listRefs
      .filter((r) => r.text.trim() !== '' && (!q || r.text.toLowerCase().includes(q)))
      .sort((a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf());
  }, [listRefs, query]);

  // ── Выбранная заметка (отдельный запрос — независимо от списка) ──
  const { data: dayRefs = [] } = useReflections(selectedDay, addDays(selectedDay, 1));
  const dayRef = dayRefs.find((r) => isSameDay(new Date(r.date), selectedDay));
  const upsert = useUpsertReflection();

  const [text, setText] = useState('');
  useEffect(() => {
    setText(dayRef?.text ?? '');
  }, [selectedDay, dayRef?.id, dayRef?.text]);

  const save = () => upsert.mutate({ date: selectedDay, text });
  const isToday = isSameDay(selectedDay, today);

  // ── Отчёт PDF ──
  const todayStr = toDateInput(today);
  const [rFrom, setRFrom] = useState(() => toDateInput(addDays(today, -6)));
  const [rTo, setRTo] = useState(todayStr);
  const reportFrom = fromDateInput(rFrom) ?? today;
  const reportTo = fromDateInput(rTo) ?? today;
  const { data: rTasks = [] } = useTasks({ limit: 200 });
  const { data: rBlocks = [] } = useTimeBlocks(reportFrom, addDays(reportTo, 1));
  const { data: rRefs = [] } = useReflections(reportFrom, addDays(reportTo, 1));
  const [busy, setBusy] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const makePdf = async () => {
    setBusy(true);
    try {
      await downloadReport(
        { from: reportFrom, to: reportTo, tasks: rTasks, blocks: rBlocks, reflections: rRefs },
        `Отчёт_${rFrom}_${rTo}.pdf`,
      );
    } finally {
      setBusy(false);
    }
  };

  // Подсветка совпадения в сниппете
  const snippet = (txt: string): string => {
    const q = query.trim().toLowerCase();
    if (!q) return txt.slice(0, 100);
    const i = txt.toLowerCase().indexOf(q);
    if (i < 0) return txt.slice(0, 100);
    const start = Math.max(0, i - 30);
    return (start > 0 ? '…' : '') + txt.slice(start, start + 100);
  };

  return (
    <div className={styles.root}>
      {/* Левая панель — список заметок */}
      <aside className={styles.left}>
        <div className={styles.searchBox}>
          <input
            className={styles.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 Поиск по словам…"
          />
          <div className={styles.dateFilter}>
            <input type="date" className={styles.dateInput} value={listFrom} max={listTo} onChange={(e) => setListFrom(e.target.value)} />
            <span className={styles.dash}>—</span>
            <input type="date" className={styles.dateInput} value={listTo} min={listFrom} max={todayStr} onChange={(e) => setListTo(e.target.value)} />
          </div>
        </div>

        <div className={styles.list}>
          {filtered.length === 0 && (
            <p className={styles.empty}>{query ? 'Ничего не найдено' : 'Записей пока нет'}</p>
          )}
          {filtered.map((r) => {
            const d = new Date(r.date);
            return (
              <button
                key={r.id}
                className={`${styles.item} ${isSameDay(d, selectedDay) ? styles.itemActive : ''}`}
                onClick={() => setSelectedDay(startOfDay(d))}
              >
                <span className={styles.itemDate}>
                  {new Intl.DateTimeFormat('ru', { day: '2-digit', month: 'short', year: '2-digit' }).format(d)}
                </span>
                <span className={styles.itemSnippet}>{snippet(r.text)}</span>
              </button>
            );
          })}
        </div>

        <button className={styles.reportToggle} onClick={() => setShowReport((s) => !s)}>
          {showReport ? '▾' : '▸'} Отчёт в PDF
        </button>
        {showReport && (
          <div className={styles.report}>
            <p className={styles.reportHint}>По каждому дню периода: мероприятия, задачи и рефлексия.</p>
            <div className={styles.reportRow}>
              <input type="date" className={styles.dateInput} value={rFrom} max={rTo} onChange={(e) => setRFrom(e.target.value)} />
              <span className={styles.dash}>—</span>
              <input type="date" className={styles.dateInput} value={rTo} min={rFrom} max={todayStr} onChange={(e) => setRTo(e.target.value)} />
            </div>
            <button className={styles.pdfBtn} onClick={makePdf} disabled={busy}>
              {busy ? 'Формирование…' : '⬇ Скачать PDF'}
            </button>
          </div>
        )}
      </aside>

      {/* Правая панель — выбранная заметка */}
      <section className={styles.right}>
        <header className={styles.noteHead}>
          <button className={styles.nav} onClick={() => setSelectedDay(addDays(selectedDay, -1))} title="Предыдущий день">
            ‹
          </button>
          <input
            type="date"
            className={styles.dateInput}
            value={toDateInput(selectedDay)}
            onChange={(e) => {
              const d = fromDateInput(e.target.value);
              if (d) setSelectedDay(d);
            }}
          />
          <button className={styles.nav} onClick={() => setSelectedDay(addDays(selectedDay, 1))} title="Следующий день">
            ›
          </button>
          {!isToday && (
            <button className={styles.todayBtn} onClick={() => setSelectedDay(today)}>
              Сегодня
            </button>
          )}
          <h2 className={styles.noteTitle}>{formatDayTitle(selectedDay)}</h2>
          <span className={styles.saveHint}>{upsert.isPending ? 'Сохранение…' : 'Автосохранение'}</span>
        </header>

        <textarea
          className={styles.editor}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => text !== (dayRef?.text ?? '') && save()}
          placeholder="Как прошёл день? Что получилось, что нет, мысли, выводы…"
        />
      </section>
    </div>
  );
}
