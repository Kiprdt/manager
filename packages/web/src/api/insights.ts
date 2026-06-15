import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export interface AnalyzeResult {
  configured: boolean;
  text?: string;
  error?: string;
  snapshot: unknown;
}

export function useAnalyze() {
  return useMutation({
    mutationFn: (question?: string) =>
      apiClient.post<AnalyzeResult>('/api/insights/analyze', { question }),
  });
}
