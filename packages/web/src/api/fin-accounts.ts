import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FinAccount, CreateFinAccountDto, UpdateFinAccountDto } from '@life-app/shared';
import { apiClient } from '../lib/api-client';

const KEY = 'finance';

export function useFinAccounts() {
  return useQuery<FinAccount[]>({
    queryKey: [KEY, 'accounts'],
    queryFn: () => apiClient.get('/api/finance/accounts'),
  });
}
export function useCreateFinAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: CreateFinAccountDto) => apiClient.post<FinAccount>('/api/finance/accounts', d),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
export function useUpdateFinAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateFinAccountDto }) =>
      apiClient.patch<FinAccount>(`/api/finance/accounts/${id}`, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
export function useDeleteFinAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/finance/accounts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
