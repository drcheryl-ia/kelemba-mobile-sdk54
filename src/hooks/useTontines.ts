/**
 * Hook — liste des tontines et invitations en attente.
 * - tontines : GET /v1/tontines/me (actives + PENDING join requests)
 * - invitations : GET /v1/tontines/invitations/received (invitations nominatives INVITE)
 */
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { shouldRetryApiQuery } from '@/api/errors/queryRetry';
import { getTontines, getReceivedInvitations } from '@/api/tontinesApi';
import { selectUserUid } from '@/store/authSlice';
import type { RootState } from '@/store/store';
import type { TontineListItem } from '@/types/tontine';
import {
  resolveUseTontinesOptions,
  type UseTontinesOptions,
} from './useTontines.options';

export interface UseTontinesReturn {
  tontines: TontineListItem[];
  invitations: TontineListItem[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  dataUpdatedAt: number;
  refetch: () => void;
}

export function useTontines(options?: UseTontinesOptions): UseTontinesReturn {
  const userUid = useSelector((state: RootState) => selectUserUid(state));
  const enabled = userUid !== null;
  const resolvedOptions = resolveUseTontinesOptions(options);

  const tontinesQuery = useQuery({
    queryKey: ['tontines', userUid],
    queryFn: getTontines,
    enabled,
    staleTime: 60_000,
    gcTime: 24 * 60 * 60 * 1000,
    networkMode: 'offlineFirst',
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: shouldRetryApiQuery,
  });

  const invitationsQuery = useQuery({
    queryKey: ['invitationsReceived', userUid],
    queryFn: getReceivedInvitations,
    enabled: enabled && resolvedOptions.includeInvitations,
    staleTime: 30_000,
    gcTime: 24 * 60 * 60 * 1000,
    networkMode: 'offlineFirst',
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: shouldRetryApiQuery,
  });

  const tontines = tontinesQuery.data ?? [];
  const invitations = invitationsQuery.data ?? [];

  const isLoading =
    tontinesQuery.isLoading ||
    (resolvedOptions.includeInvitations && invitationsQuery.isLoading);
  const isFetching =
    tontinesQuery.isFetching ||
    (resolvedOptions.includeInvitations && invitationsQuery.isFetching);
  const isError =
    tontinesQuery.isError ||
    (resolvedOptions.includeInvitations && invitationsQuery.isError);
  const dataUpdatedAt = Math.max(
    tontinesQuery.dataUpdatedAt ?? 0,
    resolvedOptions.includeInvitations ? invitationsQuery.dataUpdatedAt ?? 0 : 0
  );

  const refetch = () => {
    void tontinesQuery.refetch();
    if (resolvedOptions.includeInvitations) {
      void invitationsQuery.refetch();
    }
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
