/**
 * Intercepteur JWT RS256 — access 15 min, refresh silencieux 30 jours.
 */
import type { InternalAxiosRequestConfig, AxiosError } from 'axios';
import { authStorage, STORAGE_KEYS } from '@/storage/authStorage';
import { logger } from '@/utils/logger';
import { parseApiError } from './errors/errorHandler';
import { ApiErrorCode } from './errors/errorCodes';
import { authEventEmitter } from './authEventEmitter';

export const attachAuthToken = async (
  config: InternalAxiosRequestConfig
): Promise<InternalAxiosRequestConfig> => {
  const token = await authStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

export const handleAuthError = async (error: AxiosError): Promise<unknown> => {
  const apiError = parseApiError(error);

  if (
    apiError.code === ApiErrorCode.TOKEN_EXPIRED ||
    apiError.code === ApiErrorCode.TOKEN_INVALID
  ) {
    logger.warn('Token expired — clearing session');
    await authStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    await authStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    await authStorage.removeItem(STORAGE_KEYS.ACCOUNT_TYPE);
    authEventEmitter.emit('SESSION_EXPIRED');
    return Promise.reject(apiError);
  }

  if (error.response?.status === 401) {
    const refreshToken = await authStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (refreshToken && error.config) {
      try {
        const axios = (await import('axios')).default;
        const { ENDPOINTS } = await import('./endpoints');
        const { url: refreshUrl } = ENDPOINTS.AUTH.REFRESH_TOKEN;
        const response = await axios.post<{
          accessToken: string;
          refreshToken: string;
        }>(refreshUrl, { refreshToken }, {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' },
        });
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        await authStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, String(accessToken ?? ''));
        await authStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, String(newRefreshToken ?? ''));
        error.config.headers.Authorization = `Bearer ${accessToken}`;
        const { ENV } = await import('@/config/env');
        return axios.request({
          ...error.config,
          baseURL: ENV.API_URL,
        });
      } catch (e: unknown) {
        logger.error('Refresh token failed');
        await authStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        await authStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        await authStorage.removeItem(STORAGE_KEYS.ACCOUNT_TYPE);
        authEventEmitter.emit('SESSION_EXPIRED');
        return Promise.reject(parseApiError(e));
      }
    }
  }

  return Promise.reject(apiError);
};

