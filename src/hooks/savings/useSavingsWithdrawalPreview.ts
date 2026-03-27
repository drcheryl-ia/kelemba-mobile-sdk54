/**
 * Prévisualisation de retrait épargne.
 */
import { useQuery } from '@tanstack/react-query';
import { savingsApi } from '@/api/savings.api';
import { savingsKeys } from '@/hooks/savings/keys';

export function useSavingsWithdrawalPreview(uid: string) {
  return useQuery({
    queryKey: savingsKeys.withdrawalPreview(uid),
    queryFn: () => savingsApi.withdrawalPreview(uid),
    enabled: !!uid,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    networkMode: 'offlineFirst',
  });
}
