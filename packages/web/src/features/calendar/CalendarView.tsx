import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { DateClickArg, EventResizeDoneArg, DropArg } from '@fullcalendar/interaction';
import {
  EventClickArg,
  EventDropArg,
  DatesSetArg,
  EventInput,
} from '@fullcalendar/core';
import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { RRule } from 'rrule';
import { Task, TimeBlock } from '@life-app/shared';
import { useTimeBlocks, useUpdateTimeBlock, useCreateTimeBlock } from '../../api/timeblocks';
import { useTasks, useUpdateTask } from '../../api/tasks';
import { useCategories } from '../../api/categories';
import { useUiStore } from '../../store/ui-store';
import { isSameDay } from '../../lib/datetime';
import { priorityColor as taskColor } from '../../lib/priority';
import styles from './CalendarView.module.css';

// Задача с дедлайном → ВСЕГДА all-day-чип над днём (не блок времени).
// Блоками в календаре остаются только мероприятия. Задачи живут в списке/Планнере;
// здесь они показаны лишь как метка «есть дедлайн в этот день».
function taskToEvent(task: Task): EventInput | null {
  if (!task.dueAt) return null;
  const done = task.status === 'DONE';
  const color = done ? '#9ca3af' : taskColor(task.importance || task.priority);
  return {
    id: `task_${task.id}`,
    title: `${done ? '✓' : '○'} ${task.title}`,
    start: new Date(task.dueAt),
    allDay: true,
    backgroundColor: 'transparent',
    borderColor: color,
    textColor: color,
    classNames: done ? ['fc-task', 'fc-task--done'] : ['fc-task'],
    display: 'block',
    extendedProps: { kind: 'task', taskId: task.id },
  };
}

/**
 * Разворачивает повторяющийся блок через rrule в отдельные события для FullCalendar.
 * FullCalendar сам умеет rrule через плагин, но мы держим rrule на стороне приложения
 * для полного контроля над расширением диапазона.
 */
function expandRecurring(
  block: TimeBlock,
  rangeStart: Date,
  rangeEnd: Date,
  catColor?: string,
): EventInput[] {
  if (!block.recurrenceRule) {
    return [blockToEvent(block, catColor)];
  }

  try {
    const duration = block.endAt.valueOf() - block.startAt.valueOf();
    const rule = RRule.fromString(
      `DTSTART:${formatDtstart(block.startAt)}\n${block.recurrenceRule}`,
    );
    const occurrences = rule.between(rangeStart, rangeEnd, true);
    if (occurrences.length === 0) return [];
    return occurrences.map((start, i) => ({
      ...blockToEvent(block, catColor),
      id: `${block.id}_${i}`,
      start,
      end: new Date(start.valueOf() + duration),
    }));
  } catch {
    // Некорректное правило — показываем базовое событие, не ломая календарь
    return [blockToEvent(block, catColor)];
  }
}

function formatDtstart(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace('.000', '');
}

function blockToEvent(block: TimeBlock, catColor?: string): EventInput {
  const color = block.color ?? catColor ?? '#3b82f6';
  return {
    id: block.id,
    title: block.title,
    start: block.startAt,
    end: block.endAt,
    allDay: block.isAllDay,
    backgroundColor: color,
    borderColor: color,
    extendedProps: { kind: 'event', blockId: block.id, taskId: block.taskId },
  };
}

export function CalendarView() {
  const calendarRef = useRef<FullCalendar>(null);
  const { calendarView, setCalendarView } = useUiStore();

  const [range, setRange] = useState<{ from: Date; to: Date }>(() => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - 7);
    const to = new Date(now);
    to.setDate(now.getDate() + 30);
    return { from, to };
  });

  const { data: blocks = [] } = useTimeBlocks(range.from, range.to);
  const { data: tasks = [] } = useTasks({ limit: 200 });
  const { data: categories = [] } = useCategories();
  const catColor = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach((c) => m.set(c.id, c.color));
    return m;
  }, [categories]);
  const updateBlock = useUpdateTimeBlock();
  const createBlock = useCreateTimeBlock();
  const updateTask = useUpdateTask();
  const openEvent = useUiStore((s) => s.openEvent);
  const openTask = useUiStore((s) => s.openTask);
  const openCreator = useUiStore((s) => s.openCreator);
  const openDay = useUiStore((s) => s.openDay);

  // Кол-во активных (не выполненных) задач на дату — для бейджа над днём
  const activeTaskCount = useCallback(
    (date: Date) =>
      tasks.filter(
        (t) => t.dueAt && t.status !== 'DONE' && isSameDay(new Date(t.dueAt), date),
      ).length,
    [tasks],
  );

  const dayBadge = useCallback(
    (date: Date) => {
      const count = activeTaskCount(date);
      if (count === 0) return null;
      return (
        <button
          className={styles.dayBadge}
          title={`${count} активных задач — открыть день`}
          onClick={(e) => {
            e.stopPropagation();
            openDay(date);
          }}
        >
          {count}
        </button>
      );
    },
    [activeTaskCount, openDay],
  );

  // Линия «сейчас» — FullCalendar рисует её сам в timeGrid-видах,
  // но мы дополнительно подсвечиваем активный блок каждую минуту
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const events: EventInput[] = blocks.flatMap((b) =>
    expandRecurring(
      { ...b, startAt: new Date(b.startAt), endAt: new Date(b.endAt) },
      range.from,
      range.to,
      b.categoryId ? catColor.get(b.categoryId) : undefined,
    ),
  );

  // Подсвечиваем блок, активный прямо сейчас
  const eventsWithActive = events.map((ev) => {
    const start = ev.start as Date;
    const end = ev.end as Date;
    const isActive = start <= now && now <= end;
    return isActive
      ? { ...ev, classNames: ['fc-event--active'], borderColor: '#f59e0b' }
      : ev;
  });

  // Задачи с дедлайном — тоже на календаре (FullCalendar разложит накладывающиеся в колонки)
  const taskEvents = tasks
    .map(taskToEvent)
    .filter((e): e is EventInput => e !== null);

  const allEvents = [...eventsWithActive, ...taskEvents];

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setRange({ from: arg.start, to: arg.end });
    setCalendarView(arg.view.type as typeof calendarView);
  }, [setCalendarView]);

  const handleDateClick = useCallback(
    (arg: DateClickArg) => {
      // Предлагаем выбор: мероприятие или задача — с привязкой к выбранному времени
      openCreator(arg.date);
    },
    [openCreator],
  );

  const handleEventDrop = useCallback(
    (arg: EventDropArg) => {
      if (arg.event.extendedProps.kind === 'task') {
        // Перетаскивание all-day чипа задачи меняет дату её дедлайна
        const taskId = arg.event.extendedProps.taskId as string;
        if (arg.event.start) updateTask.mutate({ id: taskId, dto: { dueAt: arg.event.start, dueAllDay: true } });
        return;
      }
      const blockId = arg.event.extendedProps.blockId as string;
      const block = blocks.find((b) => b.id === blockId);
      if (!block || !arg.event.start || !arg.oldEvent.start) return;
      // Сдвигаем мероприятие на дельту перетаскивания (для повторов — всю серию,
      // сохраняя длительность). Так корректно переносятся и разовые, и повторяющиеся.
      const deltaMs = arg.event.start.valueOf() - arg.oldEvent.start.valueOf();
      updateBlock.mutate({
        id: blockId,
        dto: {
          startAt: new Date(new Date(block.startAt).valueOf() + deltaMs),
          endAt: new Date(new Date(block.endAt).valueOf() + deltaMs),
        },
      });
    },
    [updateBlock, updateTask, blocks],
  );

  const handleEventResize = useCallback(
    (arg: EventResizeDoneArg) => {
      // Задачи теперь только all-day чипы — растягивание к ним не применяется
      if (arg.event.extendedProps.kind === 'task') return;
      const blockId = arg.event.extendedProps.blockId as string;
      const block = blocks.find((b) => b.id === blockId);
      if (!block || !arg.event.end || !arg.oldEvent.end) return;
      const deltaMs = arg.event.end.valueOf() - arg.oldEvent.end.valueOf();
      updateBlock.mutate({
        id: blockId,
        dto: { endAt: new Date(new Date(block.endAt).valueOf() + deltaMs) },
      });
    },
    [updateBlock, updateTask, blocks],
  );

  // Перетащили задачу из панели в слот календаря → создаём привязанный блок времени
  const handleExternalDrop = useCallback(
    (arg: DropArg) => {
      const el = arg.draggedEl;
      const taskId = el.dataset.taskId;
      const title = el.dataset.taskTitle ?? 'Задача';
      if (!taskId) return;
      const minutes = Number(el.dataset.taskMinutes) || 60;
      const start = arg.date;
      const end = new Date(start.valueOf() + minutes * 60 * 1000);
      createBlock.mutate({
        title,
        startAt: start,
        endAt: end,
        isAllDay: arg.allDay,
        taskId,
        taskIds: [taskId],
        color: '#5856d6',
      });
    },
    [createBlock],
  );

  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      if (arg.event.extendedProps.kind === 'task') {
        openTask(arg.event.extendedProps.taskId as string);
        return;
      }
      const blockId = arg.event.extendedProps.blockId as string;
      openEvent(blockId);
    },
    [openEvent, openTask],
  );

  return (
    <div className={styles.root}>
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={calendarView}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        locale="ru"
        firstDay={1}
        height="100%"
        slotDuration="01:00:00"
        slotLabelInterval="01:00:00"
        nowIndicator={true}
        dayHeaderContent={(arg) =>
          arg.view.type.startsWith('dayGrid') ? (
            arg.text
          ) : (
            <div className={styles.dayHeader}>
              <span>{arg.text}</span>
              {dayBadge(arg.date)}
            </div>
          )
        }
        dayCellContent={(arg) =>
          arg.view.type.startsWith('dayGrid') ? (
            <div className={styles.dayCell}>
              {dayBadge(arg.date)}
              <span>{arg.dayNumberText}</span>
            </div>
          ) : undefined
        }
        editable={true}
        selectable={true}
        droppable={true}
        drop={handleExternalDrop}
        events={allEvents}
        datesSet={handleDatesSet}
        dateClick={handleDateClick}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        eventClick={handleEventClick}
      />
    </div>
  );
}
