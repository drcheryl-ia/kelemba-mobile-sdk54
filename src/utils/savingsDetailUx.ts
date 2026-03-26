/**
 * États d’affichage cohérents — détail tontine épargne (données API uniquement).
 */
import type { SavingsMemberStatus } from '@/types/savings.types';

export type SavingsDetailStatusKey =
  | 'SUSPENDED'
  | 'LATE'
  | 'UP_TO_DATE'
  | 'WITHDRAW_AVAILABLE';

export function deriveSavingsDetailStatusKey(input: {
  memberStatus: SavingsMemberStatus | undefined;
  periodOpen: boolean;
  contributedThisPeriod: boolean;
  unlockReached: boolean;
}): SavingsDetailStatusKey {
  if (input.memberStatus === 'SUSPENDED') return 'SUSPENDED';
  if (input.periodOpen && !input.contributedThisPeriod) return 'LATE';
  if (input.unlockReached) return 'WITHDRAW_AVAILABLE';
  return 'UP_TO_DATE';
}
