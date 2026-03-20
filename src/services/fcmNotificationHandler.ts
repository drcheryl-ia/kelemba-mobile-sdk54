/**
 * fcmNotificationHandler — gestion du tap sur notification FCM.
 * Lis les données du payload et navigue vers le bon écran.
 * Conforme OWASP Mobile — aucune donnée sensible dans le payload.
 */
import * as Notifications from 'expo-notifications';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import type { RootStackParamList } from '@/navigation/types';
import { logger } from '@/utils/logger';

type Nav = NavigationContainerRefWithCurrent<RootStackParamList>;

function safeString(v: unknown): string {
  return typeof v === 'string' && v.length > 0 ? v : '';
}

function safeNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Navigation métier depuis le payload (tap ou cold start). */
export function navigateFromFcmPayload(
  navigationRef: Nav,
  data: Record<string, unknown>
): void {
  const notifType = safeString(data.type);
  logger.info('[FCM] Traitement payload', { type: notifType });

  if (!navigationRef.isReady()) {
    logger.warn('[FCM] Navigation not ready — tap ignoré');
    return;
  }

  switch (notifType) {
    case 'PAYMENT_REMINDER': {
      const tontineUid = safeString(data.tontineUid);
      const cycleUid = safeString(data.cycleUid);
      const tontineName = safeString(data.tontineName);
      const dueDate = safeString(data.dueDate);
      const amountDue = safeNumber(data.amountDue);
      const cycleNumber = safeNumber(data.cycleNumber, 1);

      if (!tontineUid || !cycleUid) {
        navigationRef.navigate('MainTabs', {
          screen: 'Tontines',
          params: undefined,
        });
        break;
      }

      navigationRef.navigate('PaymentReminderScreen', {
        tontineUid,
        tontineName: tontineName || 'Tontine',
        cycleUid,
        amountDue,
        penaltyAmount: safeNumber(data.penaltyAmount, 0),
        dueDate: dueDate || new Date().toISOString().split('T')[0],
        cycleNumber,
      });
      break;
    }

    case 'PAYMENT_RECEIVED':
    case 'POT_AVAILABLE':
    case 'POT_DELAYED':
    case 'PENALTY_APPLIED':
    case 'ROTATION_CHANGED': {
      const tontineUid = safeString(data.tontineUid);
      if (tontineUid) {
        navigationRef.navigate('TontineDetails', {
          tontineUid,
          isCreator: false,
        });
      }
      break;
    }

    case 'TONTINE_INVITATION': {
      navigationRef.navigate('MainTabs', {
        screen: 'Tontines',
        params: { initialTab: 'invitations' },
      });
      break;
    }

    case 'KYC_UPDATE': {
      navigationRef.navigate('MainTabs', {
        screen: 'Profile',
        params: {
          screen: 'KycUpload',
          params: undefined,
        },
      });
      break;
    }

    case 'SCORE_UPDATE': {
      navigationRef.navigate('MainTabs', {
        screen: 'Profile',
        params: {
          screen: 'ScoreHistory',
          params: undefined,
        },
      });
      break;
    }

    case 'SYSTEM':
      break;

    default: {
      logger.warn('[FCM] Type de notification non géré', { notifType });
    }
  }
}

/**
 * Appelé une fois, au montage de l'AppNavigator.
 * Retourne une fonction de cleanup à appeler au démontage.
 */
export function registerFcmTapHandler(navigationRef: Nav): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;

      if (!data) return;

      logger.info('[FCM] Tap notification', { type: data.type });
      navigateFromFcmPayload(navigationRef, data);
    }
  );

  return () => subscription.remove();
}

/**
 * Cold start : app ouverte depuis une notification (app killed).
 */
export async function handleInitialNotification(nav: Nav): Promise<void> {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) return;

  const data = response.notification.request.content.data as
    | Record<string, unknown>
    | undefined;
  if (!data) return;

  logger.info('[FCM] Cold start depuis notification', { type: data.type });

  const run = (): void => {
    if (!nav.isReady()) return;
    navigateFromFcmPayload(nav, data);
  };

  run();
  setTimeout(run, 500);
  setTimeout(run, 1500);
}
