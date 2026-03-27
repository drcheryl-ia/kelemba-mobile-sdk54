/**
 * Projection épargne (capital / bonus estimés).
 */
import { useQuery } from '@tanstack/react-query';
import { savingsApi } from '@/api/savings.api';
import { savingsKeys } from '@/hooks/savings/keys';

export function useSavingsProjection(uid: string) {
  return useQuery({
    queryKey: savingsKeys.projection(uid),
    queryFn: () => savingsApi.projection(uid),
    enabled: !!uid,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    networkMode: 'offlineFirst',
  });
}
