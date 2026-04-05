/**
 * DTO prévisualisation invitation — GET /tontines/invitation/:uid/preview (public).
 */
export interface TontinePreviewDto {
  uid: string;
  name: string;
  amountPerShare: number;
  frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  totalCycles: number;
  memberCount: number;
  status: 'DRAFT' | 'ACTIVE';
  creatorName?: string | null;
  /** Score Kelemba de l’organisatrice si exposé par l’API */
  creatorKelembScore?: number | null;
  /** Plafond membres si exposé */
  maxMemberCount?: number | null;
  rules?: {
    penaltyRate?: number;
    gracePeriodDays?: number;
    minScoreRequired?: number;
    maxSharesPerMember?: number;
  } | null;
}
