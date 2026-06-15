import { create } from 'zustand';

export type UiMainView =
  | 'dashboard'
  | 'calendar'
  | 'planner'
  | 'habits'
  | 'health'
  | 'finance'
  | 'goals'
  | 'reflection'
  | 'notes';

const MUTE_KEY = 'notificationsMuted';
const readMuted = (): boolean => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
};

interface UiState {
  selectedTaskId: string | null;
  calendarView: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay';
  mainView: UiMainView;
  notificationsMuted: boolean;
  taskPanelOpen: boolean;

  // Открытая карточка-модал
  openEventId: string | null;
  openTaskId: string | null;

  // Выбор типа создаваемой сущности (задача / мероприятие).
  // creatorDate — контекст времени (клик по слоту календаря), иначе null.
  creatorOpen: boolean;
  creatorDate: Date | null;

  // Открытая карточка дня (события + задачи за дату)
  openDayDate: Date | null;

  setSelectedTask: (id: string | null) => void;
  setCalendarView: (view: UiState['calendarView']) => void;
  setMainView: (view: UiState['mainView']) => void;
  openPlanner: () => void;
  toggleNotificationsMuted: () => void;
  toggleTaskPanel: () => void;

  openEvent: (id: string) => void;
  openTask: (id: string) => void;
  closeCards: () => void;

  openCreator: (date?: Date) => void;
  closeCreator: () => void;

  openDay: (date: Date) => void;
  closeDay: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedTaskId: null,
  calendarView: 'timeGridWeek',
  mainView: 'dashboard',
  notificationsMuted: readMuted(),
  taskPanelOpen: true,
  openEventId: null,
  openTaskId: null,
  creatorOpen: false,
  creatorDate: null,
  openDayDate: null,

  setSelectedTask: (id) => set({ selectedTaskId: id }),
  setCalendarView: (view) => set({ calendarView: view }),
  setMainView: (view) => set({ mainView: view }),
  openPlanner: () => set({ mainView: 'planner' }),
  toggleNotificationsMuted: () =>
    set((s) => {
      const next = !s.notificationsMuted;
      try {
        localStorage.setItem(MUTE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return { notificationsMuted: next };
    }),
  toggleTaskPanel: () => set((s) => ({ taskPanelOpen: !s.taskPanelOpen })),

  openEvent: (id) => set({ openEventId: id, openTaskId: null, creatorOpen: false }),
  openTask: (id) => set({ openTaskId: id, openEventId: null, creatorOpen: false }),
  closeCards: () => set({ openEventId: null, openTaskId: null }),

  openCreator: (date) => set({ creatorOpen: true, creatorDate: date ?? null }),
  closeCreator: () => set({ creatorOpen: false, creatorDate: null }),

  openDay: (date) => set({ openDayDate: date }),
  closeDay: () => set({ openDayDate: null }),
}));
