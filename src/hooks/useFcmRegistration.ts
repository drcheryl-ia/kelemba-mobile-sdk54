/**
 * Hook — déclenche l'enregistrement FCM après connexion réussie.
 * Monté dans AppNavigator (NavigationContainer + Redux).
 */
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';
import { fcmTokenService } from '@/services/fcmTokenService';
import { logger } from '@/utils/logger';

export function useFcmRegistration(): void {
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    void fcmTokenService.registerAndSync().then((uid) => {
      if (uid) {
        logger.info('[FCM] Enregistrement OK', { tokenUid: uid });
      }
    });
  }, [isAuthenticated]);
}
