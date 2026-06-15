import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FinGoal, CreateFinGoalDto, UpdateFinGoalDto } from '@life-app/shared';
import { apiClient } from '../lib/api-client';

const KEY = 'finance';

export function useFinGoals() {
  return useQuery<FinGoal[]>({
    queryKey: [KEY, 'goals'],
    queryFn: () => apiClient.get('/api/finance/goals'),
  });
}
export function useCreateFinGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: CreateFinGoalDto) => apiClient.post<FinGoal>('/api/finance/goals', d),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
export function useUpdateFinGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateFinGoalDto }) =>
      apiClient.patch<FinGoal>(`/api/finance/goals/${id}`, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
export function useDeleteFinGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/finance/goals/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
