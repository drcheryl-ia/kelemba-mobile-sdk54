/**
 * Hook — notifications en foreground (audit + logs).
 * Tap / cold start : @/services/fcmNotificationHandler (registerFcmTapHandler, handleInitialNotification).
 * Compatible Expo SDK 54 · expo-notifications.
 */
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import type { RootStackParamList } from '@/navigation/types';
import { logger } from '@/utils/logger';
import { auditNotificationReceived } from '@/utils/notificationAuditTrail';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type NotificationType =
  | 'PAYMENT_REMINDER'
  | 'PAYMENT_RECEIVED'
  | 'POT_AVAILABLE'
  | 'POT_DELAYED'
  | 'TONTINE_INVITATION'
  | 'PENALTY_APPLIED'
  | 'ROTATION_CHANGED'
  | 'KYC_UPDATE'
  | 'SCORE_UPDATE'
  | 'SYSTEM';

interface NotificationData {
  type?: NotificationType;
  tontineUid?: string;
  cycleUid?: string;
  paymentUid?: string;
}

export function useNotificationHandler(
  _navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>
): void {
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data as NotificationData;
        auditNotificationReceived(
          typeof data?.type === 'string' ? data.type : '',
          (data ?? {}) as Record<string, unknown>
        );
        logger.info('[Notification] Reçue en foreground', {
          type: data?.type,
          tontineUid: data.tontineUid,
        });
      }
    );

    return () => {
      notificationListener.current?.remove();
      notificationListener.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- enregistrement unique ; ref stable (createNavigationContainerRef)
}
