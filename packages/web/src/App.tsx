import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useEffect, lazy, Suspense } from 'react';
import { useAuthStore } from './store/auth-store';
import { AuthScreen } from './features/auth/AuthScreen';
import { TaskList } from './features/tasks/TaskList';
import { EventCard } from './features/cards/EventCard';
import { TaskCard } from './features/cards/TaskCard';
import { CreatePicker } from './features/cards/CreatePicker';
import { DayCard } from './features/cards/DayCard';
import { NotificationManager } from './features/notifications/NotificationManager';
import { QuickAdd } from './features/quickadd/QuickAdd';
import { ThemeToggle } from './features/theme/ThemeToggle';
import { SettingsButton } from './features/settings/SettingsButton';
import { CommandPalette } from './features/command/CommandPalette';
import { useUiStore, UiMainView } from './store/ui-store';
import { wsClient } from './lib/ws';
import styles from './App.module.css';

// Ленивая загрузка тяжёлых вью (FullCalendar и пр.) — меньше стартовый бандл
const DashboardView = lazy(() =>
  import('./features/dashboard/DashboardView').then((m) => ({ default: m.DashboardView })),
);
const GoalsView = lazy(() =>
  import('./features/goals/GoalsView').then((m) => ({ default: m.GoalsView })),
);
const CalendarView = lazy(() =>
  import('./features/calendar/CalendarView').then((m) => ({ default: m.CalendarView })),
);
const PlannerView = lazy(() =>
  import('./features/planner/PlannerView').then((m) => ({ default: m.PlannerView })),
);
const HabitsView = lazy(() =>
  import('./features/habits/HabitsView').then((m) => ({ default: m.HabitsView })),
);
const AnalyticsView = lazy(() =>
  import('./features/analytics/AnalyticsView').then((m) => ({ default: m.AnalyticsView })),
);
const HealthView = lazy(() =>
  import('./features/health/HealthView').then((m) => ({ default: m.HealthView })),
);
const NotesView = lazy(() =>
  import('./features/notes/NotesView').then((m) => ({ default: m.NotesView })),
);
const FinanceView = lazy(() =>
  import('./features/finance/FinanceView').then((m) => ({ default: m.FinanceView })),
);
const ReflectionView = lazy(() =>
  import('./features/reflection/ReflectionView').then((m) => ({ default: m.ReflectionView })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
});

const NAV: { view: UiMainView; label: string }[] = [
  { view: 'dashboard', label: 'Сегодня' },
  { view: 'calendar', label: 'Календарь' },
  { view: 'planner', label: 'Планнер' },
  { view: 'habits', label: 'Привычки' },
  { view: 'health', label: 'Здоровье' },
  { view: 'finance', label: 'Финансы' },
  { view: 'goals', label: 'Цели' },
  { view: 'reflection', label: 'Рефлексия' },
  { view: 'notes', label: 'Заметки' },
];

function AppLayout() {
  const { taskPanelOpen, toggleTaskPanel, mainView, setMainView } = useUiStore();
  const logout = useAuthStore((s) => s.logout);
  const userEmail = useAuthStore((s) => s.user?.email);
  const qc = useQueryClient();

  useEffect(() => {
    wsClient.connect();
    // wsClient живёт всё время жизни приложения — не закрываем
  }, []);

  const handleLogout = () => {
    logout();
    qc.clear();
  };

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <span className={styles.logo}>Life Manager</span>
        <div className={styles.viewSwitch}>
          {NAV.map((n) => (
            <button
              key={n.view}
              className={`${styles.viewBtn} ${mainView === n.view ? styles.viewBtnActive : ''}`}
              onClick={() => setMainView(n.view)}
            >
              {n.label}
            </button>
          ))}
        </div>
        <div className={styles.headRight}>
          <button className={styles.cmdBtn} title="Поиск и команды (⌘/Ctrl+K)" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}>
            🔍
          </button>
          <QuickAdd />
          <SettingsButton />
          <ThemeToggle />
          <NotificationManager />
          {mainView === 'calendar' && (
            <button className={styles.panelToggle} onClick={toggleTaskPanel} title="Переключить панель задач">
              ☰ Задачи
            </button>
          )}
          <button className={styles.cmdBtn} title={`Выйти${userEmail ? ` (${userEmail})` : ''}`} onClick={handleLogout}>
            ⎋
          </button>
        </div>
      </header>
      <main className={styles.main}>
        <Suspense fallback={<div className={styles.suspense}>Загрузка…</div>}>
          {mainView === 'dashboard' ? (
            <div className={styles.todayStack}>
              <DashboardView />
              <AnalyticsView />
            </div>
          ) : mainView === 'calendar' ? (
            <>
              {taskPanelOpen && <TaskList />}
              <CalendarView />
            </>
          ) : mainView === 'planner' ? (
            <PlannerView />
          ) : mainView === 'habits' ? (
            <HabitsView />
          ) : mainView === 'health' ? (
            <HealthView />
          ) : mainView === 'finance' ? (
            <FinanceView />
          ) : mainView === 'goals' ? (
            <GoalsView />
          ) : mainView === 'reflection' ? (
            <ReflectionView />
          ) : (
            <NotesView />
          )}
        </Suspense>
      </main>
      <EventCard />
      <TaskCard />
      <CreatePicker />
      <DayCard />
      <CommandPalette />
    </div>
  );
}

function AuthGate() {
  const status = useAuthStore((s) => s.status);
  const init = useAuthStore((s) => s.init);
  const logout = useAuthStore((s) => s.logout);
  const qc = useQueryClient();

  useEffect(() => {
    init();
    const onUnauthorized = () => {
      logout();
      qc.clear();
    };
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, [init, logout, qc]);

  if (status === 'loading') return <div className={styles.suspense}>Загрузка…</div>;
  if (status === 'anon') return <AuthScreen />;
  return <AppLayout />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
    </QueryClientProvider>
  );
}
