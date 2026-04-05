/**
 * API Auth — login (phone + PIN), refresh token.
 * Erreurs parsées via parseApiError → ApiError typée.
 */
import { apiClient } from './apiClient';
import { parseApiError } from './errors/errorHandler';
import { ENDPOINTS } from './endpoints';
import { authStorage, STORAGE_KEYS } from '@/storage/authStorage';
import { logger } from '@/utils/logger';
import { fcmTokenService } from '@/services/fcmTokenService';
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

/**
 * Désenregistre le device push (API + SecureStore).
 * À appeler avant de supprimer les tokens JWT (Bearer encore valide pour DELETE).
 */
export async function unregisterPushDeviceBeforeLogout(): Promise<void> {
  await fcmTokenService.unregister();
}

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
  /** Alias / normalisé côté client — identique à devOtp si fourni */
  otpDev?: string;
  debugCode?: string;
}

export const sendOtp = async (
  phone: string,
  options?: {
    idempotencyKey?: string;
    /** REGISTER = inscription (numéro libre). LOGIN ou omis = compte existant. */
    purpose?: 'LOGIN' | 'REGISTER';
  }
): Promise<SendOtpResponse> => {
  try {
    const { url: sendOtpUrl } = ENDPOINTS.AUTH.SEND_OTP;
    const body: {
      phone: string;
      idempotencyKey?: string;
      purpose?: 'LOGIN' | 'REGISTER';
    } = { phone };
    if (options?.idempotencyKey) {
      body.idempotencyKey = options.idempotencyKey;
    }
    if (options?.purpose) {
      body.purpose = options.purpose;
    }
    const response = await apiClient.post<SendOtpResponse>(sendOtpUrl, body);
    const data = response.data;
    const otpDevRaw =
      (typeof data.otpDev === 'string' && data.otpDev) ||
      (typeof data.devOtp === 'string' && data.devOtp) ||
      (typeof data.debugCode === 'string' && data.debugCode) ||
      undefined;
    return {
      ...data,
      otpDev: otpDevRaw,
    };
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

/**
 * Après `register` : si la réponse ne contient pas de JWT (anciens backends),
 * ouvre une session via `login` pour les appels authentifiés (KYC, adhésion, etc.).
 */
export async function ensureSessionAfterRegister(
  registerResult: RegisterResponse,
  phone: string,
  pin: string
): Promise<RegisterResponse> {
  if (
    typeof registerResult.accessToken === 'string' &&
    registerResult.accessToken.length > 0
  ) {
    return registerResult;
  }
  return login(phone, pin);
}
