/**
 * API Auth — login (phone + PIN), refresh token.
 * Erreurs parsées via parseApiError → ApiError typée.
 */
import { apiClient } from './apiClient';
import { parseApiError } from './errors/errorHandler';
import { ENDPOINTS } from './endpoints';
import { authStorage, STORAGE_KEYS } from '@/storage/authStorage';
import { logger } from '@/utils/logger';
import type { User } from '@/types/domain.types';

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

const normalizePhone = (phone: string): string => {
  return phone.replace(/\s/g, '');
};

export const login = async (
  phone: string,
  pin: string
): Promise<LoginResponse> => {
  const normalizedPhone = normalizePhone(phone);
  try {
    const { url } = ENDPOINTS.AUTH.LOGIN;
    const response = await apiClient.post<LoginResponse>(url, {
      phone: normalizedPhone.startsWith('+') ? normalizedPhone : `+236${normalizedPhone}`,
      pin,
    });
    const { user, accessToken, refreshToken } = response.data;
    await authStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, String(accessToken ?? ''));
    await authStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, String(refreshToken ?? ''));
    const accountType = (user as User & { accountType?: 'MEMBRE' | 'ORGANISATEUR' }).accountType;
    if (accountType) {
      await authStorage.setItem(STORAGE_KEYS.ACCOUNT_TYPE, String(accountType));
    }
    return { user, accessToken, refreshToken };
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    logger.error('Login failed');
    throw apiError;
  }
};

export const loginWithRefreshToken = async (): Promise<LoginResponse> => {
  const refreshToken = await authStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  if (!refreshToken) {
    throw new Error('No refresh token');
  }
  try {
    const { url } = ENDPOINTS.AUTH.REFRESH_TOKEN;
    const response = await apiClient.post<RefreshResponse & { user?: User }>(
      url,
      { refreshToken }
    );
    const { user, accessToken, refreshToken: newRefreshToken } = response.data;
    await authStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, String(accessToken ?? ''));
    await authStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, String(newRefreshToken ?? ''));
    const accountType = (user as User & { accountType?: 'MEMBRE' | 'ORGANISATEUR' }).accountType;
    if (accountType) {
      await authStorage.setItem(STORAGE_KEYS.ACCOUNT_TYPE, String(accountType));
    }

    // Le backend doit retourner user dans la réponse refresh — pas d'endpoint /me dans le contrat
    if (!user) {
      throw new Error('Could not resolve user');
    }
    return {
      user,
      accessToken,
      refreshToken: newRefreshToken,
    };
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    logger.error('LoginWithRefreshToken failed');
    throw apiError;
  }
};

export interface SendOtpResponse {
  message: string;
  expiresInSeconds: number;
  /** Présent uniquement en mode dev (OTP_DEV_MODE=true côté backend) */
  devOtp?: string;
}

export const sendOtp = async (phone: string): Promise<SendOtpResponse> => {
  try {
    const { url: sendOtpUrl } = ENDPOINTS.AUTH.SEND_OTP;
    const response = await apiClient.post<SendOtpResponse>(sendOtpUrl, { phone });
    return response.data;
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    logger.error('SendOtp failed');
    throw apiError;
  }
};

export interface VerifyOtpResponse {
  verified: boolean;
}

export const verifyOtp = async (
  phone: string,
  otp: string
): Promise<VerifyOtpResponse> => {
  try {
    const { url: verifyOtpUrl } = ENDPOINTS.AUTH.VERIFY_OTP;
    const response = await apiClient.post<VerifyOtpResponse>(verifyOtpUrl, {
      phone,
      otp,
    });
    return response.data;
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    logger.error('VerifyOtp failed');
    throw apiError;
  }
};

export interface RegisterPayload {
  phone: string;
  fullName: string;
  pin: string;
  accountType: 'MEMBRE' | 'ORGANISATEUR';
  invitationTontineUid?: string;
}

/** Réponse register — 201 peut être minimal (sans user/tokens). */
export type RegisterResponse = Partial<LoginResponse>;

export const register = async (payload: RegisterPayload): Promise<RegisterResponse> => {
  try {
    const body: Record<string, string> = {
      phone: payload.phone.startsWith('+') ? payload.phone : `+236${payload.phone}`,
      fullName: payload.fullName,
      pin: payload.pin,
      accountType: payload.accountType,
    };
    if (payload.invitationTontineUid) {
      body.invitationTontineUid = payload.invitationTontineUid;
    }
    const { url: registerUrl } = ENDPOINTS.AUTH.REGISTER;
    const response = await apiClient.post<RegisterResponse>(registerUrl, body);
    const data = response.data as Record<string, unknown> | undefined;

    // Tokens — uniquement si le backend les retourne (201 peut être minimal)
    const accessToken = data?.accessToken;
    const refreshToken = data?.refreshToken;
    if (typeof accessToken === 'string' && accessToken) {
      await authStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    }
    if (typeof refreshToken === 'string' && refreshToken) {
      await authStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    }

    // accountType — toujours depuis le payload local, jamais depuis response (user peut être absent)
    await authStorage.setItem(STORAGE_KEYS.ACCOUNT_TYPE, String(payload.accountType));

    const user = data?.user as User | undefined;
    return {
      user,
      accessToken: typeof accessToken === 'string' ? accessToken : undefined,
      refreshToken: typeof refreshToken === 'string' ? refreshToken : undefined,
    };
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    logger.error('Register failed');
    throw apiError;
  }
};
