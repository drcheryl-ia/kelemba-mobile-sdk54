/**
 * Hook — envoi d'une invitation nominative à une tontine.
 * Backend attend { phone, sharesCount } — pas de bulk.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inviteMemberByPhone, type InviteMemberPayload } from '@/api/tontinesApi';

export interface UseSendInvitationsOptions {
  tontineUid: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useSendInvitations({
  tontineUid,
  onSuccess,
  onError,
}: UseSendInvitationsOptions) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (payload: InviteMemberPayload) =>
      inviteMemberByPhone(tontineUid, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', tontineUid] });
      queryClient.invalidateQueries({ queryKey: ['tontineDetails', tontineUid] });
      queryClient.invalidateQueries({ queryKey: ['tontines'] });
      queryClient.invalidateQueries({ queryKey: ['invitationsReceived'] });
      onSuccess?.();
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });

  return mutation;
}
