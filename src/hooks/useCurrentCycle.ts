/**
 * Hook — cycle actuel d'une tontine.
 */
import { useQuery } from '@tanstack/react-query';
import { getCurrentCycle } from '@/api/tontinesApi';
import type { CurrentCycle } from '@/api/tontinesApi';

export interface UseCurrentCycleReturn {
  cycle: CurrentCycle | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useCurrentCycle(tontineUid: string): UseCurrentCycleReturn {
  const query = useQuery({
    queryKey: ['currentCycle', tontineUid],
    queryFn: () => getCurrentCycle(tontineUid),
    staleTime: 30_000,
    enabled: Boolean(tontineUid),
  });

  return {
    cycle: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
