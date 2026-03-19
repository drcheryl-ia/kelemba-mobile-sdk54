/**
 * Hook — liste des tontines et invitations en attente.
 * - tontines : GET /v1/tontines/me (actives + PENDING join requests)
 * - invitations : GET /v1/tontines/invitations/received (invitations nominatives INVITE)
 */
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { getTontines, getReceivedInvitations } from '@/api/tontinesApi';
import { selectUserUid } from '@/store/authSlice';
import type { RootState } from '@/store/store';
import type { TontineListItem } from '@/types/tontine';

export interface UseTontinesReturn {
  tontines: TontineListItem[];
  invitations: TontineListItem[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  dataUpdatedAt: number;
  refetch: () => void;
}

export function useTontines(): UseTontinesReturn {
  const userUid = useSelector((state: RootState) => selectUserUid(state));
  const enabled = userUid !== null;

  const tontinesQuery = useQuery({
    queryKey: ['tontines', userUid],
    queryFn: getTontines,
    enabled,
    staleTime: 60_000,
    gcTime: 24 * 60 * 60 * 1000,
    networkMode: 'offlineFirst',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  });

  const invitationsQuery = useQuery({
    queryKey: ['invitationsReceived', userUid],
    queryFn: getReceivedInvitations,
    enabled,
    staleTime: 30_000,
    gcTime: 24 * 60 * 60 * 1000,
    networkMode: 'offlineFirst',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  });

  const tontines = tontinesQuery.data ?? [];
  const invitations = invitationsQuery.data ?? [];

  const isLoading = tontinesQuery.isLoading || invitationsQuery.isLoading;
  const isFetching = tontinesQuery.isFetching || invitationsQuery.isFetching;
  const isError = tontinesQuery.isError || invitationsQuery.isError;
  const dataUpdatedAt = Math.max(
    tontinesQuery.dataUpdatedAt ?? 0,
    invitationsQuery.dataUpdatedAt ?? 0
  );

  const refetch = () => {
    void tontinesQuery.refetch();
    void invitationsQuery.refetch();
  };

  return {
    tontines,
    invitations,
    isLoading,
    isFetching,
    isError,
    dataUpdatedAt,
    refetch,
  };
}
