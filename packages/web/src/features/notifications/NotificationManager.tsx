import { useEffect, useMemo, useRef, useState } from 'react';
import { useTasks } from '../../api/tasks';
import { useTimeBlocks } from '../../api/timeblocks';
import { useHabits } from '../../api/habits';
import { useUiStore } from '../../store/ui-store';
import styles from './NotificationManager.module.css';

function dayStr(d: Date) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const EVENT_LEAD_MS = 10 * 60 * 1000; // напоминание за 10 минут до мероприятия
const WINDOW_MS = 90 * 1000; // окно срабатывания

type Perm = NotificationPermission | 'unsupported';

export function NotificationManager() {
  const supported = typeof window !== 'undefined' && 'Notification' in window;
  const [perm, setPerm] = useState<Perm>(supported ? Notification.permission : 'unsupported');
  const muted = useUiStore((s) => s.notificationsMuted);
  const toggleMuted = useUiStore((s) => s.toggleNotificationsMuted);
  // Держим актуальный mute в ref, чтобы интервал-проверка читала свежее значение
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const range = useMemo(() => {
    const now = Date.now();
    return { from: new Date(now - 86_400_000), to: new Date(now + 7 * 86_400_000) };
  }, []);

  const habitRange = useMemo(() => {
    const now = Date.now();
    return { from: new Date(now - 86_400_000), to: new Date(now + 86_400_000) };
  }, []);

  const { data: tasks = [] } = useTasks({ limit: 200 });
  const { data: blocks = [] } = useTimeBlocks(range.from, range.to);
  const { data: habits = [] } = useHabits(habitRange.from, habitRange.to);

  const dataRef = useRef({ tasks, blocks, habits });
  dataRef.current = { tasks, blocks, habits };
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!supported) return;
    const check = () => {
      if (Notification.permission !== 'granted' || mutedRef.current) return;
      const t = Date.now();
      const fire = (key: string, title: string, body: string) => {
        if (firedRef.current.has(key)) return;
        firedRef.current.add(key);
        try {
          new Notification(title, { body, tag: key });
        } catch {
          /* некоторые браузеры требуют SW для Notification — игнорируем */
        }
      };

      for (const tk of dataRef.current.tasks) {
        if (tk.status === 'DONE' || !tk.dueAt || tk.dueAllDay) continue;
        const due = new Date(tk.dueAt).getTime();
        if (due <= t && due > t - WINDOW_MS) fire(`task:${tk.id}:${due}`, '⏰ Дедлайн задачи', tk.title);
      }
      for (const b of dataRef.current.blocks) {
        const start = new Date(b.startAt).getTime();
        const trig = start - EVENT_LEAD_MS;
        if (trig <= t && trig > t - WINDOW_MS)
          fire(`event:${b.id}:${start}`, '📅 Скоро мероприятие', `${b.title} — через 10 минут`);
      }
      // Напоминания о привычках по времени
      const nowDate = new Date(t);
      for (const h of dataRef.current.habits) {
        if (!h.reminderTime) continue;
        const [hh, mm] = h.reminderTime.split(':').map(Number);
        const trigDate = new Date(nowDate);
        trigDate.setHours(hh, mm, 0, 0);
        const trig = trigDate.getTime();
        const doneToday = h.entries.some(
          (e) => sameDay(new Date(e.date), nowDate) && e.count >= h.targetCount,
        );
        if (!doneToday && trig <= t && trig > t - WINDOW_MS)
          fire(`habit:${h.id}:${dayStr(nowDate)}`, '🔁 Привычка', h.title);
      }
    };
    const id = window.setInterval(check, 30_000);
    check();
    return () => window.clearInterval(id);
  }, [supported]);

  if (!supported) return null;

  const fireTest = () => {
    try {
      new Notification('🔔 Уведомления включены', { body: 'Напомним о дедлайнах, мероприятиях и привычках' });
    } catch {
      /* ignore */
    }
  };

  const onClick = async () => {
    if (perm === 'granted') {
      // Разрешение есть → клик переключает тихий режим
      const willMute = !muted;
      toggleMuted();
      if (!willMute) fireTest(); // включили обратно — короткое подтверждение
      return;
    }
    const result = await Notification.requestPermission();
    setPerm(result);
    if (result === 'granted') fireTest();
    else if (result === 'denied')
      alert('Уведомления заблокированы. Разрешите их для этого сайта в настройках браузера.');
  };

  // Активны только когда разрешены И не в тихом режиме
  const active = perm === 'granted' && !muted;
  const title =
    perm === 'denied'
      ? 'Заблокированы в браузере — включите в настройках сайта'
      : perm !== 'granted'
        ? 'Включить напоминания'
        : muted
          ? 'Уведомления выключены — нажмите, чтобы включить'
          : 'Уведомления включены — нажмите, чтобы выключить';

  return (
    <button
      className={`${styles.bell} ${active ? styles.on : ''}`}
      onClick={onClick}
      title={title}
    >
      {active ? '🔔' : '🔕'}
    </button>
  );
}
