import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreateGoalDto, UpdateGoalDto, Goal } from '@life-app/shared';
import { apiClient } from '../lib/api-client';

const KEY = 'goals';

export function useGoals() {
  return useQuery<Goal[]>({ queryKey: [KEY], queryFn: () => apiClient.get('/api/goals') });
}
export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: CreateGoalDto) => apiClient.post<Goal>('/api/goals', d),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateGoalDto }) =>
      apiClient.patch<Goal>(`/api/goals/${id}`, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/goals/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
