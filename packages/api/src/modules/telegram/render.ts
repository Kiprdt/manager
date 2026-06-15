// Рендер сообщения-списка задач дня для Telegram (вариант B: текст + inline-кнопки)

export interface TgTask {
  id: string;
  title: string;
  status: string; // TODO | IN_PROGRESS | DONE
}

// Локальный YYYY-MM-DD (для callback_data и ключей дня)
export function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function dateLabel(d: Date): string {
  return new Intl.DateTimeFormat('ru', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

export interface RenderedList {
  text: string;
  replyMarkup: { inline_keyboard: { text: string; callback_data: string }[][] };
}

/**
 * Строит текст + клавиатуру списка дня.
 * Каждая задача — кнопка-тоггл «⬜/✅ Название» (callback `t:<id>`),
 * снизу — «➕ Добавить задачи» (callback `add:<YYYY-MM-DD>`).
 */
export function renderDayList(day: Date, tasks: TgTask[]): RenderedList {
  const done = tasks.filter((t) => t.status === 'DONE').length;
  const head = `<b>📋 Задачи · ${dateLabel(day)}</b>`;
  const sub = tasks.length ? `\n<i>${done}/${tasks.length} выполнено</i>` : '';
  const text = head + sub;

  const rows: { text: string; callback_data: string }[][] = tasks.map((t) => [
    {
      text: `${t.status === 'DONE' ? '✅' : '⬜'} ${truncate(t.title, 40)}`,
      callback_data: `t:${t.id}`,
    },
  ]);
  rows.push([{ text: '➕ Добавить задачи', callback_data: `add:${ymd(day)}` }]);

  return { text, replyMarkup: { inline_keyboard: rows } };
}
