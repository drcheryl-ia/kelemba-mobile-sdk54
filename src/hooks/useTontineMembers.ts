/**
 * Hook — liste des membres d'une tontine.
 */
import { useQuery } from '@tanstack/react-query';
import { getTontineMembers } from '@/api/tontinesApi';
import type { TontineMember } from '@/types/tontine';

const GC_TIME = 24 * 60 * 60 * 1000;

export interface UseTontineMembersReturn {
  members: TontineMember[];
  isLoading: boolean;
  refetch: () => void;
}

export function useTontineMembers(tontineUid: string): UseTontineMembersReturn {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['members', tontineUid],
    queryFn: () => getTontineMembers(tontineUid),
    enabled: tontineUid.length > 0,
    staleTime: 60_000,
    gcTime: GC_TIME,
    networkMode: 'offlineFirst',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  });

  return {
    members: data ?? [],
    isLoading,
    refetch,
  };
}
