import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FinShoppingItem,
  CreateFinShoppingItemDto,
  UpdateFinShoppingItemDto,
} from '@life-app/shared';
import { apiClient } from '../lib/api-client';

const KEY = 'finance';

export function useFinShopping() {
  return useQuery<FinShoppingItem[]>({
    queryKey: [KEY, 'shopping'],
    queryFn: () => apiClient.get('/api/finance/shopping'),
  });
}
export function useCreateFinShopping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: CreateFinShoppingItemDto) =>
      apiClient.post<FinShoppingItem>('/api/finance/shopping', d),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
export function useUpdateFinShopping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateFinShoppingItemDto }) =>
      apiClient.patch<FinShoppingItem>(`/api/finance/shopping/${id}`, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
export function useDeleteFinShopping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/finance/shopping/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
