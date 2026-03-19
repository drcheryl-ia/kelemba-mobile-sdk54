/**
 * API Users — upgrade compte vers Organisateur, lookup utilisateur.
 */
import { apiClient } from './apiClient';
import { parseApiError } from './errors/errorHandler';
import { ApiError } from './errors/ApiError';
import { ApiErrorCode } from './errors/errorCodes';
import { ENDPOINTS } from './endpoints';
import { logger } from '@/utils/logger';
import type { UserProfileDto } from './types/api.types';
import type { UserLookupResult } from '@/types/invite';

/**
 * Récupérer le profil utilisateur courant (boot, validation token).
 * GET /api/v1/users/me — requiert accessToken dans SecureStore.
 */
export const fetchCurrentUser = async (): Promise<UserProfileDto> => {
  try {
    const { url } = ENDPOINTS.USERS.ME;
    const response = await apiClient.get<UserProfileDto>(url);
    return response.data;
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    logger.error('fetchCurrentUser failed', { httpStatus: apiError.httpStatus });
    throw apiError;
  }
};

/**
 * Rechercher un utilisateur par numéro de téléphone.
 * GET /v1/users/lookup?phone=...
 * 404 → USER_NOT_FOUND (utilisateur non inscrit).
 * 400 → INVALID_PHONE_FORMAT si format invalide.
 */
export const lookupUser = async (phone: string): Promise<UserLookupResult> => {
  try {
    const url = `${ENDPOINTS.USERS.LOOKUP.url}?phone=${encodeURIComponent(phone)}`;
    const response = await apiClient.get<{
      uid: string;
      fullName: string;
      phoneMasked: string;
      kelembScore: number;
      kycStatus: string;
    }>(url);
    const raw = response.data;
    return {
      uid: raw.uid,
      fullName: raw.fullName,
      phoneMasked: typeof raw.phoneMasked === 'string' ? raw.phoneMasked : 'Numéro indisponible',
      kelembScore: Number(raw.kelembScore) || 0,
      kycStatus: raw.kycStatus as UserLookupResult['kycStatus'],
    };
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    if (apiError.httpStatus === 404) {
      throw new ApiError(
        ApiErrorCode.USER_NOT_FOUND,
        404,
        apiError.message || 'Utilisateur non inscrit sur Kelemba'
      );
    }
    if (apiError.httpStatus === 400 && apiError.code === ApiErrorCode.INVALID_PHONE_FORMAT) {
      throw apiError;
    }
    logger.error('lookupUser failed', { phone });
    throw apiError;
  }
};

/** Alias sémantique pour lookupUser — flux invitation nominative */
export const lookupUserByPhone = lookupUser;

/**
 * Passer d'un compte MEMBRE à ORGANISATEUR (KYC vérifié requis).
 * PATCH /api/v1/users/me/upgrade-account
 * Erreurs : 403 KYC non vérifié, 409 ALREADY_ORGANIZER
 */
export const upgradeToOrganizer = async (): Promise<UserProfileDto> => {
  try {
    const { url } = ENDPOINTS.USERS.UPGRADE_ACCOUNT;
    const response = await apiClient.patch<UserProfileDto>(url, {
      confirmed: true,
    });
    return response.data;
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    logger.error('upgradeToOrganizer failed');
    throw apiError;
  }
};
