/**
 * Types écran Rapport — métriques agrégées et lignes par tontine.
 */

export type ReportPeriod = 'current_month' | 'quarter' | 'year' | 'all';

export interface ReportMetrics {
  totalPaidAllTime: number;
  paidThisPeriod: number;
  penaltiesPaid: number;
  punctualityRate: number;
  cyclesOnTime: number;
  cyclesTotal: number;
  completedTontinesCount: number;
  activeTontinesCount: number;
  nextPayoutAmount: number | null;
  nextPayoutTontineName: string | null;
  nextPayoutCycleNumber: number | null;
  /** Cotisations (hors pénalité) sur la période — bilan */
  contributionsExcludingPenalty: number;
  /** Cagnottes perçues sur la période (si données disponibles) */
  totalReceivedAsBeneficiaryPeriod: number;
  lateCyclesCount: number;
  lateDaysSum: number;
}

export interface TontineReportItem {
  tontineUid: string;
  tontineName: string;
  status: 'ACTIVE' | 'COMPLETED' | 'DRAFT' | 'CANCELLED';
  isCreator: boolean;
  memberCount: number;
  frequency: string;
  amountPerShare: number;
  userSharesCount: number;
  totalPaidByUser: number;
  cyclesCurrent: number;
  cyclesTotal: number;
  punctualityRate: number;
  penaltiesCount: number;
  myPayoutCycleNumber: number | null;
  totalReceivedAsBeneficiary: number;
}

export interface ScoreEventDisplay {
  uid: string;
  delta: number;
  reason: string;
  reasonLabel: string;
  tontineUid: string | null;
  createdAt: string;
  dotColor: string;
}
