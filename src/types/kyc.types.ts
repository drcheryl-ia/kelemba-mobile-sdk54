/**
 * Types KYC — alignés sur l'API /api/v1/kyc.
 */

export type KycStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'REJECTED';

export const KYC_DOCUMENT_TYPES = ['CNI', 'PASSPORT'] as const;
export type KycDocumentType = (typeof KYC_DOCUMENT_TYPES)[number];

export const KYC_DOCUMENT_STEPS = ['front', 'back', 'selfie'] as const;
export type KycDocumentStep = 'front' | 'back' | 'selfie';

export interface KycDocument {
  step: KycDocumentStep;
  uri: string;
  mimeType: string;
  fileName: string;
  fileSize: number;
}

export interface KycUploadPayload {
  documentType: KycDocumentType;
  front: KycDocument;
  back?: KycDocument | null;
  selfie: KycDocument;
}

export interface KycStatusDetails {
  status: KycStatus;
  documentType: KycDocumentType | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  updatedAt: string | null;
}
