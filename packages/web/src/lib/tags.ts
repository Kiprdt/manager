// Стабильный цвет тега по его имени (палитра в духе iOS)
const TAG_PALETTE = [
  '#007aff',
  '#34c759',
  '#ff9500',
  '#ff2d55',
  '#5856d6',
  '#af52de',
  '#00c7be',
  '#ff3b30',
];

export function tagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

// Нормализация ввода тега: без #, нижний регистр, обрезка
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, '').toLowerCase().slice(0, 24);
}
