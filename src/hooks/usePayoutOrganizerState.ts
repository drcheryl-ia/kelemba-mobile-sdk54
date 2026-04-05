/**
 * GET /v1/cycles/:cycleUid/payout-organizer-state
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getPayoutOrganizerState } from '@/api/cyclePayoutApi';
import type { CyclePayoutOrganizerState } from '@/types/cyclePayout';

export function usePayoutOrganizerState(
  cycleUid: string | undefined,
  options?: { enabled?: boolean }
): UseQueryResult<CyclePayoutOrganizerState> {
  const enabled = (options?.enabled ?? true) && Boolean(cycleUid);
  return useQuery({
    queryKey: ['payout-organizer-state', cycleUid],
    queryFn: () => getPayoutOrganizerState(cycleUid!),
    enabled,
    staleTime: 30_000,
  });
}
