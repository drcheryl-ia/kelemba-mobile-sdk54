/**
 * Hook React Query pour charger l'aperçu du contrat de tontine.
 */
import { useQuery } from '@tanstack/react-query';
import { getTontineContractPreview } from '@/api/tontinesApi';

export function useTontineContractPreview(
  tontineUid: string,
  enabled: boolean
) {
  return useQuery({
    queryKey: ['tontineContractPreview', tontineUid],
    queryFn: () => getTontineContractPreview(tontineUid),
    enabled: Boolean(tontineUid) && enabled,
  });
}
