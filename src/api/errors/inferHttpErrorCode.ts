import { ApiErrorCode } from './errorCodes';

/**
 * Déduit un code métier à partir du message HTTP (validation Nest, etc.).
 */
export function inferCodeFromHttpMessage(
  message: string,
  status: number
): ApiErrorCode | undefined {
  if (!message) return undefined;
  const m = message.toLowerCase();

  if (status === 401) {
    if (
      m.includes('pin') ||
      m.includes('incorrect') ||
      m.includes('invalid credential') ||
      m.includes('unauthorized')
    ) {
      return ApiErrorCode.INVALID_CREDENTIALS;
    }
  }

  if (status === 400 || status === 422) {
    if (m.includes('securityconfirmationtoken')) {
      return ApiErrorCode.SECURITY_CONFIRMATION_INVALID;
    }
    if (
      m.includes('step-up') ||
      m.includes('step up') ||
      m.includes('confirmation de sécurité')
    ) {
      return ApiErrorCode.SECURITY_CONFIRMATION_INVALID;
    }
  }

  return undefined;
}
