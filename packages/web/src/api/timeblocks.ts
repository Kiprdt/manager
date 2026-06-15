import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  TimeBlock,
  TimeBlockWithTasks,
  CreateTimeBlockDto,
  UpdateTimeBlockDto,
} from '@life-app/shared';
import { apiClient } from '../lib/api-client';
import { wsClient } from '../lib/ws';

const BLOCKS_KEY = 'timeblocks';

export function useTimeBlocks(from: Date, to: Date) {
  const qc = useQueryClient();

  useEffect(() => {
    return wsClient.on((event) => {
      if (event.type.startsWith('timeblock.')) {
        qc.invalidateQueries({ queryKey: [BLOCKS_KEY] });
      }
    });
  }, [qc]);

  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  });

  return useQuery<TimeBlock[]>({
    queryKey: [BLOCKS_KEY, from.toISOString(), to.toISOString()],
    queryFn: () => apiClient.get<TimeBlock[]>(`/api/timeblocks?${params}`),
  });
}

export function useTimeBlock(id: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!id) return;
    return wsClient.on((event) => {
      if (event.type.startsWith('timeblock.') || event.type.startsWith('task.')) {
        qc.invalidateQueries({ queryKey: [BLOCKS_KEY, 'detail', id] });
      }
    });
  }, [qc, id]);

  return useQuery<TimeBlockWithTasks>({
    queryKey: [BLOCKS_KEY, 'detail', id],
    queryFn: () => apiClient.get<TimeBlockWithTasks>(`/api/timeblocks/${id}`),
    enabled: !!id,
  });
}

export function useCreateTimeBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTimeBlockDto) => apiClient.post<TimeBlock>('/api/timeblocks', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: [BLOCKS_KEY] }),
  });
}

export function useUpdateTimeBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateTimeBlockDto }) =>
      apiClient.patch<TimeBlock>(`/api/timeblocks/${id}`, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: [BLOCKS_KEY] }),
  });
}

export function useDeleteTimeBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/timeblocks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [BLOCKS_KEY] }),
  });
}
