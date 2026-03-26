/**
 * Statut d’affichage d’un cycle de rotation — partagé liste / hooks / accueil.
 */
import type {
  CycleDisplayStatus,
  TontineRotationResponse,
} from '@/types/rotation';

export function computeCycleDisplayStatus(
  cycle: TontineRotationResponse['cycles'][0],
  currentCycleNumber: number
): CycleDisplayStatus {
  const backendStatus = cycle.displayStatus as CycleDisplayStatus | undefined;
  const VALID: CycleDisplayStatus[] = [
    'VERSÉ',
    'EN_COURS',
    'PROCHAIN',
    'À_VENIR',
    'RETARDÉ',
  ];
  if (backendStatus && VALID.includes(backendStatus)) {
    return backendStatus;
  }

  if (cycle.status === 'COMPLETED' || cycle.status === 'PAYOUT_COMPLETED') {
    return 'VERSÉ';
  }

  if (cycle.status === 'SKIPPED') {
    return 'À_VENIR';
  }

  const delayed = cycle.delayedByMemberUids ?? [];
  const hasActiveDelay =
    delayed.length > 0 &&
    (cycle.status === 'ACTIVE' ||
      cycle.status === 'PAYOUT_IN_PROGRESS' ||
      cycle.status === 'PENDING');
  if (hasActiveDelay) return 'RETARDÉ';

  if (cycle.status === 'ACTIVE' || cycle.status === 'PAYOUT_IN_PROGRESS') {
    return 'EN_COURS';
  }

  if (cycle.status === 'PENDING') {
    if (cycle.cycleNumber === currentCycleNumber + 1) return 'PROCHAIN';
    return 'À_VENIR';
  }

  return 'À_VENIR';
}
