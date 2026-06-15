// Цвет по уровню приоритета/важности (0..3+), палитра в духе iOS.
// Единый источник — раньше эта функция была продублирована в TaskList, DayCard и CalendarView.
export function priorityColor(p: number): string {
  if (p >= 3) return '#ff3b30'; // высокий — красный
  if (p >= 2) return '#ff9500'; // средний — оранжевый
  if (p >= 1) return '#5856d6'; // низкий — фиолетовый
  return '#34c759'; // обычный — зелёный
}
