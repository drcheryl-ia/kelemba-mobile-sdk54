/**
 * Types Tontine Épargne — miroir du backend.
 */
// ─── Enums miroir du backend ──────────────────────────────────────

export type TontineType = 'ROTATIVE' | 'EPARGNE';

export type SavingsFrequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export type SavingsPeriodStatus = 'PENDING' | 'OPEN' | 'CLOSED';

export type SavingsContributionStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export type SavingsMemberStatus = 'ACTIVE' | 'SUSPENDED' | 'WITHDRAWN' | 'EXCLUDED';

export type SavingsWithdrawalStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

// ─── Objets métier (contrat liste / détail / solde) ─────────────────

export interface SavingsConfig {
  /** Présent dans certaines réponses API (ex. dashboard). */
  uid?: string;
  minimumContribution: number;
  bonusRatePercent: number;
  targetAmountPerMember?: number;
  targetAmountGlobal?: number;
  unlockDate: string;
  earlyExitPenaltyPercent: number;
  minScoreRequired: number;
  isPrivate: boolean;
  /** Présent si l’API dashboard renvoie la config complète. */
  maxMembers?: number;
  frequency?: SavingsFrequency;
}

export interface SavingsListItem {
  uid: string;
  name: string;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  minimumContribution: number;
  frequency: SavingsFrequency;
  unlockDate: string;
  memberCount: number;
  personalBalance: number;
  totalContributed: number;
  isCreator: boolean;
}

export interface SavingsDetail extends SavingsListItem {
  config: SavingsConfig;
  myMemberUid?: string;
  myStatus?: SavingsMemberStatus;
}

export interface SavingsPeriod {
  uid: string;
  periodNumber: number;
  openDate: string;
  closeDate: string;
  minimumAmount: number;
  status: SavingsPeriodStatus;
}

export interface SavingsMyBalance {
  personalBalance: number;
  totalContributed: number;
  missedPeriodsCount: number;
  isBonusEligible: boolean;
}

/** Réponse GET my-balance — champs additionnels selon le backend. */
export interface MyBalanceResponse extends SavingsMyBalance {
  periodsRemaining?: number;
  estimatedFinalBalance?: number;
  currentPeriod?: SavingsPeriod | null;
  contributionThisPeriod?: SavingsContribution | null;
}

export interface SavingsWithdrawalPreview {
  capitalAmount: number;
  estimatedBonusAmount: number;
  penaltyAmount: number;
  totalAmount: number;
  canWithdraw: boolean;
  reasonIfBlocked?: string | null;
  isEarlyExitPossible: boolean;
  unlockDate: string;
  previewDisclosure: string;
}

export interface SavingsProjection {
  totalContributed: number;
  remainingPeriodsCount: number;
  minimumRemainingAmount: number;
  estimatedFinalCapital: number;
  estimatedBonus: number;
  estimatedPayout: number;
  projectionDisclosure: string;
}

export interface SavingsBonusPool {
  currentBalance: number;
  alreadyDistributed: number;
  eligibleMembersCount: number;
  distributionMode: string;
}

export interface SavingsMemberSummary {
  uid: string;
  userUid: string;
  fullName: string;
  personalBalance: number | null;
  isBonusEligible: boolean;
  status: SavingsMemberStatus;
  hasContributedThisPeriod: boolean;
}

export interface SavingsContribution {
  uid: string;
  grossAmount: number;
  netAmount: number;
  bonusDeducted: number;
  penaltyAmount: number;
  isLate: boolean;
  status: SavingsContributionStatus;
  paidAt: string | null;
  period: Pick<SavingsPeriod, 'uid' | 'periodNumber' | 'openDate' | 'closeDate'>;
}

export interface SavingsDashboard {
  tontine: {
    uid: string;
    name: string;
    status: string;
    frequency: string;
    unlockDate: string;
  };
  savingsConfig: SavingsConfig;
  currentPeriod: SavingsPeriod | null;
  members: SavingsMemberSummary[];
  bonusPoolBalance: number;
  globalProgressPercent: number | null;
}

// ─── DTOs envoyés au backend ──────────────────────────────────────

export interface CreateSavingsTontinePayload {
  name: string;
  minimumContribution: number;
  frequency: SavingsFrequency;
  startDate: string;
  unlockDate: string;
  bonusRatePercent?: number;
  targetAmountPerMember?: number;
  targetAmountGlobal?: number;
  maxMembers?: number;
  minScoreRequired?: number;
  earlyExitPenaltyPercent?: number;
  isPrivate?: boolean;
}

export interface ContributeSavingsPayload {
  periodUid: string;
  amount: number;
  method: 'ORANGE_MONEY' | 'TELECEL_MONEY' | 'CASH';
  idempotencyKey: string;
}

export interface WithdrawSavingsPayload {
  method: 'ORANGE_MONEY' | 'TELECEL_MONEY' | 'CASH';
  idempotencyKey: string;
}

/** @deprecated Utiliser WithdrawSavingsPayload */
export type RequestWithdrawalPayload = WithdrawSavingsPayload;
