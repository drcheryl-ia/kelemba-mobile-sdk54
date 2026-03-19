/**
 * Adapter redux-persist — AsyncStorage (compatible Expo Go).
 */
import { authStorage, STORAGE_KEYS } from '@/storage/authStorage';

export const secureStorageAdapter = {
  getItem: (key: string): Promise<string | null> => {
    const k = key === 'persist:root' ? STORAGE_KEYS.PERSIST_AUTH : key;
    return authStorage.getItem(k);
  },
  setItem: (key: string, value: string): Promise<void> => {
    const k = key === 'persist:root' ? STORAGE_KEYS.PERSIST_AUTH : key;
    return authStorage.setItem(k, value);
  },
  removeItem: (key: string): Promise<void> => {
    const k = key === 'persist:root' ? STORAGE_KEYS.PERSIST_AUTH : key;
    return authStorage.removeItem(k);
  },
};
