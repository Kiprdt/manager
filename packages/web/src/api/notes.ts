import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NoteWithAttachments, CreateNoteDto, UpdateNoteDto } from '@life-app/shared';
import { apiClient } from '../lib/api-client';

const KEY = 'notes';

export function useNotes(filter?: { taskId?: string; timeBlockId?: string }) {
  const params = new URLSearchParams();
  if (filter?.taskId) params.set('taskId', filter.taskId);
  if (filter?.timeBlockId) params.set('timeBlockId', filter.timeBlockId);
  const qs = params.toString();
  return useQuery<NoteWithAttachments[]>({
    queryKey: [KEY, filter ?? {}],
    queryFn: () => apiClient.get(`/api/notes${qs ? `?${qs}` : ''}`),
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateNoteDto) => apiClient.post<NoteWithAttachments>('/api/notes', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateNoteDto }) =>
      apiClient.patch<NoteWithAttachments>(`/api/notes/${id}`, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/notes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUploadAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, file }: { noteId: string; file: File }) =>
      apiClient.upload<NoteWithAttachments>(`/api/notes/${noteId}/attachments`, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attId: string) => apiClient.delete(`/api/notes/attachments/${attId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
