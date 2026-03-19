/**
 * Hook push notifications — FCM via Expo, EAS Build requis.
 * Expo Go ne supporte PAS les push notifications natives.
 * Stocke le token FCM dans AsyncStorage (compatible Expo Go).
 *
 * @requires EAS Build — google-services.json / GoogleService-Info.plist (gitignorés)
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { apiClient } from '@/api/apiClient';
import { ENDPOINTS } from '@/api/endpoints';
import { parseApiError } from '@/api/errors/errorHandler';
import { logger } from '@/utils/logger';

const FCM_TOKEN_KEY = 'fcm_push_token';
const FCM_TOKEN_UID_KEY = 'fcm_token_uid';

export type NotificationData =
  | { type: 'TONTINE'; tontineUid: string }
  | { type: 'PAYMENT'; paymentUid?: string }
  | { type: 'SCORE' }
  | { type: string };

export interface UsePushNotificationsReturn {
  permissionStatus: 'granted' | 'denied' | 'undetermined';
  isRegistered: boolean;
  requestPermissionAndRegister: () => Promise<void>;
  unregisterDevice: () => Promise<void>;
}

export interface UsePushNotificationsOptions {
  navigationRef: React.RefObject<{
    navigate: (name: string, params?: Record<string, unknown>) => void;
  }>;
  onForegroundNotification?: (title: string | null, body: string | null) => void;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications(
  options: UsePushNotificationsOptions
): UsePushNotificationsReturn {
  const { navigationRef, onForegroundNotification } = options;
  const [permissionStatus, setPermissionStatus] = useState<
    'granted' | 'denied' | 'undetermined'
  >('undetermined');
  const [isRegistered, setIsRegistered] = useState(false);

  const notificationListenerRef = useRef<Notifications.EventSubscription>();
  const responseListenerRef = useRef<Notifications.EventSubscription>();

  const requestPermissionAndRegister = useCallback(async () => {
    if (!Device.isDevice) {
      logger.error('Push notifications non disponibles sur simulateur');
      return;
    }

    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setPermissionStatus(status);
      if (status !== 'granted') {
        return;
      }

      const tokenData = await Notifications.getDevicePushTokenAsync();
      const token = tokenData.data;
      if (!token) {
        logger.error('Token FCM non récupéré');
        return;
      }

      await AsyncStorage.setItem(FCM_TOKEN_KEY, token);

      const { url } = ENDPOINTS.NOTIFICATIONS.REGISTER_DEVICE;
      const response = await apiClient.post<{ uid?: string }>(url, {
        token,
        platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
        provider: 'FCM',
      });

      if (response.data?.uid != null) {
        await AsyncStorage.setItem(FCM_TOKEN_UID_KEY, String(response.data.uid));
      }
      setIsRegistered(true);
    } catch (err: unknown) {
      const apiErr = parseApiError(err);
      if (apiErr.httpStatus !== 409 && apiErr.httpStatus !== 400) {
        logger.error('Échec enregistrement token FCM');
      }
    }
  }, []);

  const unregisterDevice = useCallback(async () => {
    try {
      const tokenUid = await AsyncStorage.getItem(FCM_TOKEN_UID_KEY);
      if (!tokenUid) return;

      const { url } = ENDPOINTS.NOTIFICATIONS.UNREGISTER_DEVICE(tokenUid);
      await apiClient.delete(url);
      await AsyncStorage.removeItem(FCM_TOKEN_KEY);
      await AsyncStorage.removeItem(FCM_TOKEN_UID_KEY);
      setIsRegistered(false);
    } catch (err: unknown) {
      logger.error('Échec désenregistrement device');
    }
  }, []);

  useEffect(() => {
    const setupListeners = () => {
      notificationListenerRef.current =
        Notifications.addNotificationReceivedListener((notification) => {
          const { title, body } = notification.request.content;
          onForegroundNotification?.(title ?? null, body ?? null);
        });

      responseListenerRef.current =
        Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response.notification.request.content
            .data as NotificationData | undefined;
          const nav = navigationRef.current;

          if (!nav?.navigate) return;

          const type = data?.type ?? '';
          switch (type) {
            case 'TONTINE':
              if (data && 'tontineUid' in data) {
                nav.navigate('TontineDetails', {
                  tontineUid: data.tontineUid,
                });
              }
              break;
            case 'PAYMENT':
              nav.navigate('MainTabs', { screen: 'Payments' });
              break;
            case 'SCORE':
              nav.navigate('MainTabs', {
                screen: 'Profile',
                params: { screen: 'ScoreHistory' },
              });
              break;
            default:
              nav.navigate('MainTabs', { screen: 'History' });
          }
        });
    };

    setupListeners();

    return () => {
      notificationListenerRef.current?.remove();
      responseListenerRef.current?.remove();
    };
  }, [navigationRef, onForegroundNotification]);

  return {
    permissionStatus,
    isRegistered,
    requestPermissionAndRegister,
    unregisterDevice,
  };
}
