/**
 * Périodes de cotisation épargne.
 */
import { useQuery } from '@tanstack/react-query';
import { savingsApi } from '@/api/savings.api';
import { savingsKeys } from '@/hooks/savings/keys';

export function useSavingsPeriods(uid: string) {
  return useQuery({
    queryKey: savingsKeys.periods(uid),
    queryFn: () => savingsApi.periods(uid),
    enabled: !!uid,
    staleTime: 30_000,
    gcTime: 30 * 60_000,
    networkMode: 'offlineFirst',
  });
}
