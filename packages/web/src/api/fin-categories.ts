import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FinCategory, CreateFinCategoryDto, UpdateFinCategoryDto } from '@life-app/shared';
import { apiClient } from '../lib/api-client';

const KEY = 'finance';

export function useFinCategories() {
  return useQuery<FinCategory[]>({
    queryKey: [KEY, 'categories'],
    queryFn: () => apiClient.get('/api/finance/categories'),
  });
}
export function useCreateFinCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: CreateFinCategoryDto) =>
      apiClient.post<FinCategory>('/api/finance/categories', d),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
export function useUpdateFinCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateFinCategoryDto }) =>
      apiClient.patch<FinCategory>(`/api/finance/categories/${id}`, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
export function useDeleteFinCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/finance/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
