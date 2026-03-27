/**
 * Pool bonus commun (GET bonus-pool).
 */
import { useQuery } from '@tanstack/react-query';
import { savingsApi } from '@/api/savings.api';
import { savingsKeys } from '@/hooks/savings/keys';

export function useSavingsBonusPool(uid: string) {
  return useQuery({
    queryKey: savingsKeys.bonusPool(uid),
    queryFn: () => savingsApi.bonusPool(uid),
    enabled: !!uid,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    networkMode: 'offlineFirst',
  });
}

