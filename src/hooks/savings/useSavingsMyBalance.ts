/**
 * Solde personnel épargne (GET my-balance).
 */
import { useQuery } from '@tanstack/react-query';
import { savingsApi } from '@/api/savings.api';
import { savingsKeys } from '@/hooks/savings/keys';

export function useSavingsMyBalance(uid: string) {
  return useQuery({
    queryKey: savingsKeys.myBalance(uid),
    queryFn: () => savingsApi.myBalance(uid),
    enabled: !!uid,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    networkMode: 'offlineFirst',
  });
}
