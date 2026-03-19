import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import type { KycDocument, KycDocumentStep } from '@/types/kyc.types';
import {
  MAX_KYC_FILE_SIZE_BYTES,
  isSupportedKycMimeType,
} from '@/utils/kyc';

type KycImageErrorCode =
  | 'INVALID_MIME'
  | 'FILE_TOO_LARGE'
  | 'PROCESSING_FAILED';

interface NormalizeKycImageInput {
  step: KycDocumentStep;
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
}

interface CompressionPreset {
  width: number;
  compress: number;
}

const COMPRESSION_PRESETS: readonly CompressionPreset[] = [
  { width: 1600, compress: 0.82 },
  { width: 1440, compress: 0.78 },
  { width: 1280, compress: 0.74 },
  { width: 1120, compress: 0.7 },
  { width: 960, compress: 0.66 },
] as const;

export class KycImageError extends Error {
  constructor(public readonly code: KycImageErrorCode) {
    super(code);
    this.name = 'KycImageError';
  }
}

function inferMimeType(uri: string, mimeType?: string | null): string {
  if (mimeType && isSupportedKycMimeType(mimeType)) {
    return mimeType.toLowerCase();
  }

  const lowerUri = uri.toLowerCase();
  if (lowerUri.endsWith('.jpg') || lowerUri.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerUri.endsWith('.png')) return 'image/png';
  if (lowerUri.endsWith('.heic')) return 'image/heic';
  if (lowerUri.endsWith('.heif')) return 'image/heif';
  if (lowerUri.endsWith('.webp')) return 'image/webp';
  // ImagePicker / caméra Expo Go : URI souvent sans extension → JPEG par défaut
  return 'image/jpeg';
}

async function getFileSize(uri: string, fallback?: number | null): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    if (
      info.exists &&
      'size' in info &&
      typeof info.size === 'number' &&
      Number.isFinite(info.size)
    ) {
      return info.size;
    }
  } catch {
    // URI invalide ou fichier temporaire indisponible → fallback
  }
  return fallback ?? 0;
}

function getSafeFileName(step: KycDocumentStep, fileName?: string | null): string {
  const normalized = fileName?.trim();
  if (normalized) {
    const sanitized = normalized.replace(/\s+/g, '-');
    return sanitized.endsWith('.jpg') || sanitized.endsWith('.jpeg')
      ? sanitized
      : `${sanitized.replace(/\.[^.]+$/, '')}.jpg`;
  }
  return `${step}.jpg`;
}

export async function normalizeKycImage(
  input: NormalizeKycImageInput
): Promise<KycDocument> {
  const uri = input.uri?.trim();
  if (!uri || uri.length === 0) {
    throw new KycImageError('INVALID_MIME');
  }

  const sourceMimeType = inferMimeType(uri, input.mimeType);

  let currentUri = uri;
  let currentSize = await getFileSize(currentUri, input.fileSize);

  try {
    for (const preset of COMPRESSION_PRESETS) {
      const result = await ImageManipulator.manipulateAsync(
        currentUri,
        [{ resize: { width: preset.width } }],
        {
          compress: preset.compress,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      currentUri = result.uri;
      currentSize = await getFileSize(currentUri, currentSize);

      if (currentSize <= MAX_KYC_FILE_SIZE_BYTES) {
        break;
      }
    }
  } catch {
    throw new KycImageError('PROCESSING_FAILED');
  }

  if (currentSize > MAX_KYC_FILE_SIZE_BYTES) {
    throw new KycImageError('FILE_TOO_LARGE');
  }

  return {
    step: input.step,
    uri: currentUri,
    mimeType: 'image/jpeg',
    fileName: getSafeFileName(input.step, input.fileName),
    fileSize: currentSize,
  };
}
