/**
 * Types tontine — création, règles, rotation, liste, détails.
 */
import type { TontineFrequency } from '@/api/types/api.types';
import type { PaymentStatus } from '@/types/domain.types';
import type { SavingsMemberStatus, TontineType } from '@/types/savings.types';

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
  collectedAmount?: number;
  totalExpected?: number;
  collectionProgress?: number;
  beneficiaryNetAmount?: number;
  delayedByMemberIds: string[] | null;
  status: CycleStatus;
  /** Membership uid du bénéficiaire du tour — GET /cycles/current */
  beneficiaryMembershipUid?: string | null;
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

export type PaymentMethod = 'ORANGE_MONEY' | 'TELECEL_MONEY' | 'CASH' | 'SYSTEM';

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
  /** UUID du membre payeur si fourni par l’API (ex. cotisation espèces). */
  memberUserUid?: string;
  /** Indique une validation automatique (ex. cotisation cash organisateur). */
  cashAutoValidated?: boolean;
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
  /** Clôture automatique ou manuelle — renseigné quand status === COMPLETED */
  closedAt?: string | null;
  closureType?: string | null;
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
  | 'BETWEEN_ROUNDS'
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

export type TontinePaymentUiStatus =
  | 'UP_TO_DATE'
  | 'DUE_SOON'
  | 'DUE_TODAY'
  | 'OVERDUE'
  | 'UNKNOWN';

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
  /** `undefined` = backend n'a pas renvoyé le champ — ne pas traiter comme « à jour » */
  hasPaymentDue?: boolean;
  /** Échéance du cycle courant à payer (GET liste / membre) — prioritaire si dette */
  currentDueDate?: string | null;
  /** Prochaine échéance « logique » backend (hors cycle courant si déjà soldé) */
  nextDueDate?: string | null;
  /** Date du prochain cycle planifié (souvent après paiement du courant) */
  nextScheduledCycleDate?: string | null;
  /** `undefined` = absent ; `null` = explicitement sans date côté API */
  nextPaymentDate?: string | null;
  /** Date prévue du cycle courant quand l'API n'expose pas nextPaymentDate explicitement */
  currentCycleExpectedDate?: string | null;
  /** Statut paiement cycle courant si exposé par l'API */
  paymentStatus?: string;
  /** Aligné membre / cycle courant (backend) */
  currentCyclePaymentStatus?: PaymentStatus | null;
  daysLeft?: number | null;
  daysOverdue?: number | null;
  penaltyAmount?: number | null;
  totalAmountDue?: number | null;
  /** Parts du membre connecté (montant = amountPerShare × userSharesCount) */
  userSharesCount?: number;
  /** Peut être pré-calculé côté API ; l'UI préfère `deriveTontinePaymentUiState` */
  paymentUiStatus?: TontinePaymentUiStatus;
  isCreator?: boolean;
  canInvite?: boolean;
  startDate?: string;
  activeMemberCount?: number;
  organizerName?: string;
  invitationMessage?: string;
  /** INVITE = nominative, acceptation directe ; JOIN_REQUEST = via lien/QR, validation organisateur */
  invitationOrigin?: InvitationOrigin;
  /** Flag UI : adhésion non finalisée, carte non cliquable */
  isPending?: boolean;
  /** UUID du cycle courant si l’API liste renvoie `currentCycle` comme objet */
  currentCycleUid?: string | null;
  /** Progression collecte 0–1 (cycle embarqué liste) — `null` si inconnu après normalisation */
  collectionProgress?: number | null;
  /** Statut du cycle courant si fourni dans la liste */
  currentCycleStatus?: CycleStatus | null;
  /** Montants cycle courant (liste) — pour progression / éligibilité sans requête extra */
  currentCycleCollectedAmount?: number | null;
  currentCycleTotalExpected?: number | null;
  /** Navigation `CyclePayoutScreen` depuis la liste si exposé par l’API */
  payoutBeneficiaryName?: string | null;
  payoutNetAmount?: number | null;
  /** Alias / nommage alternatif (contrat ou backend) — même sémantique que les champs `payout*` */
  beneficiaryName?: string | null;
  beneficiaryNetAmount?: number | null;
  /** Alias explicite du numéro de cycle courant (= `currentCycle` quand présent) */
  currentCycleNumber?: number | null;
  /** `true` si l’organisateur peut lancer le versement cagnotte (hydraté liste + calcul mobile si absent API) */
  canTriggerPayout?: boolean;
  /** Ordre personnel dans la rotation (liste / backend) */
  myRotationOrder?: number | null;
  /** Numéro de cycle où le membre reçoit la cagnotte (backend) */
  myPayoutCycleNumber?: number | null;
  /** Date prévue du versement cagnotte au membre — ne pas confondre avec cotisation */
  myScheduledPayoutDate?: string | null;
  /** Indique si c’est le tour du membre pour le versement */
  isMyTurnNow?: boolean;
  /** Liste GET /v1/savings — date de déblocage du capital (ISO ou YYYY-MM-DD) */
  savingsUnlockDate?: string | null;
  /** Liste épargne — total épargné côté membre si exposé par l’API */
  savingsTotalSaved?: number | null;
  /** Statut membre épargne si fourni par la liste */
  savingsMemberStatus?: SavingsMemberStatus | null;
  /** Liste — retrait autorisé (capital débloqué / API) */
  savingsWithdrawalAvailable?: boolean | null;
  /** Période courante épargne (liste GET /v1/savings) — navigation versement */
  savingsCurrentPeriodUid?: string | null;
  /** Total cotisé par le membre sur la tontine (récap clôture) si exposé par l’API */
  memberTotalContributed?: number | null;
  /** Ponctualité % sur cette tontine si exposé */
  tontinePunctualityRate?: number | null;
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

/** Payload réordonnancement manuel.
 * orderedSlotMembershipUids prioritaire si multi-parts (longueur = total parts).
 * orderedMemberUids pour compatibilité 1 part/membre. */
export interface ReorderRotationPayload {
  orderedMemberUids?: string[];
  orderedSlotMembershipUids?: string[];
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
