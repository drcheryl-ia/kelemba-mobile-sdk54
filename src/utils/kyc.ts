import type {
  KycDocumentType,
  KycDocumentStep,
  KycStatus,
} from '@/types/kyc.types';

export const MAX_KYC_FILE_SIZE_BYTES = 3 * 1024 * 1024;

export const SUPPORTED_KYC_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
] as const;

export type KycBannerSeverity = 'error' | 'warning' | 'info';

export const KYC_REQUIRED_STEPS: Record<
  KycDocumentType,
  readonly KycDocumentStep[]
> = {
  CNI: ['front', 'back', 'selfie'],
  PASSPORT: ['front', 'selfie'],
};

export const KYC_STATUS_LABEL_KEYS: Record<KycStatus, string> = {
  PENDING: 'kyc.statusLabelPending',
  SUBMITTED: 'kyc.statusLabelSubmitted',
  UNDER_REVIEW: 'kyc.statusLabelUnderReview',
  VERIFIED: 'kyc.statusLabelVerified',
  REJECTED: 'kyc.statusLabelRejected',
};

export const KYC_STATUS_MESSAGE_KEYS: Record<KycStatus, string> = {
  PENDING: 'kyc.statusMessagePending',
  SUBMITTED: 'kyc.statusMessageSubmitted',
  UNDER_REVIEW: 'kyc.statusMessageUnderReview',
  VERIFIED: 'kyc.statusMessageVerified',
  REJECTED: 'kyc.statusMessageRejectedDefault',
};

export const KYC_STATUS_SEVERITY: Record<KycStatus, KycBannerSeverity> = {
  PENDING: 'warning',
  SUBMITTED: 'info',
  UNDER_REVIEW: 'info',
  VERIFIED: 'info',
  REJECTED: 'error',
};

export function needsBackDocument(documentType?: KycDocumentType | null): boolean {
  return documentType === 'CNI';
}

export function isKycUnderReview(status: KycStatus): boolean {
  return status === 'SUBMITTED' || status === 'UNDER_REVIEW';
}

export function isSupportedKycMimeType(mimeType: string): boolean {
  return (
    SUPPORTED_KYC_MIME_TYPES as readonly string[]
  ).includes(mimeType.toLowerCase());
}

export function formatKycFileSize(fileSize: number): string {
  return `${(fileSize / (1024 * 1024)).toFixed(1)} Mo`;
}
