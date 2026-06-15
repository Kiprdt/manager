import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';
import { Task, TimeBlock, Reflection } from '@life-app/shared';
import { addDays, startOfDay, isSameDay } from './datetime';

interface ReportInput {
  from: Date;
  to: Date; // включительно (последний день)
  tasks: Task[];
  blocks: TimeBlock[];
  reflections: Reflection[];
}

function fmtTime(d: Date): string {
  return new Intl.DateTimeFormat('ru', { hour: '2-digit', minute: '2-digit' }).format(d);
}
function fmtDayHeading(d: Date): string {
  return new Intl.DateTimeFormat('ru', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}
function fmtShort(d: Date): string {
  return new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

function dayContent(day: Date, input: ReportInput): Content[] {
  const events = input.blocks
    .filter((b) => isSameDay(new Date(b.startAt), day))
    .sort((a, b) => new Date(a.startAt).valueOf() - new Date(b.startAt).valueOf());

  // Задачи дня: запланированные (dueAt) + выполненные (completedAt), без дублей
  const map = new Map<string, Task>();
  input.tasks.forEach((t) => {
    const due = t.dueAt && isSameDay(new Date(t.dueAt), day);
    const done = t.completedAt && isSameDay(new Date(t.completedAt), day);
    if (due || done) map.set(t.id, t);
  });
  const dayTasks = [...map.values()].sort((a, b) => Number(a.status === 'DONE') - Number(b.status === 'DONE'));

  const reflection = input.reflections.find((r) => isSameDay(new Date(r.date), day));

  const out: Content[] = [
    { text: fmtDayHeading(day), style: 'dayHead', margin: [0, 12, 0, 4] },
  ];

  out.push({ text: 'Мероприятия', style: 'section' });
  if (events.length === 0) {
    out.push({ text: '—', style: 'muted' });
  } else {
    out.push({
      ul: events.map((e) => `${e.isAllDay ? 'весь день' : `${fmtTime(new Date(e.startAt))}–${fmtTime(new Date(e.endAt))}`} · ${e.title}`),
      style: 'item',
    });
  }

  out.push({ text: 'Задачи', style: 'section' });
  if (dayTasks.length === 0) {
    out.push({ text: '—', style: 'muted' });
  } else {
    out.push({
      ul: dayTasks.map((t) => `${t.status === 'DONE' ? '[x]' : '[ ]'}  ${t.title}`),
      style: 'item',
    });
  }

  out.push({ text: 'Рефлексия', style: 'section' });
  out.push(
    reflection && reflection.text.trim()
      ? { text: reflection.text, style: 'reflection' }
      : { text: '—', style: 'muted' },
  );

  return out;
}

export function buildReportDoc(input: ReportInput): TDocumentDefinitions {
  const days: Date[] = [];
  let d = startOfDay(input.from);
  const last = startOfDay(input.to);
  while (d <= last) {
    days.push(d);
    d = addDays(d, 1);
  }

  const body: Content[] = [
    { text: 'Отчёт за период', style: 'h1' },
    { text: `${fmtShort(input.from)} — ${fmtShort(input.to)}`, style: 'subtitle', margin: [0, 0, 0, 8] },
  ];
  days.forEach((day) => body.push(...dayContent(day, input)));

  return {
    content: body,
    defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.2 },
    styles: {
      h1: { fontSize: 18, bold: true },
      subtitle: { fontSize: 11, color: '#666' },
      dayHead: { fontSize: 13, bold: true, color: '#1a1a1a' },
      section: { fontSize: 10, bold: true, margin: [0, 6, 0, 2], color: '#444' },
      item: { margin: [0, 0, 0, 2] },
      muted: { color: '#999', italics: true },
      reflection: { color: '#222' },
    },
    pageMargins: [40, 40, 40, 40],
  };
}

// Динамически грузим pdfmake (тяжёлый) и скачиваем готовый PDF
export async function downloadReport(input: ReportInput, filename: string): Promise<void> {
  const [pdfMakeMod, fontsMod] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  const pdfMake = (pdfMakeMod as { default?: unknown }).default ?? pdfMakeMod;
  const pm = pdfMake as {
    vfs?: unknown;
    fonts?: unknown;
    addVirtualFileSystem?: (vfs: unknown) => void;
    createPdf: (dd: TDocumentDefinitions) => { download: (name: string) => void };
  };
  // pdfmake 0.3.x: vfs_fonts → module.exports = vfs (под ESM это default)
  const f = fontsMod as { default?: unknown; vfs?: unknown; pdfMake?: { vfs?: unknown } };
  const vfs = f.default ?? f.vfs ?? f.pdfMake?.vfs ?? f;
  if (typeof pm.addVirtualFileSystem === 'function') pm.addVirtualFileSystem(vfs);
  else pm.vfs = vfs;
  pm.fonts = {
    Roboto: {
      normal: 'Roboto-Regular.ttf',
      bold: 'Roboto-Medium.ttf',
      italics: 'Roboto-Italic.ttf',
      bolditalics: 'Roboto-MediumItalic.ttf',
    },
  };
  pm.createPdf(buildReportDoc(input)).download(filename);
}
