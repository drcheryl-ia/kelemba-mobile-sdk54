import { describe, expect, it, vi } from 'vitest';
vi.mock('./errorHandler', () => ({
  parseApiError: (err: unknown) => err,
}));

import { ApiError } from './ApiError';
import { ApiErrorCode } from './errorCodes';
import { classifyApiQueryError, shouldRetryApiQuery } from './queryRetry';

describe('shouldRetryApiQuery', () => {
  it('does not retry rate-limited queries', () => {
    const err = new ApiError(ApiErrorCode.RATE_LIMITED, 429, 'Too Many Requests');

    expect(shouldRetryApiQuery(0, err)).toBe(false);
  });

  it('retries network and transient server failures once', () => {
    const networkErr = new ApiError(ApiErrorCode.NETWORK_ERROR, 0, 'offline');
    const timeoutErr = new ApiError(ApiErrorCode.TIMEOUT, 0, 'timeout');
    const serverErr = new ApiError(ApiErrorCode.SERVER_ERROR, 500, 'server');
    const providerErr = new ApiError(
      ApiErrorCode.PROVIDER_UNAVAILABLE,
      503,
      'provider unavailable'
    );

    expect(shouldRetryApiQuery(0, networkErr)).toBe(true);
    expect(shouldRetryApiQuery(0, timeoutErr)).toBe(true);
    expect(shouldRetryApiQuery(0, serverErr)).toBe(true);
    expect(shouldRetryApiQuery(0, providerErr)).toBe(true);
    expect(shouldRetryApiQuery(1, serverErr)).toBe(false);
  });

  it('does not retry business and KYC errors', () => {
    const kycErr = new ApiError(ApiErrorCode.KYC_NOT_VERIFIED, 403, 'kyc');
    const forbiddenErr = new ApiError(ApiErrorCode.FORBIDDEN, 403, 'forbidden');

    expect(shouldRetryApiQuery(0, kycErr)).toBe(false);
    expect(shouldRetryApiQuery(0, forbiddenErr)).toBe(false);
  });
});

describe('classifyApiQueryError', () => {
  it('classifies rate-limited, network, and server errors', () => {
    expect(
      classifyApiQueryError(new ApiError(ApiErrorCode.RATE_LIMITED, 429, 'rate limit'))
    ).toBe('rate_limited');
    expect(
      classifyApiQueryError(new ApiError(ApiErrorCode.NETWORK_ERROR, 0, 'offline'))
    ).toBe('network');
    expect(
      classifyApiQueryError(new ApiError(ApiErrorCode.SERVER_ERROR, 500, 'server'))
    ).toBe('server');
  });
});
