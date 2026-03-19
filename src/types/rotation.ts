/**
 * Types pour la rotation complète d'une tontine.
 */

export type CycleStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'PAYOUT_IN_PROGRESS'
  | 'PAYOUT_COMPLETED'
  | 'SKIPPED';

/** Statut visuel simplifié pour l'UI — dérivé de CycleStatus */
export type CycleDisplayStatus =
  | 'VERSÉ' // PAYOUT_COMPLETED
  | 'EN_COURS' // ACTIVE ou PAYOUT_IN_PROGRESS
  | 'PROCHAIN' // PENDING et immédiatement après le cycle ACTIVE
  | 'À_VENIR' // PENDING au-delà du prochain
  | 'RETARDÉ'; // ACTIVE ou PENDING avec delayedByMemberUids.length > 0

export interface RotationCycle {
  uid: string;
  cycleNumber: number;
  beneficiaryUid: string;
  beneficiaryName: string;
  expectedDate: string;
  actualPayoutDate: string | null;
  collectedAmount: number;
  totalExpected: number;
  status: CycleStatus;
  displayStatus: CycleDisplayStatus;
  collectionProgress: number;
  delayedByMemberUids: string[];
  isCurrentUserBeneficiary: boolean;
}

/** Réponse brute de l'API GET /tontines/:uid/rotation */
export interface TontineRotationResponse {
  tontineUid: string;
  tontineName: string;
  totalAmount: number;
  currentCycleNumber: number;
  totalCycles: number;
  totalParts?: number;
  rotationModeExtended?: string;
  rotationPlanLength?: number;
  memberCount: number;
  cycles: Array<{
    uid: string;
    cycleNumber: number;
    beneficiaryUid: string;
    beneficiaryName: string;
    expectedDate: string;
    actualPayoutDate: string | null;
    collectedAmount: number;
    totalExpected: number;
    status: CycleStatus;
    delayedByMemberUids: string[];
    isCurrentUserBeneficiary: boolean;
  }>;
}
