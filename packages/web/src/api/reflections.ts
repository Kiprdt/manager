import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Reflection, UpsertReflectionDto } from '@life-app/shared';
import { apiClient } from '../lib/api-client';

const KEY = 'reflections';

export function useReflections(from: Date, to: Date) {
  return useQuery<Reflection[]>({
    queryKey: [KEY, from.toISOString(), to.toISOString()],
    queryFn: () =>
      apiClient.get(`/api/reflections?from=${from.toISOString()}&to=${to.toISOString()}`),
  });
}

export function useUpsertReflection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpsertReflectionDto) => apiClient.put<Reflection>('/api/reflections', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
