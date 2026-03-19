export { ApiError } from './ApiError';
export { ApiErrorCode } from './errorCodes';
export { ERROR_MESSAGES } from './errorMessages';
export { parseApiError } from './errorHandler';
import { ApiErrorCode } from './errorCodes';
import { ERROR_MESSAGES } from './errorMessages';

/** Message métier exploitable par l'UI — évite le fallback générique */
export function getErrorMessageForCode(
  err: { code?: string } | unknown,
  lang: 'fr' | 'sango' = 'fr'
): string {
  const code =
    err && typeof err === 'object' && 'code' in err && typeof (err as { code?: string }).code === 'string'
      ? (err as { code: string }).code
      : ApiErrorCode.UNKNOWN;
  const msgObj =
    Object.values(ApiErrorCode).includes(code as ApiErrorCode)
      ? ERROR_MESSAGES[code as ApiErrorCode]
      : ERROR_MESSAGES[ApiErrorCode.UNKNOWN];
  return msgObj[lang];
}
