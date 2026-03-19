/**
 * Types pour l'invitation de membres à une tontine.
 * Distinction stricte : INVITATION (nominative) vs JOIN_REQUEST (lien/QR).
 */

/** Origine de la demande d'adhésion */
export type InvitationOrigin = 'INVITATION' | 'JOIN_REQUEST';

/** Invitation nominative reçue — acceptation directe, pas de validation organisateur */
export interface ReceivedInvitation {
  origin: 'INVITATION';
  tontineUid: string;
  membershipUid?: string;
  status: 'PENDING';
  invitedBy?: string;
  requiresOrganizerApproval: false;
  tontineName?: string;
  amountPerShare?: number;
  frequency?: string;
  memberCount?: number;
  [key: string]: unknown;
}

/** Demande d'adhésion via lien/QR — en attente de validation organisateur */
export interface PendingJoinRequest {
  origin: 'JOIN_REQUEST';
  uid: string;
  tontineUid: string;
  membershipUid?: string;
  status: 'PENDING';
  requiresOrganizerApproval: true;
  candidate?: {
    uid: string;
    fullName: string;
    phone: string;
    kelembScore?: number;
    kycStatus?: string;
  };
  user?: {
    uid: string;
    fullName: string;
    phone: string;
    kelembScore?: number;
    kycStatus?: string;
  };
  createdAt?: string;
  [key: string]: unknown;
}

/** Type guard : invitation nominative */
export function isReceivedInvitation(
  item: ReceivedInvitation | PendingJoinRequest
): item is ReceivedInvitation {
  return item.origin === 'INVITATION' || item.requiresOrganizerApproval === false;
}

/** Type guard : join request */
export function isPendingJoinRequest(
  item: ReceivedInvitation | PendingJoinRequest
): item is PendingJoinRequest {
  return item.origin === 'JOIN_REQUEST' || item.requiresOrganizerApproval === true;
}

export type KycStatusLookup =
  | 'PENDING'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'REJECTED';

/** Réponse GET /api/v1/users/lookup — contrat backend strict */
export interface UserLookupResult {
  uid: string;
  fullName: string;
  /** Numéro masqué (ex: +236 XX XX XX XX) — backend ne retourne pas phone */
  phoneMasked: string;
  kelembScore: number;
  kycStatus: KycStatusLookup;
}

export interface InviteLinkResponse {
  inviteUrl: string;
  expiresAt: string;
}

export interface InvitationItem {
  phone: string;
  sharesCount: number;
  userUid?: string;
}

export interface SendInvitationsPayload {
  invitations: InvitationItem[];
}

export interface SendInvitationsResponse {
  invited: number;
  alreadyMember: number;
  pendingRegistration: number;
}

export interface PendingInvitee {
  id: string;
  phone: string;
  fullName?: string;
  userUid?: string;
  sharesCount: number;
  kelembScore?: number;
  kycStatus?: string;
}
