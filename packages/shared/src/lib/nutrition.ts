// Чистые функции расчёта КБЖУ и калорий — используются и api, и web.

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';
export type NutritionGoal = 'lose' | 'maintain' | 'gain';

const ACTIVITY: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};
const GOAL_ADJ: Record<NutritionGoal, number> = { lose: 0.85, maintain: 1, gain: 1.15 };

// Базовый обмен (Mifflin-St Jeor)
export function mifflinBmr(p: { sex: Sex; weightKg: number; heightCm: number; age: number }): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return base + (p.sex === 'male' ? 5 : -161);
}

export function tdee(bmr: number, activity: ActivityLevel): number {
  return bmr * (ACTIVITY[activity] ?? 1.2);
}

export interface Kbju {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// Рекомендуемое КБЖУ. Возвращает null, если не хватает данных.
export function recommendedKbju(p: {
  sex?: Sex | null;
  age?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  activityLevel?: ActivityLevel | null;
  goal?: NutritionGoal | null;
}): Kbju | null {
  if (!p.sex || !p.age || !p.heightCm || !p.weightKg) return null;
  const bmr = mifflinBmr({ sex: p.sex, weightKg: p.weightKg, heightCm: p.heightCm, age: p.age });
  const maint = tdee(bmr, p.activityLevel ?? 'moderate');
  const calories = Math.round(maint * GOAL_ADJ[p.goal ?? 'maintain']);
  const protein = Math.round(1.8 * p.weightKg); // г
  const fatKcal = calories * 0.25;
  const fat = Math.round(fatKcal / 9); // г
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4); // г, остаток
  return { calories, protein, carbs, fat: Math.max(0, fat), };
}

// MET для беговой дорожки по скорости (км/ч) и наклону (%). Грубая аппроксимация ACSM.
export function treadmillMet(speedKmh: number, inclinePct: number): number {
  const v = (speedKmh * 1000) / 60; // м/мин
  const grade = inclinePct / 100;
  const walking = speedKmh < 7;
  // VO2 (мл/кг/мин)
  const vo2 = walking
    ? 3.5 + 0.1 * v + 1.8 * v * grade
    : 3.5 + 0.2 * v + 0.9 * v * grade;
  return Math.max(1, vo2 / 3.5);
}

export function caloriesBurned(met: number, weightKg: number, minutes: number): number {
  return Math.round(met * 3.5 * weightKg * minutes / 200);
}

// Рекомендуемое кардио для пользователя (поддержание пульса в зоне).
export function recommendedCardio(p: {
  weightKg?: number | null;
  hrTargetMin?: number | null;
  hrTargetMax?: number | null;
}): { minutes: number; speedKmh: number; inclinePct: number; hrMin: number; hrMax: number } {
  // Умеренный темп для зоны жиросжигания
  return {
    minutes: 40,
    speedKmh: 6,
    inclinePct: 4,
    hrMin: p.hrTargetMin ?? 120,
    hrMax: p.hrTargetMax ?? 140,
  };
}

export function ageFromBirthYear(birthYear?: number | null): number | null {
  if (!birthYear) return null;
  return new Date().getFullYear() - birthYear;
}
