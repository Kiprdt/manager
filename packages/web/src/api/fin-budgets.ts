import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FinBudget, CreateFinBudgetDto, UpdateFinBudgetDto } from '@life-app/shared';
import { apiClient } from '../lib/api-client';

const KEY = 'finance';

export function useFinBudgets(monthYear?: string) {
  const qs = monthYear ? `?monthYear=${encodeURIComponent(monthYear)}` : '';
  return useQuery<FinBudget[]>({
    queryKey: [KEY, 'budgets', monthYear ?? 'current'],
    queryFn: () => apiClient.get(`/api/finance/budgets${qs}`),
  });
}
export function useCreateFinBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: CreateFinBudgetDto) => apiClient.post<FinBudget>('/api/finance/budgets', d),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
export function useUpdateFinBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateFinBudgetDto }) =>
      apiClient.patch<FinBudget>(`/api/finance/budgets/${id}`, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
export function useDeleteFinBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/finance/budgets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
