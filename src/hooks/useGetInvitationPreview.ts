import { useQuery } from '@tanstack/react-query';
import { getTontinePreview } from '@/api/tontinesApi';
import type { TontinePreviewDto } from '@/types/tontine.types';

/**
 * GET /api/v1/tontines/invitation/:uid/preview — sans JWT.
 */
export function useGetInvitationPreview(
  tontineUid: string | null,
  enabled: boolean
) {
  return useQuery({
    queryKey: ['tontines', 'invitationPreview', tontineUid],
    queryFn: async () => {
      const data = await getTontinePreview(tontineUid!);
      return data as TontinePreviewDto;
    },
    enabled: Boolean(enabled && tontineUid),
  });
}
