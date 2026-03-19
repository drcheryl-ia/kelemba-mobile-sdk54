/**
 * Client API — timeout 30s, retry 3x sur erreur réseau uniquement.
 * Header idempotency-key UUID v4 sur POST/PATCH paiement.
 * Erreurs parsées via parseApiError → ApiError typée.
 */
import axios, { type AxiosError } from 'axios';
import { attachAuthToken, handleAuthError } from './authInterceptor';
import { parseApiError } from './errors/errorHandler';
import { API_CONFIG } from '@/config/api.config';
import { logger } from '@/utils/logger';

const PAYMENT_METHODS = ['POST', 'PATCH'] as const;
const PAYMENT_PATHS = ['/payments', '/api/v1/payments'] as const;

const isPaymentRequest = (url: string, method: string): boolean => {
  const upper = method.toUpperCase();
  if (!PAYMENT_METHODS.includes(upper as (typeof PAYMENT_METHODS)[number])) return false;
  return PAYMENT_PATHS.some((p) => url.includes(p));
};

const generateIdempotencyKey = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const apiClient = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: API_CONFIG.headers,
});

apiClient.interceptors.request.use(
  async (config) => {
    config = await attachAuthToken(config);
    config.headers['x-request-start'] = Date.now().toString();

    if (config.data && typeof (config.data as FormData).append === 'function') {
      delete config.headers['Content-Type'];
    }
    if (isPaymentRequest(config.url ?? '', config.method ?? '')) {
      const payloadKey =
        config.data &&
        typeof config.data === 'object' &&
        'idempotencyKey' in config.data &&
        typeof (config.data as { idempotencyKey?: string }).idempotencyKey === 'string'
          ? (config.data as { idempotencyKey: string }).idempotencyKey
          : null;
      config.headers['idempotency-key'] = payloadKey ?? generateIdempotencyKey();
    }
    if (__DEV__) {
      const fullUrl = `${config.baseURL ?? ''}${config.url ?? ''}`;
      logger.info(`[REQ] ${(config.method ?? 'GET').toUpperCase()} ${fullUrl}`);
    }
    return config;
  },
  (error: unknown) => {
    const apiError = parseApiError(error);
    logger.error('Request error');
    return Promise.reject(apiError);
  }
);

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => handleAuthError(error)
);

const MAX_RETRIES = 3;

export const withRetry = async <T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> => {
  try {
    return await fn();
  } catch (e: unknown) {
    const isNetworkError =
      (e as AxiosError).code === 'ECONNABORTED' ||
      (e as AxiosError).message === 'Network Error';
    if (isNetworkError && retries > 0) {
      return withRetry(fn, retries - 1);
    }
    logger.error('API request failed after retries', {
      message: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
};
