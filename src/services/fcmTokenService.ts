/**
 * Service FCM — enregistrement token push, stockage SecureStore, sync backend.
 * Expo SDK 54 · EAS / dev client (Expo Go limité pour push natif).
 * Tokens stockés via SecureStore — jamais AsyncStorage (OWASP Mobile Top 10).
 */
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiClient } from '@/api/apiClient';
import { ENDPOINTS } from '@/api/endpoints';
import { logger } from '@/utils/logger';
import type { DevicePlatform, TokenProvider } from '@/api/types/api.types';

const SECURE_KEY_TOKEN = 'push_token';
const SECURE_KEY_TOKEN_UID = 'push_token_uid';

interface RegisterDeviceResponse {
  deviceUid?: string;
  uid?: string;
}

async function getOrRequestPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

function resolveEasProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string } }
    | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

export const fcmTokenService = {
  /**
   * Demande permission, récupère le token Expo Push, compare avec le token stocké,
   * enregistre au backend si nouveau ou changé. Retourne le tokenUid backend.
   */
  async registerAndSync(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        logger.warn('[FCM] Push ignoré sur web');
        return null;
      }

      const granted = await getOrRequestPermission();
      if (!granted) {
        logger.warn('[FCM] Permission push refusée');
        return null;
      }

      const projectId = resolveEasProjectId();
      const { data: token } = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      if (!token) {
        logger.warn('[FCM] Token push non disponible');
        return null;
      }

      const storedToken = await SecureStore.getItemAsync(SECURE_KEY_TOKEN);
      const storedTokenUid = await SecureStore.getItemAsync(SECURE_KEY_TOKEN_UID);

      if (storedToken === token && storedTokenUid) {
        logger.info('[FCM] Token inchangé, skip enregistrement');
        return storedTokenUid;
      }

      if (storedTokenUid && storedToken !== token) {
        await fcmTokenService.unregister(storedTokenUid);
      }

      const platform: DevicePlatform = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
      const provider: TokenProvider = 'EXPO';

      const { url } = ENDPOINTS.NOTIFICATIONS.REGISTER_DEVICE;
      const res = await apiClient.post<RegisterDeviceResponse>(url, {
        token,
        platform,
        provider,
      });
      const tokenUid = res.data?.deviceUid ?? res.data?.uid;
      if (!tokenUid) throw new Error('deviceUid absent de la réponse');

      await SecureStore.setItemAsync(SECURE_KEY_TOKEN, token);
      await SecureStore.setItemAsync(SECURE_KEY_TOKEN_UID, tokenUid);

      logger.info('[FCM] Token enregistré', { platform, provider, tokenUid });
      return tokenUid;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[FCM] registerAndSync failed', { message: msg });
      return null;
    }
  },

  /**
   * Supprime le token backend et efface SecureStore.
   * À appeler lors du logout (tant que le JWT est encore valide).
   */
  async unregister(tokenUid?: string): Promise<void> {
    try {
      const uid = tokenUid ?? (await SecureStore.getItemAsync(SECURE_KEY_TOKEN_UID));
      if (!uid) return;
      const { url } = ENDPOINTS.NOTIFICATIONS.UNREGISTER_DEVICE(uid);
      await apiClient.delete(url);
      await SecureStore.deleteItemAsync(SECURE_KEY_TOKEN);
      await SecureStore.deleteItemAsync(SECURE_KEY_TOKEN_UID);
      logger.info('[FCM] Token désenregistré', { tokenUid: uid });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[FCM] unregister failed', { message: msg });
      try {
        await SecureStore.deleteItemAsync(SECURE_KEY_TOKEN);
        await SecureStore.deleteItemAsync(SECURE_KEY_TOKEN_UID);
      } catch {
        /* best effort */
      }
    }
  },

  /** Renvoie le tokenUid stocké localement (sans appel réseau). */
  async getStoredTokenUid(): Promise<string | null> {
    return SecureStore.getItemAsync(SECURE_KEY_TOKEN_UID);
  },
};
