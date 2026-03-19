/**
 * Hook — lien d'invitation et QR Code pour une tontine.
 */
import { useQuery } from '@tanstack/react-query';
import { getInviteLink } from '@/api/tontinesApi';
import type { InviteLinkResponse } from '@/types/invite';

export interface UseInviteLinkReturn {
  data: InviteLinkResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface UseInviteLinkOptions {
  enabled?: boolean;
}

export function useInviteLink(
  tontineUid: string,
  options?: UseInviteLinkOptions
): UseInviteLinkReturn {
  const enabled = options?.enabled ?? !!tontineUid;
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['tontines', tontineUid, 'invite-link'],
    queryFn: () => getInviteLink(tontineUid),
    enabled: enabled && !!tontineUid,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    networkMode: 'offlineFirst',
  });

  return {
    data,
    isLoading,
    isError,
    error: error instanceof Error ? error : null,
    refetch,
  };
}
