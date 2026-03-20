/**
 * Types pour le contrat de tontine et la signature numérique.
 */

export type ContractSignatureMode = 'INVITE_ACCEPT' | 'JOIN_REQUEST';

export interface TontineContractPreviewResponse {
  tontineUid: string;
  contractVersion: string;
  contractText: string;
  contractSnapshot: Record<string, unknown>;
  requiresSignature: true;
}

export interface AcceptInvitationWithSignaturePayload {
  acceptedTerms: true;
  signatureName: string;
  contractVersion: string;
  sharesCount?: number;
}

export interface CreateJoinRequestWithSignaturePayload {
  acceptedTerms: true;
  signatureName: string;
  contractVersion: string;
  sharesCount?: number;
}
