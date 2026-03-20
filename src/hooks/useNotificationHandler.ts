/**
 * Hook — écoute les notifications push et navigue selon le type.
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

function navigateFromNotification(
  nav: NavigationContainerRefWithCurrent<RootStackParamList>,
  data: NotificationData
): void {
  const type = data?.type;
  if (!type) return;

  logger.info('[Notification] Tap reçu', { type, tontineUid: data.tontineUid });

  switch (type) {
    case 'PAYMENT_REMINDER':
    case 'PAYMENT_RECEIVED':
    case 'POT_AVAILABLE':
    case 'POT_DELAYED':
    case 'PENALTY_APPLIED':
    case 'ROTATION_CHANGED':
      if (data.tontineUid) {
        nav.navigate('TontineDetails', {
          tontineUid: data.tontineUid,
          isCreator: false,
        });
      }
      break;

    case 'TONTINE_INVITATION':
      nav.navigate('MainTabs', {
        screen: 'Tontines',
        params: { initialTab: 'invitations' },
      });
      break;

    case 'KYC_UPDATE':
      nav.navigate('MainTabs', {
        screen: 'Profile',
        params: {
          screen: 'KycUpload',
          params: undefined,
        },
      });
      break;

    case 'SCORE_UPDATE':
      nav.navigate('MainTabs', {
        screen: 'Profile',
        params: {
          screen: 'ScoreHistory',
          params: undefined,
        },
      });
      break;

    case 'SYSTEM':
    default:
      break;
  }
}

function tryNavigate(
  nav: NavigationContainerRefWithCurrent<RootStackParamList>,
  data: NotificationData
): void {
  if (!nav.isReady()) return;
  navigateFromNotification(nav, data);
}

export function useNotificationHandler(
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>
): void {
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

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

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as NotificationData;
        const nav = navigationRef;
        if (!nav.isReady()) {
          setTimeout(() => {
            tryNavigate(navigationRef, data);
          }, 500);
          return;
        }
        navigateFromNotification(nav, data);
      }
    );

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as NotificationData;
      tryNavigate(navigationRef, data);
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
      notificationListener.current = null;
      responseListener.current = null;
    };
  }, [navigationRef]);
}
