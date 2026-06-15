import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FinTransaction,
  CreateFinTransactionDto,
  UpdateFinTransactionDto,
} from '@life-app/shared';
import { apiClient } from '../lib/api-client';

const KEY = 'finance';

export function useFinTransactions(from?: Date, to?: Date) {
  const params = new URLSearchParams();
  if (from) params.set('from', from.toISOString());
  if (to) params.set('to', to.toISOString());
  const qs = params.toString();
  return useQuery<FinTransaction[]>({
    queryKey: [KEY, 'transactions', qs],
    queryFn: () => apiClient.get(`/api/finance/transactions${qs ? `?${qs}` : ''}`),
  });
}
export function useCreateFinTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: CreateFinTransactionDto) =>
      apiClient.post<FinTransaction>('/api/finance/transactions', d),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
export function useUpdateFinTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateFinTransactionDto }) =>
      apiClient.patch<FinTransaction>(`/api/finance/transactions/${id}`, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
export function useDeleteFinTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/finance/transactions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
