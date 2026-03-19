/**
 * Types tontine — création, règles, rotation, liste, détails.
 */
import type { TontineFrequency } from '@/api/types/api.types';
import type { PaymentStatus } from '@/types/domain.types';
import type { TontineType } from '@/types/savings.types';

export type { TontineFrequency };

export type CycleStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'PAYOUT_IN_PROGRESS'
  | 'PAYOUT_COMPLETED'
  | 'SKIPPED';

export interface CurrentCycle {
  uid: string;
  cycleNumber: number;
  expectedDate: string;
  actualPayoutDate: string | null;
  totalAmount: number;
  delayedByMemberIds: string[] | null;
  status: CycleStatus;
  beneficiaryMembershipUid: string | null;
}

export interface TontineMember {
  uid: string;
  userUid: string;
  fullName: string;
  phone: string;
  sharesCount: number;
  rotationOrder: number;
  memberRole: MemberRole;
  membershipStatus: MembershipStatus;
  kelembScore: number;
  currentCyclePaymentStatus: PaymentStatus | null;
  paidAmount: number;
  signedAt: string | null;
}

export type PaymentMethod = 'ORANGE_MONEY' | 'TELECEL_MONEY' | 'SYSTEM';

export interface PaymentHistoryItem {
  uid: string;
  cycleUid?: string;
  amount: number;
  penalty: number;
  totalPaid: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: string | null;
  createdAt?: string;
  cycleNumber: number;
  tontineUid: string;
  tontineName: string;
}

export interface TontineDetail {
  uid: string;
  name: string;
  status: TontineStatus;
  type?: TontineType;
  amountPerShare: number;
  frequency: TontineFrequency;
  startDate: string;
  totalCycles: number;
  rotationChanged: boolean;
  rules: TontineRules;
  createdAt: string;
  isCreator?: boolean;
  canInvite?: boolean;
}

export interface TontineReportCycle {
  cycleNumber: number;
  expectedDate: string;
  status: CycleStatus;
  beneficiaryName?: string;
  beneficiaryUid?: string;
  delayedByMemberIds?: string[] | null;
}

export interface TontineReportSummary {
  tontineUid: string;
  cycles: TontineReportCycle[];
}

export type TontineStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED';

export type MembershipStatus = 'PENDING' | 'ACTIVE' | 'LEFT' | 'EXPELLED';

export type MemberRole = 'CREATOR' | 'MEMBER';

// ⚠️ NE PAS confondre :
// AccountType (users.accountType) : 'MEMBRE' | 'ORGANISATEUR' → type de compte global
// MemberRole  (memberships.role)  : 'MEMBER' | 'CREATOR'     → rôle dans une tontine

/** Origine du PENDING — invitation nominative vs join request lien/QR */
export type InvitationOrigin = 'INVITE' | 'JOIN_REQUEST';

/** Invitation téléphone : action du membre invité → activation automatique */
export const ORIGIN_INVITE: InvitationOrigin = 'INVITE';

/** Demande lien/QR : action de l'organisateur → activation après approbation */
export const ORIGIN_JOIN_REQUEST: InvitationOrigin = 'JOIN_REQUEST';

export interface TontineListItem {
  uid: string;
  name: string;
  status: TontineStatus;
  type?: TontineType;
  amountPerShare: number;
  frequency: TontineFrequency;
  totalCycles: number;
  currentCycle: number | null;
  membershipRole: MemberRole;
  membershipStatus: MembershipStatus;
  hasPaymentDue: boolean;
  nextPaymentDate: string | null;
  isCreator?: boolean;
  canInvite?: boolean;
  startDate?: string;
  activeMemberCount?: number;
  /** INVITE = nominative, acceptation directe ; JOIN_REQUEST = via lien/QR, validation organisateur */
  invitationOrigin?: InvitationOrigin;
  /** Flag UI : adhésion non finalisée, carte non cliquable */
  isPending?: boolean;
}

export type RotationType = 'RANDOM' | 'MANUAL';

export interface TontineRules {
  penaltyType: 'FIXED' | 'PERCENTAGE';
  penaltyValue: number;
  gracePeriodDays: number;
  suspensionAfterDays: number;
  rotationType: RotationType;
}

export interface CreateTontinePayload {
  name: string;
  amountPerShare: number;
  frequency: TontineFrequency;
  startDate: string;
  totalCycles: number;
  rules: TontineRules;
}

/** Membre avec rôle et statut — aligné backend */
export interface Membership {
  uid: string;
  userUid: string;
  fullName: string;
  role: 'CREATOR' | 'MEMBER';
  rotationOrder: number;
  status: 'PENDING' | 'ACTIVE' | 'LEFT' | 'EXPELLED';
  signedAt: string | null;
}

/** Demande d'échange de position dans la rotation */
export interface RotationSwapRequest {
  uid: string;
  requesterUid: string;
  requesterName: string;
  targetUid: string;
  targetName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: string;
  decidedAt: string | null;
}

/** Payload réordonnancement manuel */
export interface ReorderRotationPayload {
  orderedMemberUids: string[];
}

/** Payload création demande d'échange */
export interface CreateSwapRequestPayload {
  targetMemberUid: string;
}

/** Payload décision sur une demande d'échange */
export interface DecideSwapRequestPayload {
  decision: 'APPROVED' | 'REJECTED';
}

/** Demande d'adhésion en attente (organisateur) — join request via lien/QR, pas invitation nominative */
export interface PendingMemberRequest {
  uid: string;
  membershipUid?: string;
  createdAt: string;
  status: 'PENDING';
  /** Candidat ayant envoyé la demande via lien/QR */
  user: {
    uid: string;
    fullName: string;
    phone: string;
    kelembScore: number;
    kycStatus: string;
  };
  /** Toujours true : join request nécessite validation organisateur */
  requiresOrganizerApproval?: true;
}

/** Demandes groupées par tontine */
export interface PendingRequestsByTontine {
  tontineUid: string;
  tontineName: string;
  requests: PendingMemberRequest[];
}
