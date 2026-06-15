import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FinanceTx,
  FinanceInstrument,
  CreateFinanceTxDto,
  UpdateFinanceTxDto,
  CreateFinanceInstrumentDto,
} from '@life-app/shared';
import { apiClient } from '../lib/api-client';

const KEY = 'finance';

export function useFinanceTx(from: Date, to: Date) {
  const qs = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() }).toString();
  return useQuery<FinanceTx[]>({
    queryKey: [KEY, 'tx', from.toISOString(), to.toISOString()],
    queryFn: () => apiClient.get(`/api/finance/tx?${qs}`),
  });
}
export function useCreateTx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: CreateFinanceTxDto) => apiClient.post<FinanceTx>('/api/finance/tx', d),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
export function useUpdateTx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateFinanceTxDto }) =>
      apiClient.patch<FinanceTx>(`/api/finance/tx/${id}`, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
export function useDeleteTx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/finance/tx/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useInstruments() {
  return useQuery<FinanceInstrument[]>({
    queryKey: [KEY, 'instruments'],
    queryFn: () => apiClient.get('/api/finance/instruments'),
  });
}
export function useCreateInstrument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: CreateFinanceInstrumentDto) =>
      apiClient.post<FinanceInstrument>('/api/finance/instruments', d),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
export function useDeleteInstrument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/finance/instruments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
