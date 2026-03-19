/**
 * Hook — rapport complet tontine (timeline rotation).
 */
import { useQuery } from '@tanstack/react-query';
import { getTontineReport } from '@/api/tontinesApi';
import type { TontineReportSummary } from '@/types/tontine';

const GC_TIME = 24 * 60 * 60 * 1000;

export interface UseTontineReportReturn {
  report: TontineReportSummary | null;
  isLoading: boolean;
  refetch: () => void;
}

export function useTontineReport(tontineUid: string): UseTontineReportReturn {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['report', tontineUid],
    queryFn: () => getTontineReport(tontineUid),
    enabled: tontineUid.length > 0,
    staleTime: 5 * 60_000,
    gcTime: GC_TIME,
    networkMode: 'offlineFirst',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  });

  return {
    report: data ?? null,
    isLoading,
    refetch,
  };
}
