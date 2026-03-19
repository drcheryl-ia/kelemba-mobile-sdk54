/**
 * Hook — détail tontine + cycle actif.
 */
import { useQuery } from '@tanstack/react-query';
import {
  getTontineDetails,
  getCurrentCycle,
} from '@/api/tontinesApi';
import type { TontineDetail, CurrentCycle } from '@/types/tontine';

const GC_TIME = 24 * 60 * 60 * 1000;

export interface UseTontineDetailsReturn {
  tontine: TontineDetail | null;
  currentCycle: CurrentCycle | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useTontineDetails(tontineUid: string): UseTontineDetailsReturn {
  const tontineQuery = useQuery({
    queryKey: ['tontine', tontineUid],
    queryFn: () => getTontineDetails(tontineUid),
    enabled: tontineUid.length > 0,
    staleTime: 5 * 60_000,
    gcTime: GC_TIME,
    networkMode: 'offlineFirst',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  });

  const cycleQuery = useQuery({
    queryKey: ['cycle', 'current', tontineUid],
    queryFn: () => getCurrentCycle(tontineUid),
    enabled: tontineUid.length > 0,
    staleTime: 30_000,
    gcTime: GC_TIME,
    networkMode: 'offlineFirst',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  });

  const refetch = () => {
    tontineQuery.refetch();
    cycleQuery.refetch();
  };

  return {
    tontine: tontineQuery.data ?? null,
    currentCycle: cycleQuery.data ?? null,
    isLoading: tontineQuery.isLoading || cycleQuery.isLoading,
    isError: tontineQuery.isError,
    refetch,
  };
}
