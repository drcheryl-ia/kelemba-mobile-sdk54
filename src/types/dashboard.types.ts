/**
 * Types UI — dashboard (activité récente, etc.).
 */

export type ActivityItemType = 'payment' | 'penalty' | 'score' | 'invitation';

export interface ActivityItem {
  id: string;
  type: ActivityItemType;
  description: string;
  amount?: number;
  amountSuffix?: string;
  timestamp: string;
  dotColor: string;
}

/** Variants carte héro accueil — priorité gérée par `useHomeHeroState`. */
export type HeroCardVariant =
  | 'PAYOUT_IN_PROGRESS'
  | 'PAYOUT_READY'
  | 'OVERDUE'
  | 'DUE'
  | 'PAYMENT_PENDING_VALIDATION'
  | 'CASH_PENDING'
  | 'INVITATION_PENDING'
  | 'NEUTRAL';

export interface HeroCardState {
  variant: HeroCardVariant;

  /** Cotisation (OVERDUE | DUE) */
  tontineName?: string;
  cycleLabel?: string;
  amountDue?: number;
  /** OVERDUE : jours de retard · DUE : jours jusqu’à l’échéance (0 = aujourd’hui) */
  daysLate?: number;
  cycleUid?: string;
  tontineUid?: string;
  isCreator?: boolean;
  hasPenaltyIncluded?: boolean;
  /** Navigation `PaymentScreen` (OVERDUE | DUE) */
  penaltyAmount?: number;
  cycleNumber?: number;
  /** Montant cotisation de base (hors pénalité) — `PaymentScreen.baseAmount` */
  paymentBaseAmount?: number;

  /** Cagnotte (PAYOUT_READY | PAYOUT_IN_PROGRESS) */
  payoutTontineName?: string;
  payoutBeneficiaryName?: string | null;
  payoutAmount?: number;
  payoutCycleUid?: string;
  payoutTontineUid?: string;
  payoutOperator?: string | null;

  /** Espèces (CASH_PENDING) */
  cashPendingCount?: number;
  cashTontineNamesHint?: string;

  /** Invitations (INVITATION_PENDING) */
  invitationCount?: number;
  firstInvitationName?: string;
  firstInvitationAmount?: number;
  firstInvitationMemberCount?: number;
  firstInvitationTontineUid?: string;
  /** Navigation `TontineContractSignature` */
  firstInvitationMode?: 'INVITE_ACCEPT' | 'JOIN_REQUEST';

  /** PAYMENT_PENDING_VALIDATION */
  paymentPendingTontineName?: string;
  paymentPendingCycleLabel?: string;
  paymentPendingAmount?: number;
}

/** Une page du carousel héro — `pageKey` stable pour la FlatList. */
export type HeroCardPage = HeroCardState & {
  pageKey: string;
};
