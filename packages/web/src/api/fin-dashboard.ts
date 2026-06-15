import { useQuery } from '@tanstack/react-query';
import { FinDashboard } from '@life-app/shared';
import { apiClient } from '../lib/api-client';

const KEY = 'finance';

export function useFinDashboard() {
  return useQuery<FinDashboard>({
    queryKey: [KEY, 'dashboard'],
    queryFn: () => apiClient.get('/api/finance/dashboard'),
  });
}
