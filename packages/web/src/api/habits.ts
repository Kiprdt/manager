import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Habit,
  HabitWithEntries,
  CreateHabitDto,
  UpdateHabitDto,
} from '@life-app/shared';
import { apiClient } from '../lib/api-client';

const HABITS_KEY = 'habits';

export function useHabits(from: Date, to: Date) {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  return useQuery<HabitWithEntries[]>({
    queryKey: [HABITS_KEY, from.toISOString(), to.toISOString()],
    queryFn: () => apiClient.get<HabitWithEntries[]>(`/api/habits?${params}`),
  });
}

export function useCreateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateHabitDto) => apiClient.post<Habit>('/api/habits', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: [HABITS_KEY] }),
  });
}

export function useUpdateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateHabitDto }) =>
      apiClient.patch<Habit>(`/api/habits/${id}`, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: [HABITS_KEY] }),
  });
}

export function useDeleteHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/habits/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [HABITS_KEY] }),
  });
}

export function useToggleHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, date }: { id: string; date: Date }) =>
      apiClient.post<{ date: string; count: number }>(`/api/habits/${id}/toggle`, { date }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [HABITS_KEY] }),
  });
}

export function useSetHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, date, count }: { id: string; date: Date; count: number }) =>
      apiClient.post<{ date: string; count: number }>(`/api/habits/${id}/set`, { date, count }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [HABITS_KEY] }),
  });
}
