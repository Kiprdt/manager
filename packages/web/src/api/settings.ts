import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Setting, UpdateSettingDto } from '@life-app/shared';
import { apiClient } from '../lib/api-client';

const KEY = 'settings';

export function useSettings() {
  return useQuery<Setting>({ queryKey: [KEY], queryFn: () => apiClient.get('/api/settings') });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateSettingDto) => apiClient.patch<Setting>('/api/settings', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useTelegramTest() {
  return useMutation({
    mutationFn: () => apiClient.post<{ ok: boolean; error?: string }>('/api/settings/telegram/test', {}),
  });
}

export function useTelegramDigest() {
  return useMutation({
    mutationFn: () => apiClient.post<{ ok: boolean; error?: string }>('/api/settings/telegram/digest', {}),
  });
}
