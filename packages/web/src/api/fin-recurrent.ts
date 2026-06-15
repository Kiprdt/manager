import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FinRecurrentPayment,
  CreateFinRecurrentPaymentDto,
  UpdateFinRecurrentPaymentDto,
} from '@life-app/shared';
import { apiClient } from '../lib/api-client';

const KEY = 'finance';

export function useFinRecurrent() {
  return useQuery<FinRecurrentPayment[]>({
    queryKey: [KEY, 'recurrent'],
    queryFn: () => apiClient.get('/api/finance/recurrent'),
  });
}
export function useCreateFinRecurrent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: CreateFinRecurrentPaymentDto) =>
      apiClient.post<FinRecurrentPayment>('/api/finance/recurrent', d),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
export function useUpdateFinRecurrent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateFinRecurrentPaymentDto }) =>
      apiClient.patch<FinRecurrentPayment>(`/api/finance/recurrent/${id}`, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
export function useDeleteFinRecurrent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/finance/recurrent/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
export function useProcessFinRecurrent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<{ processed: number }>('/api/finance/recurrent/process', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
