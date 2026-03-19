import type { AxiosProgressEvent } from 'axios';
import { apiClient } from './apiClient';
import { ENDPOINTS } from './endpoints';
import { parseApiError } from './errors/errorHandler';
import { logger } from '@/utils/logger';
import type {
  KycDocument,
  KycDocumentType,
  KycStatus,
  KycStatusDetails,
  KycUploadPayload,
} from '@/types/kyc.types';

/** Noms exacts des champs multipart attendus par le backend NestJS/Multer */
export const KYC_FORM_FIELDS = {
  DOCUMENT_TYPE: 'documentType',
  FRONT: 'front',
  BACK: 'back',
  SELFIE: 'selfie',
} as const;

interface SubmitKycDocumentsOptions {
  onUploadProgress?: (progress: number) => void;
}

interface RawKycStatusResponse {
  status?: string;
  kycStatus?: string;
  documentType?: string | null;
  rejectionReason?: string | null;
  reason?: string | null;
  submittedAt?: string | null;
  updatedAt?: string | null;
}

type ReactNativeFile = {
  uri: string;
  type: string;
  name: string;
};

function isKycStatus(value: string): value is KycStatus {
  return (
    value === 'PENDING' ||
    value === 'SUBMITTED' ||
    value === 'UNDER_REVIEW' ||
    value === 'VERIFIED' ||
    value === 'REJECTED'
  );
}

function isKycDocumentType(value: string): value is KycDocumentType {
  return value === 'CNI' || value === 'PASSPORT';
}

/**
 * Construit l'objet fichier React Native pour FormData.append.
 * Format attendu par RN/Expo : { uri, type, name } — exploitable par NestJS/Multer.
 */
function toReactNativeFile(
  document: KycDocument,
  fieldName: 'front' | 'back' | 'selfie'
): ReactNativeFile {
  const name =
    document.fileName?.trim() && document.fileName.endsWith('.jpg')
      ? document.fileName
      : `${fieldName}.jpg`;
  const type = document.mimeType?.trim() || 'image/jpeg';
  return {
    uri: document.uri,
    type,
    name,
  };
}

function normalizeStatusResponse(
  payload: RawKycStatusResponse | undefined
): KycStatusDetails {
  const rawStatus = payload?.status ?? payload?.kycStatus ?? 'PENDING';
  const rawDocumentType = payload?.documentType ?? null;

  return {
    status: isKycStatus(rawStatus) ? rawStatus : 'PENDING',
    documentType:
      rawDocumentType && isKycDocumentType(rawDocumentType)
        ? rawDocumentType
        : null,
    rejectionReason: payload?.rejectionReason ?? payload?.reason ?? null,
    submittedAt: payload?.submittedAt ?? null,
    updatedAt: payload?.updatedAt ?? null,
  };
}

export async function fetchKycStatus(): Promise<KycStatusDetails> {
  try {
    const { data } = await apiClient.get<RawKycStatusResponse>(
      ENDPOINTS.KYC.STATUS.url
    );
    return normalizeStatusResponse(data);
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    logger.error('fetchKycStatus failed', {
      httpStatus: apiError.httpStatus,
      code: apiError.code,
    });
    throw apiError;
  }
}

export async function submitKycDocuments(
  payload: KycUploadPayload,
  options?: SubmitKycDocumentsOptions
): Promise<void> {
  if (payload.documentType === 'CNI' && !payload.back) {
    throw new Error('CNI requiert le verso (back)');
  }

  const formData = new FormData();
  formData.append(KYC_FORM_FIELDS.DOCUMENT_TYPE, payload.documentType);

  const frontFile = toReactNativeFile(payload.front, 'front');
  formData.append(KYC_FORM_FIELDS.FRONT, frontFile as unknown as Blob);

  const selfieFile = toReactNativeFile(payload.selfie, 'selfie');
  formData.append(KYC_FORM_FIELDS.SELFIE, selfieFile as unknown as Blob);

  const fieldsSent: string[] = [
    KYC_FORM_FIELDS.DOCUMENT_TYPE,
    KYC_FORM_FIELDS.FRONT,
    KYC_FORM_FIELDS.SELFIE,
  ];

  if (payload.documentType === 'CNI' && payload.back) {
    const backFile = toReactNativeFile(payload.back, 'back');
    formData.append(KYC_FORM_FIELDS.BACK, backFile as unknown as Blob);
    fieldsSent.push(KYC_FORM_FIELDS.BACK);
  }

  const url = ENDPOINTS.KYC.DOCUMENTS.url;
  if (__DEV__) {
    logger.info('[KYC] submitKycDocuments', {
      documentType: payload.documentType,
      fields: fieldsSent,
      fileNames: {
        front: frontFile.name,
        selfie: selfieFile.name,
        ...(payload.back ? { back: toReactNativeFile(payload.back, 'back').name } : {}),
      },
      url,
      method: 'POST',
    });
  }

  try {
    await apiClient.post(url, formData, {
      headers: {
        Accept: 'application/json',
      },
      transformRequest: (data) => data,
      onUploadProgress: (event: AxiosProgressEvent) => {
        if (!options?.onUploadProgress || !event.total) {
          return;
        }
        const progress = Math.round((event.loaded / event.total) * 100);
        options.onUploadProgress(progress);
      },
    });
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    logger.error('[KYC] submitKycDocuments failed', {
      httpStatus: apiError.httpStatus,
      code: apiError.code,
      message: apiError.message,
    });
    throw apiError;
  }
}
