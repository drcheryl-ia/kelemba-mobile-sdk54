/**
 * Détail d'une tontine épargne.
 */
import { useQuery } from '@tanstack/react-query';
import { savingsApi } from '@/api/savings.api';
import { savingsKeys } from '@/hooks/savings/keys';

export function useSavingsDetail(uid: string) {
  return useQuery({
    queryKey: savingsKeys.detail(uid),
    queryFn: () => savingsApi.detail(uid),
    enabled: !!uid,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    networkMode: 'offlineFirst',
  });
}
