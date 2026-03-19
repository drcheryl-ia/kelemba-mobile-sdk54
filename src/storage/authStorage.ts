/**
 * Stockage auth — AsyncStorage (logique préexistante).
 * Utilisé après retrait de secureStorage.ts — compatible Expo Go.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'kelemba_access_token',
  REFRESH_TOKEN: 'kelemba_refresh_token',
  ACCOUNT_TYPE: 'kelemba_account_type',
  BIOMETRIC_ENABLED: 'kelemba_biometric_enabled',
  PERSIST_AUTH: 'kelemba_persist_auth',
  APP_LANGUAGE: 'appLanguage',
  NOTIFICATIONS_ENABLED: 'notificationsEnabled',
} as const;

export const authStorage = {
  async setItem(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value);
  },

  async getItem(key: string): Promise<string | null> {
    return AsyncStorage.getItem(key);
  },

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};
