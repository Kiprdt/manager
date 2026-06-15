import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Task, TaskWithSubtasks, CreateTaskDto, UpdateTaskDto, TaskListQuery } from '@life-app/shared';
import { apiClient } from '../lib/api-client';
import { wsClient } from '../lib/ws';

const TASKS_KEY = 'tasks';

function buildUrl(query: TaskListQuery): string {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  params.set('limit', String(query.limit ?? 50));
  params.set('offset', String(query.offset ?? 0));
  return `/api/tasks?${params}`;
}

export function useTasks(query: TaskListQuery = {}) {
  const qc = useQueryClient();

  // Инвалидируем кэш при входящих WS-событиях о задачах
  useEffect(() => {
    return wsClient.on((event) => {
      if (event.type.startsWith('task.')) {
        qc.invalidateQueries({ queryKey: [TASKS_KEY] });
      }
    });
  }, [qc]);

  return useQuery<Task[]>({
    queryKey: [TASKS_KEY, query],
    queryFn: () => apiClient.get<Task[]>(buildUrl(query)),
  });
}

export function useTask(id: string | null) {
  return useQuery<TaskWithSubtasks>({
    queryKey: [TASKS_KEY, id],
    queryFn: () => apiClient.get<TaskWithSubtasks>(`/api/tasks/${id}`),
    enabled: !!id,
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: [TASKS_KEY] });
  // Задачи могут быть привязаны к мероприятиям — обновляем и их карточки
  qc.invalidateQueries({ queryKey: ['timeblocks'] });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTaskDto) => apiClient.post<Task>('/api/tasks', dto),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateTaskDto }) =>
      apiClient.patch<Task>(`/api/tasks/${id}`, dto),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/tasks/${id}`),
    onSuccess: () => invalidateAll(qc),
  });
}
