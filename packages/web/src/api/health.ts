import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  WeightEntry,
  Workout,
  Meal,
  SupplementWithEntries,
  Supplement,
  CreateWeightDto,
  CreateWorkoutDto,
  CreateMealDto,
  CreateSupplementDto,
  HealthSettings,
  UpdateHealthSettingsDto,
  UpdateWorkoutDto,
  WeightSeriesPoint,
  WorkoutProgressPoint,
  NutritionRecommendation,
} from '@life-app/shared';
import { apiClient } from '../lib/api-client';

const KEY = 'health';

function range(from: Date, to: Date) {
  return new URLSearchParams({ from: from.toISOString(), to: to.toISOString() }).toString();
}
function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [KEY] });
}

// Вес
export function useWeights(from: Date, to: Date) {
  return useQuery<WeightEntry[]>({
    queryKey: [KEY, 'weight', from.toISOString(), to.toISOString()],
    queryFn: () => apiClient.get(`/api/health/weight?${range(from, to)}`),
  });
}
export function useUpsertWeight() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (d: CreateWeightDto) => apiClient.post<WeightEntry>('/api/health/weight', d), onSuccess: inv });
}
export function useDeleteWeight() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (id: string) => apiClient.delete(`/api/health/weight/${id}`), onSuccess: inv });
}
export function useWeightSeries(by: 'week' | 'month') {
  return useQuery<WeightSeriesPoint[]>({
    queryKey: [KEY, 'weightSeries', by],
    queryFn: () => apiClient.get(`/api/health/weight/series?by=${by}`),
  });
}

// Тренировки
export function useWorkouts(from: Date, to: Date) {
  return useQuery<Workout[]>({
    queryKey: [KEY, 'workouts', from.toISOString(), to.toISOString()],
    queryFn: () => apiClient.get(`/api/health/workouts?${range(from, to)}`),
  });
}
export function useCreateWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: CreateWorkoutDto) => apiClient.post<Workout>('/api/health/workouts', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ['timeblocks'] });
    },
  });
}
export function useUpdateWorkout() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateWorkoutDto }) =>
      apiClient.patch<Workout>(`/api/health/workouts/${id}`, dto),
    onSuccess: inv,
  });
}
export function useDeleteWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/health/workouts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ['timeblocks'] });
    },
  });
}
export function useWorkoutProgress(kind: 'strength' | 'cardio') {
  return useQuery<WorkoutProgressPoint[]>({
    queryKey: [KEY, 'progress', kind],
    queryFn: () => apiClient.get(`/api/health/workouts/progress?kind=${kind}`),
  });
}

// Питание
export function useMeals(from: Date, to: Date) {
  return useQuery<Meal[]>({
    queryKey: [KEY, 'meals', from.toISOString(), to.toISOString()],
    queryFn: () => apiClient.get(`/api/health/meals?${range(from, to)}`),
  });
}
export function useCreateMeal() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (d: CreateMealDto) => apiClient.post<Meal>('/api/health/meals', d), onSuccess: inv });
}
export function useDeleteMeal() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (id: string) => apiClient.delete(`/api/health/meals/${id}`), onSuccess: inv });
}

// Настройки здоровья (цели по нутриентам)
export function useHealthSettings() {
  return useQuery<HealthSettings>({
    queryKey: [KEY, 'settings'],
    queryFn: () => apiClient.get('/api/health/settings'),
  });
}
export function useUpdateHealthSettings() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (d: UpdateHealthSettingsDto) => apiClient.patch<HealthSettings>('/api/health/settings', d),
    onSuccess: inv,
  });
}
export function useNutritionRecommendation() {
  return useQuery<NutritionRecommendation>({
    queryKey: [KEY, 'recommendation'],
    queryFn: () => apiClient.get('/api/health/nutrition/recommendation'),
  });
}

// Добавки/лекарства
export function useSupplements(from: Date, to: Date) {
  return useQuery<SupplementWithEntries[]>({
    queryKey: [KEY, 'supplements', from.toISOString(), to.toISOString()],
    queryFn: () => apiClient.get(`/api/health/supplements?${range(from, to)}`),
  });
}
export function useCreateSupplement() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (d: CreateSupplementDto) => apiClient.post<Supplement>('/api/health/supplements', d), onSuccess: inv });
}
export function useDeleteSupplement() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (id: string) => apiClient.delete(`/api/health/supplements/${id}`), onSuccess: inv });
}
export function useToggleSupplement() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, date }: { id: string; date: Date }) =>
      apiClient.post(`/api/health/supplements/${id}/toggle`, { date }),
    onSuccess: inv,
  });
}
