import { z } from 'zod';

const RangeBase = { from: z.coerce.date(), to: z.coerce.date() };
export const HealthRangeQuerySchema = z.object(RangeBase);
export type HealthRangeQuery = z.infer<typeof HealthRangeQuerySchema>;

// ── Вес ──
export const WeightEntrySchema = z.object({
  id: z.string().cuid(),
  date: z.coerce.date(),
  weightKg: z.number().positive().max(500),
  createdAt: z.coerce.date(),
});
export type WeightEntry = z.infer<typeof WeightEntrySchema>;
export const CreateWeightSchema = z.object({
  date: z.coerce.date(),
  weightKg: z.number().positive().max(500),
});
export type CreateWeightDto = z.infer<typeof CreateWeightSchema>;

// ── Тренировки ──
export const WorkoutKindSchema = z.enum(['strength', 'cardio']);
export type WorkoutKind = z.infer<typeof WorkoutKindSchema>;

export const WorkoutExerciseSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(120),
  weightKg: z.number().nonnegative().nullable(),
  sets: z.number().int().nonnegative().nullable(),
  reps: z.number().int().nonnegative().nullable(),
  order: z.number().int().nonnegative(),
});
export type WorkoutExercise = z.infer<typeof WorkoutExerciseSchema>;
export const CreateWorkoutExerciseSchema = z.object({
  name: z.string().min(1).max(120),
  weightKg: z.number().nonnegative().optional().nullable(),
  sets: z.number().int().nonnegative().optional().nullable(),
  reps: z.number().int().nonnegative().optional().nullable(),
  order: z.number().int().nonnegative().optional(),
});
export type CreateWorkoutExerciseDto = z.infer<typeof CreateWorkoutExerciseSchema>;

export const WorkoutSchema = z.object({
  id: z.string().cuid(),
  date: z.coerce.date(),
  type: z.string().min(1).max(80),
  categoryId: z.string().nullable(),
  kind: WorkoutKindSchema,
  durationMin: z.number().int().positive().nullable(),
  inclinePct: z.number().nonnegative().nullable(),
  speedKmh: z.number().nonnegative().nullable(),
  caloriesBurned: z.number().int().nonnegative().nullable(),
  notes: z.string().nullable(),
  timeBlockId: z.string().nullable(),
  exercises: z.array(WorkoutExerciseSchema).default([]),
  createdAt: z.coerce.date(),
});
export type Workout = z.infer<typeof WorkoutSchema>;

export const CreateWorkoutSchema = z.object({
  date: z.coerce.date(),
  type: z.string().min(1).max(80),
  categoryId: z.string().optional().nullable(),
  kind: WorkoutKindSchema.optional(),
  durationMin: z.number().int().positive().optional().nullable(),
  inclinePct: z.number().nonnegative().optional().nullable(),
  speedKmh: z.number().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
  exercises: z.array(CreateWorkoutExerciseSchema).optional(),
});
export type CreateWorkoutDto = z.infer<typeof CreateWorkoutSchema>;
export const UpdateWorkoutSchema = CreateWorkoutSchema.partial();
export type UpdateWorkoutDto = z.infer<typeof UpdateWorkoutSchema>;

export const WorkoutProgressPointSchema = z.object({
  date: z.coerce.date(),
  value: z.number(),
});
export type WorkoutProgressPoint = z.infer<typeof WorkoutProgressPointSchema>;

// ── Питание ──
export const MealSchema = z.object({
  id: z.string().cuid(),
  date: z.coerce.date(),
  calories: z.number().int().nonnegative().nullable(),
  protein: z.number().int().nonnegative().nullable(),
  carbs: z.number().int().nonnegative().nullable(),
  fat: z.number().int().nonnegative().nullable(),
  createdAt: z.coerce.date(),
});
export type Meal = z.infer<typeof MealSchema>;
export const CreateMealSchema = z.object({
  date: z.coerce.date(),
  calories: z.number().int().nonnegative().optional().nullable(),
  protein: z.number().int().nonnegative().optional().nullable(),
  carbs: z.number().int().nonnegative().optional().nullable(),
  fat: z.number().int().nonnegative().optional().nullable(),
});
export type CreateMealDto = z.infer<typeof CreateMealSchema>;
export const UpdateMealSchema = CreateMealSchema.partial();
export type UpdateMealDto = z.infer<typeof UpdateMealSchema>;

// ── Лекарства и добавки ──
export const SupplementKindSchema = z.enum(['supplement', 'medication']);
export const SupplementSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(120),
  dosage: z.string().nullable(),
  kind: SupplementKindSchema,
  scheduleType: z.enum(['daily', 'custom']),
  weekdays: z.array(z.number().int().min(1).max(7)).default([]),
  timeOfDay: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
  active: z.boolean(),
  createdAt: z.coerce.date(),
});
export type Supplement = z.infer<typeof SupplementSchema>;
export const SupplementWithEntriesSchema = SupplementSchema.extend({
  entries: z.array(z.coerce.date()),
});
export type SupplementWithEntries = z.infer<typeof SupplementWithEntriesSchema>;

export const CreateSupplementSchema = z.object({
  name: z.string().min(1).max(120),
  dosage: z.string().optional().nullable(),
  kind: SupplementKindSchema.optional(),
  scheduleType: z.enum(['daily', 'custom']).optional(),
  weekdays: z.array(z.number().int().min(1).max(7)).optional(),
  timeOfDay: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional()
    .nullable(),
});
export type CreateSupplementDto = z.input<typeof CreateSupplementSchema>;
export const UpdateSupplementSchema = CreateSupplementSchema.partial().extend({
  active: z.boolean().optional(),
});
export type UpdateSupplementDto = z.infer<typeof UpdateSupplementSchema>;

export const ToggleSupplementSchema = z.object({ date: z.coerce.date() });
export type ToggleSupplementDto = z.infer<typeof ToggleSupplementSchema>;

// ── Настройки здоровья (профиль + цели) ──
export const HealthSettingsSchema = z.object({
  // профиль
  sex: z.enum(['male', 'female']).nullable(),
  birthYear: z.number().int().min(1900).max(2100).nullable(),
  heightCm: z.number().int().min(50).max(260).nullable(),
  weightGoalKg: z.number().positive().max(500).nullable(),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'veryActive']).nullable(),
  goal: z.enum(['lose', 'maintain', 'gain']).nullable(),
  // цели КБЖУ
  caloriesGoal: z.number().int().nonnegative().nullable(),
  proteinGoal: z.number().int().nonnegative().nullable(),
  carbsGoal: z.number().int().nonnegative().nullable(),
  fatGoal: z.number().int().nonnegative().nullable(),
  // целевой пульс кардио
  hrTargetMin: z.number().int().nonnegative().nullable(),
  hrTargetMax: z.number().int().nonnegative().nullable(),
});
export type HealthSettings = z.infer<typeof HealthSettingsSchema>;
export const UpdateHealthSettingsSchema = HealthSettingsSchema.partial();
export type UpdateHealthSettingsDto = z.infer<typeof UpdateHealthSettingsSchema>;

// Рекомендованное КБЖУ (output эндпоинта)
export const NutritionRecommendationSchema = z.object({
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
}).nullable();
export type NutritionRecommendation = z.infer<typeof NutritionRecommendationSchema>;

// Серия веса по корзинам (неделя/месяц)
export const WeightSeriesPointSchema = z.object({
  label: z.string(),
  date: z.coerce.date(),
  weightKg: z.number(),
});
export type WeightSeriesPoint = z.infer<typeof WeightSeriesPointSchema>;
