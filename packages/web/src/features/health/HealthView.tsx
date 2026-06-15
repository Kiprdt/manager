import { useMemo, useState } from 'react';
import { CreateWorkoutExerciseDto } from '@life-app/shared';
import {
  useWeights,
  useUpsertWeight,
  useDeleteWeight,
  useWeightSeries,
  useWorkouts,
  useCreateWorkout,
  useDeleteWorkout,
  useWorkoutProgress,
  useMeals,
  useCreateMeal,
  useDeleteMeal,
  useHealthSettings,
  useUpdateHealthSettings,
  useNutritionRecommendation,
  useSupplements,
  useCreateSupplement,
  useDeleteSupplement,
  useToggleSupplement,
} from '../../api/health';
import {
  startOfDay,
  addDays,
  toDateInput,
  fromDateInput,
  isSameDay,
  daysInMonth,
  formatMonthTitle,
} from '../../lib/datetime';
import { recommendedCardio } from '@life-app/shared';
import { CategorySelect } from '../cards/CategorySelect';
import styles from './HealthView.module.css';

type Tab = 'weight' | 'workouts' | 'meals' | 'supps' | 'settings';
const WD = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function dayKey(d: Date) {
  return startOfDay(d).toISOString().slice(0, 10);
}
function isoWeekday(d: Date) {
  return ((d.getDay() + 6) % 7) + 1;
}

export function HealthView() {
  const [tab, setTab] = useState<Tab>('weight');
  const range = useMemo(() => {
    const today = startOfDay(new Date());
    return { from: addDays(today, -90), to: addDays(today, 1), today };
  }, []);

  return (
    <div className={styles.root}>
      <div className={styles.sheet}>
        <div className={styles.tabs}>
          {([
            ['weight', '⚖️ Вес'],
            ['workouts', '🏋️ Тренировки'],
            ['meals', '🍎 Питание'],
            ['supps', '💊 Добавки'],
            ['settings', '⚙️ Настройки'],
          ] as [Tab, string][]).map(([k, l]) => (
            <button
              key={k}
              className={`${styles.tab} ${tab === k ? styles.tabOn : ''}`}
              onClick={() => setTab(k)}
            >
              {l}
            </button>
          ))}
        </div>

        {tab === 'weight' && <WeightTab range={range} />}
        {tab === 'workouts' && <WorkoutsTab range={range} />}
        {tab === 'meals' && <MealsTab range={range} />}
        {tab === 'supps' && <SuppsTab range={range} />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}

type Range = { from: Date; to: Date; today: Date };

function WeightTab({ range }: { range: Range }) {
  const { data: weights = [] } = useWeights(range.from, range.to);
  const upsert = useUpsertWeight();
  const del = useDeleteWeight();
  const [val, setVal] = useState('');
  const [date, setDate] = useState(toDateInput(range.today));

  const save = () => {
    const w = Number(val.replace(',', '.'));
    const d = fromDateInput(date);
    if (!w || !d) return;
    upsert.mutate({ date: d, weightKg: w });
    setVal('');
  };

  const [by, setBy] = useState<'week' | 'month'>('week');
  const { data: settings } = useHealthSettings();
  const { data: series = [] } = useWeightSeries(by);

  const sorted = [...weights].sort((a, b) => new Date(a.date).valueOf() - new Date(b.date).valueOf());
  const latest = sorted[sorted.length - 1];
  const first = sorted[0];
  const delta = latest && first ? latest.weightKg - first.weightKg : 0;

  const sMin = Math.min(...series.map((p) => p.weightKg));
  const sMax = Math.max(...series.map((p) => p.weightKg));
  const sSpan = sMax - sMin || 1;
  const goal = settings?.weightGoalKg ?? null;

  return (
    <div className={styles.tabBody}>
      <div className={styles.addRow}>
        <input type="date" className={styles.input} value={date} onChange={(e) => setDate(e.target.value)} />
        <input
          className={styles.input}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="Вес, кг"
          inputMode="decimal"
        />
        <button className={styles.addBtn} onClick={save}>
          Сохранить
        </button>
      </div>

      {sorted.length > 0 && (
        <>
          <div className={styles.weightStat}>
            <b>{latest?.weightKg} кг</b>
            <span className={delta <= 0 ? styles.down : styles.up}>
              {delta > 0 ? '+' : ''}
              {delta.toFixed(1)} кг за период
            </span>
            {goal != null && (
              <span className={styles.empty}>
                · цель {goal} кг ({latest ? (latest.weightKg - goal > 0 ? '+' : '') + (latest.weightKg - goal).toFixed(1) : '—'})
              </span>
            )}
          </div>

          <div className={styles.segToggle}>
            <button className={by === 'week' ? styles.segOn : styles.seg} onClick={() => setBy('week')}>По неделям</button>
            <button className={by === 'month' ? styles.segOn : styles.seg} onClick={() => setBy('month')}>По месяцам</button>
          </div>
          <div className={styles.chart}>
            {series.map((p, i) => (
              <div key={i} className={styles.barWrap} title={`${p.label}: ${p.weightKg} кг`}>
                <div className={styles.bar} style={{ height: `${8 + ((p.weightKg - sMin) / sSpan) * 92}%`, background: 'var(--accent-blue)' }} />
                {i % Math.max(1, Math.ceil(series.length / 8)) === 0 && <span className={styles.barLabel}>{p.label}</span>}
              </div>
            ))}
          </div>
        </>
      )}

      <div className={styles.list}>
        {[...sorted].reverse().map((w) => (
          <div key={w.id} className={styles.row}>
            <span className={styles.rowDate}>{dayKey(new Date(w.date))}</span>
            <span className={styles.rowMain}>{w.weightKg} кг</span>
            <button className={styles.del} onClick={() => del.mutate(w.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

type ExRow = { name: string; weightKg: string; sets: string; reps: string };

function WorkoutsTab({ range }: { range: Range }) {
  const { data: workouts = [] } = useWorkouts(range.from, range.to);
  const { data: settings } = useHealthSettings();
  const create = useCreateWorkout();
  const del = useDeleteWorkout();

  const [kind, setKind] = useState<'strength' | 'cardio'>('strength');
  const [type, setType] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState(toDateInput(range.today));
  // strength
  const [exs, setExs] = useState<ExRow[]>([{ name: '', weightKg: '', sets: '', reps: '' }]);
  // cardio
  const [dur, setDur] = useState('');
  const [speed, setSpeed] = useState('');
  const [incline, setIncline] = useState('');

  const progressKind = kind;
  const { data: progress = [] } = useWorkoutProgress(progressKind);

  const rec = recommendedCardio({
    weightKg: null,
    hrTargetMin: settings?.hrTargetMin ?? null,
    hrTargetMax: settings?.hrTargetMax ?? null,
  });

  const setEx = (i: number, patch: Partial<ExRow>) =>
    setExs((cur) => cur.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  const save = () => {
    const d = fromDateInput(date);
    if (!d) return;
    if (kind === 'strength') {
      const exercises: CreateWorkoutExerciseDto[] = exs
        .filter((e) => e.name.trim())
        .map((e, i) => ({
          name: e.name.trim(),
          weightKg: e.weightKg ? Number(e.weightKg) : null,
          sets: e.sets ? Number(e.sets) : null,
          reps: e.reps ? Number(e.reps) : null,
          order: i,
        }));
      create.mutate({ date: d, type: type.trim() || 'Силовая', kind, categoryId, exercises });
      setExs([{ name: '', weightKg: '', sets: '', reps: '' }]);
    } else {
      create.mutate({
        date: d,
        type: type.trim() || 'Кардио',
        kind,
        categoryId,
        durationMin: dur ? Number(dur) : null,
        speedKmh: speed ? Number(speed) : null,
        inclinePct: incline ? Number(incline) : null,
      });
      setDur(''); setSpeed(''); setIncline('');
    }
    setType('');
  };

  const pMax = Math.max(1, ...progress.map((p) => p.value));

  return (
    <div className={styles.tabBody}>
      <div className={styles.addRow}>
        <select className={styles.input} style={{ maxWidth: 130 }} value={kind} onChange={(e) => setKind(e.target.value as 'strength' | 'cardio')}>
          <option value="strength">Силовая</option>
          <option value="cardio">Кардио</option>
        </select>
        <input type="date" className={styles.input} value={date} onChange={(e) => setDate(e.target.value)} />
        <input className={styles.input} value={type} onChange={(e) => setType(e.target.value)} placeholder="Название" />
        <CategorySelect className={styles.input} value={categoryId} onChange={setCategoryId} />
      </div>

      {kind === 'strength' ? (
        <div className={styles.exBlock}>
          <h4 className={styles.subTitle}>Упражнения</h4>
          {exs.map((e, i) => (
            <div key={i} className={styles.exRow}>
              <input className={styles.input} value={e.name} onChange={(ev) => setEx(i, { name: ev.target.value })} placeholder="Упражнение" />
              <input className={styles.inputS} value={e.weightKg} onChange={(ev) => setEx(i, { weightKg: ev.target.value })} placeholder="кг" inputMode="decimal" />
              <input className={styles.inputS} value={e.sets} onChange={(ev) => setEx(i, { sets: ev.target.value })} placeholder="подх" inputMode="numeric" />
              <input className={styles.inputS} value={e.reps} onChange={(ev) => setEx(i, { reps: ev.target.value })} placeholder="повт" inputMode="numeric" />
              <button className={styles.del} onClick={() => setExs((c) => c.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <button className={styles.goalToggle} onClick={() => setExs((c) => [...c, { name: '', weightKg: '', sets: '', reps: '' }])}>
            + упражнение
          </button>
        </div>
      ) : (
        <div className={styles.exBlock}>
          <div className={styles.addRow}>
            <input className={styles.inputS} value={dur} onChange={(e) => setDur(e.target.value)} placeholder="мин" inputMode="numeric" />
            <input className={styles.inputS} value={speed} onChange={(e) => setSpeed(e.target.value)} placeholder="км/ч" inputMode="decimal" />
            <input className={styles.inputS} value={incline} onChange={(e) => setIncline(e.target.value)} placeholder="наклон %" inputMode="decimal" />
          </div>
          <p className={styles.recommended}>
            Рекомендуемое кардио: {rec.minutes} мин · {rec.speedKmh} км/ч · наклон {rec.inclinePct}% · пульс {rec.hrMin}–{rec.hrMax}
          </p>
        </div>
      )}

      <button className={styles.addBtn} style={{ alignSelf: 'flex-start' }} onClick={save}>
        Добавить тренировку
      </button>

      {progress.length > 0 && (
        <>
          <h4 className={styles.subTitle}>
            Прогресс ({kind === 'strength' ? 'объём, кг' : 'калории'})
          </h4>
          <div className={styles.chart}>
            {progress.map((p, i) => (
              <div key={i} className={styles.barWrap} title={`${dayKey(new Date(p.date))}: ${p.value}`}>
                <div className={styles.bar} style={{ height: `${8 + (p.value / pMax) * 92}%`, background: '#5856d6' }} />
                {i % Math.max(1, Math.ceil(progress.length / 8)) === 0 && <span className={styles.barLabel}>{new Date(p.date).getDate()}</span>}
              </div>
            ))}
          </div>
        </>
      )}

      <h4 className={styles.subTitle}>История</h4>
      <div className={styles.list}>
        {workouts.map((w) => (
          <div key={w.id} className={styles.row}>
            <span className={styles.rowDate}>{dayKey(new Date(w.date))}</span>
            <span className={styles.rowMain}>
              {w.kind === 'cardio' ? '🏃' : '🏋️'} {w.type}
              {w.kind === 'cardio' && w.caloriesBurned ? ` · ${w.caloriesBurned} ккал` : ''}
              {w.kind === 'strength' && w.exercises.length ? ` · ${w.exercises.length} упр.` : ''}
            </span>
            {w.durationMin && <span className={styles.badge}>{w.durationMin} мин</span>}
            <button className={styles.del} onClick={() => del.mutate(w.id)}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

const MACROS = [
  { key: 'calories' as const, label: 'ккал', goalKey: 'caloriesGoal' as const, color: '#ff9500' },
  { key: 'protein' as const, label: 'белки', goalKey: 'proteinGoal' as const, color: '#34c759' },
  { key: 'carbs' as const, label: 'углеводы', goalKey: 'carbsGoal' as const, color: '#007aff' },
  { key: 'fat' as const, label: 'жиры', goalKey: 'fatGoal' as const, color: '#af52de' },
];

function MealsTab({ range }: { range: Range }) {
  const { data: meals = [] } = useMeals(range.from, range.to);
  const { data: settings } = useHealthSettings();
  const { data: rec } = useNutritionRecommendation();
  const upsert = useCreateMeal();
  const del = useDeleteMeal();
  const saveGoals = useUpdateHealthSettings();

  // Выбранный день для записи КБЖУ
  const [dateStr, setDateStr] = useState(toDateInput(range.today));
  const selDate = fromDateInput(dateStr) ?? range.today;
  const entry = meals.find((m) => isSameDay(new Date(m.date), selDate)) ?? null;

  const [cal, setCal] = useState('');
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [f, setF] = useState('');
  const [showGoals, setShowGoals] = useState(false);

  // подставляем значения выбранного дня в поля
  const v = { calories: cal, protein: p, carbs: c, fat: f };
  const setter = { calories: setCal, protein: setP, carbs: setC, fat: setF };
  const cur = (k: (typeof MACROS)[number]['key']) =>
    v[k] !== '' ? Number(v[k]) : (entry?.[k] ?? 0);

  const save = () => {
    upsert.mutate({
      date: selDate,
      calories: cal !== '' ? Number(cal) : (entry?.calories ?? null),
      protein: p !== '' ? Number(p) : (entry?.protein ?? null),
      carbs: c !== '' ? Number(c) : (entry?.carbs ?? null),
      fat: f !== '' ? Number(f) : (entry?.fat ?? null),
    });
    setCal(''); setP(''); setC(''); setF('');
  };

  const recent = [...meals].sort((a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf());

  return (
    <div className={styles.tabBody}>
      {/* Прогресс по целям + рекомендуемый */}
      {MACROS.map((m) => {
        const value = cur(m.key);
        const goal = settings?.[m.goalKey] ?? 0;
        const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
        const recVal = rec ? (rec as Record<string, number>)[m.key] : null;
        return (
          <div key={m.key} className={styles.goalRow}>
            <span className={styles.goalLabel}>{m.label}</span>
            <div className={styles.goalTrack}>
              <div className={styles.goalFill} style={{ width: `${pct}%`, background: m.color }} />
            </div>
            <span className={styles.goalNum}>
              {value}
              {goal > 0 ? ` / ${goal}` : ''}
              {recVal != null && <span className={styles.recommended}> · реком. {recVal}</span>}
            </span>
          </div>
        );
      })}
      {!rec && (
        <p className={styles.empty}>Заполните профиль в ⚙️ Настройках, чтобы получить рекомендуемое КБЖУ.</p>
      )}

      <h4 className={styles.subTitle}>Запись КБЖУ за день</h4>
      <div className={styles.addRow}>
        <input
          type="date"
          className={styles.input}
          value={dateStr}
          max={toDateInput(range.today)}
          onChange={(e) => setDateStr(e.target.value)}
          title="День записи"
        />
        {MACROS.map((m) => (
          <input
            key={m.key}
            className={styles.inputS}
            value={v[m.key]}
            onChange={(e) => setter[m.key](e.target.value)}
            placeholder={m.label}
            inputMode="numeric"
            title={`${m.label} за ${dateStr}`}
          />
        ))}
        <button className={styles.addBtn} onClick={save}>
          Сохранить
        </button>
      </div>

      <button className={styles.goalToggle} onClick={() => setShowGoals((s) => !s)}>
        {showGoals ? '▾' : '▸'} Дневные цели
      </button>
      {showGoals && (
        <div className={styles.addRow}>
          {MACROS.map((m) => (
            <input
              key={m.key}
              className={styles.inputS}
              defaultValue={settings?.[m.goalKey] ?? ''}
              placeholder={m.label}
              inputMode="numeric"
              onBlur={(e) =>
                saveGoals.mutate({ [m.goalKey]: e.target.value ? Number(e.target.value) : null })
              }
            />
          ))}
          <span className={styles.empty}>цель/день</span>
        </div>
      )}

      <h4 className={styles.subTitle}>Календарь калорий</h4>
      <KbjuCalendar meals={meals} selected={selDate} onPick={(d) => setDateStr(toDateInput(d))} />

      <h4 className={styles.subTitle}>История по дням</h4>
      <div className={styles.list}>
        {recent.length === 0 && <span className={styles.empty}>— нет записей</span>}
        {recent.map((m) => (
          <div key={m.id} className={styles.row}>
            <span className={styles.rowDate}>{dayKey(new Date(m.date))}</span>
            <span className={styles.rowMain}>
              {m.calories ?? 0} ккал · Б{m.protein ?? 0} У{m.carbs ?? 0} Ж{m.fat ?? 0}
            </span>
            <button className={styles.del} onClick={() => del.mutate(m.id)}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// КБЖУ-календарик месяца — в каждой ячейке ккал за день
function KbjuCalendar({
  meals,
  selected,
  onPick,
}: {
  meals: { date: Date | string; calories: number | null }[];
  selected: Date;
  onPick: (d: Date) => void;
}) {
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const calByDay = useMemo(() => {
    const m = new Map<string, number>();
    meals.forEach((x) => m.set(dayKey(new Date(x.date)), x.calories ?? 0));
    return m;
  }, [meals]);

  const weeks = useMemo(() => {
    const n = daysInMonth(month);
    const firstDow = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let i = 1; i <= n; i++) cells.push(new Date(month.getFullYear(), month.getMonth(), i));
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [month]);

  return (
    <div>
      <div className={styles.calHead}>
        <button className={styles.seg} onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>‹</button>
        <span className={styles.calTitle}>{formatMonthTitle(month)}</span>
        <button className={styles.seg} onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>›</button>
      </div>
      <div className={styles.miniCal}>
        <div className={styles.miniWeekHead}>
          {['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map((w) => (
            <span key={w} className={styles.miniWd}>{w}</span>
          ))}
        </div>
        {weeks.map((row, ri) => (
          <div key={ri} className={styles.miniWeek}>
            {row.map((d, ci) =>
              d ? (
                <button
                  key={ci}
                  className={`${styles.kbjuCell} ${isSameDay(d, new Date()) ? styles.miniToday : ''} ${
                    isSameDay(d, selected) ? styles.kbjuSel : ''
                  }`}
                  onClick={() => onPick(d)}
                  title="Выбрать день для записи"
                >
                  <span className={styles.kbjuNum}>{d.getDate()}</span>
                  {calByDay.has(dayKey(d)) && <span className={styles.kbjuKcal}>{calByDay.get(dayKey(d))}</span>}
                </button>
              ) : (
                <span key={ci} className={styles.miniEmpty} />
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Поля профиля/целей здоровья
function SettingsTab() {
  const { data: s } = useHealthSettings();
  const save = useUpdateHealthSettings();
  const num = (v: string) => (v === '' ? null : Number(v));

  return (
    <div className={styles.tabBody}>
      <h4 className={styles.subTitle}>Профиль</h4>
      <div className={styles.settingsGrid}>
        <label className={styles.sField}>
          <span>Пол</span>
          <select className={styles.input} defaultValue={s?.sex ?? ''} onChange={(e) => save.mutate({ sex: (e.target.value || null) as 'male' | 'female' | null })}>
            <option value="">—</option>
            <option value="male">Мужской</option>
            <option value="female">Женский</option>
          </select>
        </label>
        <label className={styles.sField}>
          <span>Год рождения</span>
          <input className={styles.input} type="number" defaultValue={s?.birthYear ?? ''} placeholder="1995" onBlur={(e) => save.mutate({ birthYear: num(e.target.value) })} />
        </label>
        <label className={styles.sField}>
          <span>Рост, см</span>
          <input className={styles.input} type="number" defaultValue={s?.heightCm ?? ''} placeholder="180" onBlur={(e) => save.mutate({ heightCm: num(e.target.value) })} />
        </label>
        <label className={styles.sField}>
          <span>Целевой вес, кг</span>
          <input className={styles.input} type="number" defaultValue={s?.weightGoalKg ?? ''} placeholder="75" onBlur={(e) => save.mutate({ weightGoalKg: num(e.target.value) })} />
        </label>
        <label className={styles.sField}>
          <span>Активность</span>
          <select className={styles.input} defaultValue={s?.activityLevel ?? ''} onChange={(e) => save.mutate({ activityLevel: (e.target.value || null) as never })}>
            <option value="">—</option>
            <option value="sedentary">Сидячий</option>
            <option value="light">Лёгкая</option>
            <option value="moderate">Умеренная</option>
            <option value="active">Высокая</option>
            <option value="veryActive">Очень высокая</option>
          </select>
        </label>
        <label className={styles.sField}>
          <span>Цель</span>
          <select className={styles.input} defaultValue={s?.goal ?? ''} onChange={(e) => save.mutate({ goal: (e.target.value || null) as never })}>
            <option value="">—</option>
            <option value="lose">Похудение</option>
            <option value="maintain">Поддержание</option>
            <option value="gain">Набор</option>
          </select>
        </label>
      </div>

      <h4 className={styles.subTitle}>Цели КБЖУ (день)</h4>
      <div className={styles.settingsGrid}>
        {([['caloriesGoal', 'Калории'], ['proteinGoal', 'Белки'], ['carbsGoal', 'Углеводы'], ['fatGoal', 'Жиры']] as const).map(([k, l]) => (
          <label key={k} className={styles.sField}>
            <span>{l}</span>
            <input className={styles.input} type="number" defaultValue={(s?.[k] as number | null) ?? ''} onBlur={(e) => save.mutate({ [k]: num(e.target.value) })} />
          </label>
        ))}
      </div>

      <h4 className={styles.subTitle}>Целевой пульс кардио</h4>
      <div className={styles.settingsGrid}>
        <label className={styles.sField}>
          <span>Нижний</span>
          <input className={styles.input} type="number" defaultValue={s?.hrTargetMin ?? ''} placeholder="120" onBlur={(e) => save.mutate({ hrTargetMin: num(e.target.value) })} />
        </label>
        <label className={styles.sField}>
          <span>Верхний</span>
          <input className={styles.input} type="number" defaultValue={s?.hrTargetMax ?? ''} placeholder="140" onBlur={(e) => save.mutate({ hrTargetMax: num(e.target.value) })} />
        </label>
      </div>
      {save.isSuccess && <p className={styles.empty}>✅ Сохранено</p>}
    </div>
  );
}

function SuppsTab({ range }: { range: Range }) {
  const { data: supps = [] } = useSupplements(range.from, range.to);
  const create = useCreateSupplement();
  const del = useDeleteSupplement();
  const toggle = useToggleSupplement();
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [kind, setKind] = useState<'supplement' | 'medication'>('supplement');

  const cols = useMemo(() => {
    const t = startOfDay(new Date());
    return Array.from({ length: 10 }, (_, i) => addDays(t, i - 9));
  }, []);

  const save = () => {
    if (!name.trim()) return;
    create.mutate({ name: name.trim(), dosage: dosage.trim() || null, kind });
    setName(''); setDosage('');
  };

  return (
    <div className={styles.tabBody}>
      <div className={styles.addRow}>
        <select className={styles.input} style={{ maxWidth: 130 }} value={kind} onChange={(e) => setKind(e.target.value as 'supplement' | 'medication')}>
          <option value="supplement">Добавка</option>
          <option value="medication">Лекарство</option>
        </select>
        <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Название" />
        <input className={styles.input} style={{ maxWidth: 120 }} value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="Дозировка" />
        <button className={styles.addBtn} onClick={save}>+</button>
      </div>

      {supps.length === 0 ? (
        <p className={styles.empty}>Нет добавок и лекарств</p>
      ) : (
        <div className={styles.suppTableScroll}>
          <table className={styles.suppTable}>
            <thead>
              <tr>
                <th></th>
                {cols.map((d) => (
                  <th key={dayKey(d)} className={styles.suppDay}>
                    <span>{WD[isoWeekday(d)]}</span>
                    <span>{d.getDate()}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {supps.map((s) => {
                const done = new Set(s.entries.map((e) => dayKey(new Date(e))));
                return (
                  <tr key={s.id}>
                    <td className={styles.suppName}>
                      <span>{s.kind === 'medication' ? '💊' : '🧪'} {s.name}</span>
                      {s.dosage && <span className={styles.suppDose}>{s.dosage}</span>}
                      <button className={styles.del} onClick={() => del.mutate(s.id)}>×</button>
                    </td>
                    {cols.map((d) => {
                      const isDone = done.has(dayKey(d));
                      return (
                        <td key={dayKey(d)} className={styles.suppCell}>
                          <button
                            className={`${styles.dot} ${isDone ? styles.dotDone : ''}`}
                            onClick={() => toggle.mutate({ id: s.id, date: d })}
                          >
                            {isDone ? '✓' : ''}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
