import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Category, CreateCategoryDto } from '@life-app/shared';
import { apiClient } from '../lib/api-client';

const KEY = 'categories';

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: [KEY],
    queryFn: () => apiClient.get('/api/categories'),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCategoryDto) => apiClient.post<Category>('/api/categories', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
