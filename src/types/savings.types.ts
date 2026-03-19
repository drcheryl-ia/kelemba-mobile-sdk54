/**
 * Types Tontine Épargne — miroir du backend.
 */
// ─── Enums miroir du backend ──────────────────────────────────────

export type TontineType = 'ROTATIVE' | 'EPARGNE';

export type SavingsPeriodStatus = 'PENDING' | 'OPEN' | 'CLOSED';

export type SavingsContributionStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export type SavingsMemberStatus = 'ACTIVE' | 'SUSPENDED' | 'WITHDRAWN' | 'EXCLUDED';

export type SavingsWithdrawalStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

// ─── Objets métier ────────────────────────────────────────────────

export interface SavingsConfig {
  uid: string;
  minimumContribution: number;
  bonusRatePercent: number;
  targetAmountPerMember: number | null;
  targetAmountGlobal: number | null;
  unlockDate: string; // ISO 8601
  earlyExitPenaltyPercent: number;
  minScoreRequired: number;
  isPrivate: boolean;
}

export interface SavingsPeriod {
  uid: string;
  periodNumber: number;
  openDate: string;
  closeDate: string;
  minimumAmount: number;
  status: SavingsPeriodStatus;
}

export interface SavingsMemberSummary {
  uid: string;
  userUid: string;
  fullName: string;
  personalBalance: number | null; // null si isPrivate
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

export interface MyBalanceResponse {
  personalBalance: number;
  totalContributed: number;
  isBonusEligible: boolean;
  missedPeriodsCount: number;
  periodsRemaining: number;
  estimatedFinalBalance: number;
  currentPeriod: SavingsPeriod | null;
  contributionThisPeriod: SavingsContribution | null;
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

export interface SavingsWithdrawalPreview {
  capitalAmount: number;
  bonusAmount: number;
  penaltyAmount: number;
  totalAmount: number;
  isEarlyExit: boolean;
  earlyExitPenaltyPercent: number;
}

// ─── DTOs envoyés au backend ──────────────────────────────────────

export interface CreateSavingsTontinePayload {
  name: string;
  minimumContribution: number;
  frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  startDate: string; // YYYY-MM-DD
  unlockDate: string; // YYYY-MM-DD
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
  method: 'ORANGE_MONEY' | 'TELECEL_MONEY';
  idempotencyKey: string;
}

export interface RequestWithdrawalPayload {
  method: 'ORANGE_MONEY' | 'TELECEL_MONEY';
  idempotencyKey: string;
}
