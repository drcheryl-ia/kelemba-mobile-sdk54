/**
 * Rehydratation de accountType depuis SecureStore au démarrage.
 * Quand l'utilisateur est authentifié mais accountType est null (ex. ancienne session),
 * on restaure depuis SecureStore.
 */
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '@/store/store';
import type { RootState } from '@/store/store';
import { setAccountType } from '@/store/authSlice';
import { authStorage, STORAGE_KEYS } from '@/storage/authStorage';
import type { AccountType } from '@/types/user.types';

export function useAccountTypeRehydration() {
  const dispatch = useDispatch<AppDispatch>();
  const isAuthenticated = useSelector((s: RootState) => s.auth.isAuthenticated);
  const accountType = useSelector((s: RootState) => s.auth.currentUser?.accountType);

  useEffect(() => {
    if (!isAuthenticated || accountType !== null) return;

    const rehydrate = async () => {
      try {
        const stored = await authStorage.getItem(STORAGE_KEYS.ACCOUNT_TYPE);
        if (stored === 'MEMBRE' || stored === 'ORGANISATEUR') {
          dispatch(setAccountType(stored as AccountType));
        }
      } catch {
        // Ignorer les erreurs de lecture SecureStore
      }
    };

    void rehydrate();
  }, [isAuthenticated, accountType, dispatch]);
}
