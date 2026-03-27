/**
 * Liste des tontines épargne.
 */
import { useQuery } from '@tanstack/react-query';
import { savingsApi } from '@/api/savings.api';
import type { SavingsListItem } from '@/types/savings.types';
import { savingsKeys } from '@/hooks/savings/keys';

export function useSavingsList() {
  return useQuery({
    queryKey: savingsKeys.list(),
    queryFn: async (): Promise<SavingsListItem[]> => {
      const { tontines } = await savingsApi.list();
      return tontines;
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    networkMode: 'offlineFirst',
  });
}
