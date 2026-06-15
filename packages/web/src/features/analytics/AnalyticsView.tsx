import { useMemo } from 'react';
import { Task } from '@life-app/shared';
import { useTasks } from '../../api/tasks';
import { useCategories } from '../../api/categories';
import { useTimeBlocks } from '../../api/timeblocks';
import { useFinanceTx } from '../../api/finance';
import { InsightsPanel } from './InsightsPanel';
import { useUiStore } from '../../store/ui-store';
import { startOfDay, dueBucket, addDays, startOfMonth, addMonths } from '../../lib/datetime';
import { tagColor } from '../../lib/tags';
import { fmtMoney } from '../../lib/finance';
import styles from './AnalyticsView.module.css';

const CHART_DAYS = 30;
const PRIORITY_META: { key: number; label: string; color: string }[] = [
  { key: 3, label: 'Высокий', color: '#ff3b30' },
  { key: 2, label: 'Средний', color: '#ff9500' },
  { key: 1, label: 'Низкий', color: '#5856d6' },
  { key: 0, label: 'Обычный', color: '#34c759' },
];

function dayKey(d: Date): string {
  return startOfDay(d).toISOString().slice(0, 10);
}

export function AnalyticsView() {
  const { openTask } = useUiStore();
  const { data: tasks = [] } = useTasks({ limit: 200 });
  const { data: categories = [] } = useCategories();
  const lbRange = useMemo(() => {
    const today = startOfDay(new Date());
    return { from: addDays(today, -30), to: addDays(today, 1), monthFrom: startOfMonth(new Date()), monthTo: addMonths(startOfMonth(new Date()), 1) };
  }, []);
  const { data: lbBlocks = [] } = useTimeBlocks(lbRange.from, lbRange.to);
  const { data: lbTx = [] } = useFinanceTx(lbRange.monthFrom, lbRange.monthTo);

  // Баланс жизни: время (мероприятия + факт задач) и деньги по зонам
  const lifeBalance = useMemo(() => {
    const time = new Map<string, number>();
    const money = new Map<string, number>();
    lbBlocks.forEach((b) => {
      if (!b.categoryId) return;
      const min = Math.max(0, Math.round((new Date(b.endAt).valueOf() - new Date(b.startAt).valueOf()) / 60000));
      time.set(b.categoryId, (time.get(b.categoryId) ?? 0) + min);
    });
    tasks.forEach((t) => {
      if (t.categoryId && t.actualMinutes) time.set(t.categoryId, (time.get(t.categoryId) ?? 0) + t.actualMinutes);
    });
    lbTx.forEach((t) => {
      if (t.type === 'expense' && t.categoryId) money.set(t.categoryId, (money.get(t.categoryId) ?? 0) + t.amount);
    });
    const rows = categories
      .map((c) => ({ name: c.name, color: c.color, time: time.get(c.id) ?? 0, money: money.get(c.id) ?? 0 }))
      .filter((r) => r.time > 0 || r.money > 0);
    const maxTime = Math.max(1, ...rows.map((r) => r.time));
    const maxMoney = Math.max(1, ...rows.map((r) => r.money));
    return { rows, maxTime, maxMoney };
  }, [lbBlocks, lbTx, tasks, categories]);

  const byCategory = useMemo(() => {
    const time = new Map<string, number>();
    tasks
      .filter((t) => t.status === 'DONE' && t.actualMinutes && t.categoryId)
      .forEach((t) => time.set(t.categoryId!, (time.get(t.categoryId!) ?? 0) + t.actualMinutes!));
    const rows = categories
      .map((c) => ({ name: c.name, color: c.color, min: time.get(c.id) ?? 0 }))
      .filter((r) => r.min > 0)
      .sort((a, b) => b.min - a.min);
    const max = Math.max(1, ...rows.map((r) => r.min));
    return { rows, max };
  }, [tasks, categories]);

  const stats = useMemo(() => {
    const roots = tasks.filter((t) => !t.parentId);
    const done = roots.filter((t) => t.status === 'DONE');
    const active = roots.filter((t) => t.status !== 'DONE');
    const total = roots.length;
    const rate = total ? Math.round((done.length / total) * 100) : 0;

    // Выполнено по дням (последние CHART_DAYS)
    const today = startOfDay(new Date());
    const base = today.valueOf();
    const perDay: { date: Date; count: number }[] = [];
    const doneByKey = new Map<string, number>();
    done.forEach((t) => {
      if (t.completedAt) {
        const k = dayKey(new Date(t.completedAt));
        doneByKey.set(k, (doneByKey.get(k) ?? 0) + 1);
      }
    });
    for (let i = CHART_DAYS - 1; i >= 0; i--) {
      const d = new Date(base - i * 86_400_000);
      perDay.push({ date: d, count: doneByKey.get(dayKey(d)) ?? 0 });
    }
    const maxDay = Math.max(1, ...perDay.map((d) => d.count));
    const last7 = perDay.slice(-7).reduce((s, d) => s + d.count, 0);

    // Серия продуктивных дней (≥1 выполнено), заканчивая сегодня/вчера
    let streak = 0;
    const cur = new Date(today);
    if (!doneByKey.has(dayKey(cur))) cur.setDate(cur.getDate() - 1);
    while (doneByKey.has(dayKey(cur))) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    }

    // Просрочено
    const overdue = active.filter((t) => dueBucket(t.dueAt) === 'overdue').length;

    // Учёт времени: оценка vs факт по выполненным
    const withBoth = done.filter((t) => t.estimatedMinutes && t.actualMinutes);
    const estSum = withBoth.reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0);
    const actSum = withBoth.reduce((s, t) => s + (t.actualMinutes ?? 0), 0);
    const totalActual = done.reduce((s, t) => s + (t.actualMinutes ?? 0), 0);
    const accuracy = estSum > 0 ? Math.round((estSum / actSum) * 100) : null;

    // По приоритету (активные)
    const byPriority = PRIORITY_META.map((p) => ({
      ...p,
      count: active.filter((t) => (t.priority >= 3 ? 3 : t.priority) === p.key).length,
    }));
    const maxPrio = Math.max(1, ...byPriority.map((p) => p.count));

    // По тегам (активные, топ-8)
    const tagCount = new Map<string, number>();
    active.forEach((t) => t.tags.forEach((tag) => tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1)));
    const byTag = [...tagCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag, count]) => ({ tag, count }));
    const maxTag = Math.max(1, ...byTag.map((t) => t.count));

    // Распределение времени (факт) по тегам
    const timeTag = new Map<string, number>();
    done.forEach((t) => {
      if (t.actualMinutes) t.tags.forEach((tag) => timeTag.set(tag, (timeTag.get(tag) ?? 0) + t.actualMinutes!));
    });
    const byTimeTag = [...timeTag.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag, min]) => ({ tag, min }));
    const maxTimeTag = Math.max(1, ...byTimeTag.map((t) => t.min));

    // Ближайшие дедлайны (активные с датой)
    const upcoming = active
      .filter((t) => t.dueAt)
      .sort((a, b) => new Date(a.dueAt!).valueOf() - new Date(b.dueAt!).valueOf())
      .slice(0, 5);

    return {
      total,
      doneCount: done.length,
      activeCount: active.length,
      rate,
      perDay,
      maxDay,
      last7,
      streak,
      overdue,
      byPriority,
      maxPrio,
      byTag,
      maxTag,
      upcoming,
      totalActual,
      accuracy,
      timeTracked: withBoth.length,
      byTimeTag,
      maxTimeTag,
    };
  }, [tasks]);

  const fmtDur = (min: number) => {
    if (min < 60) return `${min} мин`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h} ч ${m} мин` : `${h} ч`;
  };

  const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' }).format(d);

  return (
    <div className={styles.root}>
      <div className={styles.sheet}>
        <h2 className={styles.title}>Статистика</h2>

        {/* Карточки сводки */}
        <div className={styles.cards}>
          <div className={styles.card}>
            <span className={styles.cardNum} style={{ color: '#34c759' }}>
              {stats.doneCount}
            </span>
            <span className={styles.cardLabel}>выполнено всего</span>
          </div>
          <div className={styles.card}>
            <span className={styles.cardNum} style={{ color: 'var(--accent-blue)' }}>
              {stats.last7}
            </span>
            <span className={styles.cardLabel}>за 7 дней</span>
          </div>
          <div className={styles.card}>
            <span className={styles.cardNum}>{stats.rate}%</span>
            <span className={styles.cardLabel}>завершено</span>
          </div>
          <div className={styles.card}>
            <span className={styles.cardNum} style={{ color: stats.streak ? '#ff9500' : undefined }}>
              {stats.streak}🔥
            </span>
            <span className={styles.cardLabel}>дней подряд</span>
          </div>
          <div className={styles.card}>
            <span className={styles.cardNum} style={{ color: stats.overdue ? 'var(--accent)' : undefined }}>
              {stats.overdue}
            </span>
            <span className={styles.cardLabel}>просрочено</span>
          </div>
        </div>

        {/* График выполнено по дням */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Выполнено за 30 дней</h3>
          <div className={styles.chart}>
            {stats.perDay.map((d, i) => (
              <div key={i} className={styles.barWrap} title={`${fmtDate(d.date)}: ${d.count}`}>
                <div
                  className={styles.bar}
                  style={{ height: `${(d.count / stats.maxDay) * 100}%`, opacity: d.count ? 1 : 0.25 }}
                />
                {i % 5 === 0 && <span className={styles.barLabel}>{d.date.getDate()}</span>}
              </div>
            ))}
          </div>
        </section>

        <div className={styles.cols}>
          {/* По приоритету */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Активные по приоритету</h3>
            {stats.byPriority.map((p) => (
              <div key={p.key} className={styles.hbarRow}>
                <span className={styles.hbarLabel}>{p.label}</span>
                <div className={styles.hbarTrack}>
                  <div
                    className={styles.hbarFill}
                    style={{ width: `${(p.count / stats.maxPrio) * 100}%`, background: p.color }}
                  />
                </div>
                <span className={styles.hbarNum}>{p.count}</span>
              </div>
            ))}
          </section>

          {/* По тегам */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Активные по тегам</h3>
            {stats.byTag.length === 0 && <p className={styles.empty}>— нет тегов</p>}
            {stats.byTag.map((t) => (
              <div key={t.tag} className={styles.hbarRow}>
                <span className={styles.hbarLabel}>#{t.tag}</span>
                <div className={styles.hbarTrack}>
                  <div
                    className={styles.hbarFill}
                    style={{ width: `${(t.count / stats.maxTag) * 100}%`, background: tagColor(t.tag) }}
                  />
                </div>
                <span className={styles.hbarNum}>{t.count}</span>
              </div>
            ))}
          </section>
        </div>

        {/* Учёт времени */}
        {(stats.totalActual > 0 || stats.timeTracked > 0) && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Учёт времени</h3>
            <div className={styles.cards}>
              <div className={styles.card}>
                <span className={styles.cardNum} style={{ color: 'var(--accent-blue)' }}>
                  {fmtDur(stats.totalActual)}
                </span>
                <span className={styles.cardLabel}>всего потрачено</span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardNum}>
                  {stats.accuracy !== null ? `${stats.accuracy}%` : '—'}
                </span>
                <span className={styles.cardLabel}>точность оценки</span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardNum}>{stats.timeTracked}</span>
                <span className={styles.cardLabel}>задач с замером</span>
              </div>
            </div>
          </section>
        )}

        {/* Время по зонам/категориям */}
        {byCategory.rows.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Время по зонам (факт)</h3>
            {byCategory.rows.map((r) => (
              <div key={r.name} className={styles.hbarRow}>
                <span className={styles.hbarLabel}>{r.name}</span>
                <div className={styles.hbarTrack}>
                  <div className={styles.hbarFill} style={{ width: `${(r.min / byCategory.max) * 100}%`, background: r.color }} />
                </div>
                <span className={styles.hbarNum}>{fmtDur(r.min)}</span>
              </div>
            ))}
          </section>
        )}

        {/* Время по тегам */}
        {stats.byTimeTag.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Время по тегам (факт)</h3>
            {stats.byTimeTag.map((t) => (
              <div key={t.tag} className={styles.hbarRow}>
                <span className={styles.hbarLabel}>#{t.tag}</span>
                <div className={styles.hbarTrack}>
                  <div
                    className={styles.hbarFill}
                    style={{ width: `${(t.min / stats.maxTimeTag) * 100}%`, background: tagColor(t.tag) }}
                  />
                </div>
                <span className={styles.hbarNum}>{fmtDur(t.min)}</span>
              </div>
            ))}
          </section>
        )}

        {/* Ближайшие дедлайны */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Ближайшие дедлайны</h3>
          {stats.upcoming.length === 0 && <p className={styles.empty}>— нет задач с дедлайном</p>}
          {stats.upcoming.map((t: Task) => {
            const overdue = dueBucket(t.dueAt) === 'overdue';
            return (
              <button key={t.id} className={styles.dueRow} onClick={() => openTask(t.id)}>
                <span className={`${styles.dueDate} ${overdue ? styles.dueOverdue : ''}`}>
                  {fmtDate(new Date(t.dueAt!))}
                </span>
                <span className={styles.dueTitle}>{t.title}</span>
              </button>
            );
          })}
        </section>

        {lifeBalance.rows.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Баланс жизни (зоны)</h3>
            <p className={styles.lbHint}>Время — мероприятия за 30 дней + факт по задачам · Деньги — расходы за месяц</p>
            {lifeBalance.rows.map((r) => (
              <div key={r.name} className={styles.lbRow}>
                <span className={styles.lbName} style={{ color: r.color }}>{r.name}</span>
                <div className={styles.lbBars}>
                  <div className={styles.hbarTrack}>
                    <div className={styles.hbarFill} style={{ width: `${(r.time / lifeBalance.maxTime) * 100}%`, background: r.color }} />
                  </div>
                  <span className={styles.lbVal}>{fmtDur(r.time)}</span>
                  <div className={styles.hbarTrack}>
                    <div className={styles.hbarFill} style={{ width: `${(r.money / lifeBalance.maxMoney) * 100}%`, background: r.color, opacity: 0.6 }} />
                  </div>
                  <span className={styles.lbVal}>{fmtMoney(r.money)}</span>
                </div>
              </div>
            ))}
          </section>
        )}

        <InsightsPanel />
      </div>
    </div>
  );
}
