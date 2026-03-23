import { ApiErrorCode } from './errorCodes';
import { parseApiError } from './errorHandler';

export type ApiQueryErrorKind =
  | 'rate_limited'
  | 'network'
  | 'server'
  | 'business'
  | 'unknown';

export function classifyApiQueryError(err: unknown): ApiQueryErrorKind {
  const apiErr = parseApiError(err);

  if (apiErr.code === ApiErrorCode.RATE_LIMITED || apiErr.httpStatus === 429) {
    return 'rate_limited';
  }

  if (
    apiErr.code === ApiErrorCode.NETWORK_ERROR ||
    apiErr.code === ApiErrorCode.TIMEOUT
  ) {
    return 'network';
  }

  if (
    apiErr.code === ApiErrorCode.SERVER_ERROR ||
    apiErr.code === ApiErrorCode.PROVIDER_UNAVAILABLE ||
    (apiErr.httpStatus >= 500 && apiErr.httpStatus < 600)
  ) {
    return 'server';
  }

  if (apiErr.httpStatus >= 400 && apiErr.httpStatus < 500) {
    return 'business';
  }

  return 'unknown';
}

export function shouldRetryApiQuery(
  failureCount: number,
  err: unknown
): boolean {
  if (failureCount >= 1) {
    return false;
  }

  const apiErr = parseApiError(err);

  if (
    apiErr.code === ApiErrorCode.RATE_LIMITED ||
    apiErr.code === ApiErrorCode.KYC_NOT_VERIFIED ||
    (apiErr.httpStatus >= 400 && apiErr.httpStatus < 500)
  ) {
    return false;
  }

  const kind = classifyApiQueryError(err);
  return kind === 'network' || kind === 'server';
}
