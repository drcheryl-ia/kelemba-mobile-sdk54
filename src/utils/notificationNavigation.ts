/**
 * Actions métier depuis le détail d’une notification (navigation tabs / stack).
 */
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import type { NotificationType } from '@/types/notification.types';

export type NotificationDetailAction = {
  key: string;
  labelKey: string;
};

export function getNotificationDetailActions(
  type: NotificationType
): NotificationDetailAction[] {
  switch (type) {
    case 'TONTINE_INVITATION':
      return [{ key: 'invitations', labelKey: 'notifications.detail.ctaInvitations' }];
    case 'PAYMENT_REMINDER':
    case 'PAYMENT_RECEIVED':
      return [{ key: 'payments', labelKey: 'notifications.detail.ctaPayments' }];
    case 'POT_AVAILABLE':
    case 'POT_DELAYED':
      return [
        { key: 'tontines', labelKey: 'notifications.detail.ctaTontine' },
        { key: 'payments', labelKey: 'notifications.detail.ctaPayments' },
      ];
    case 'KYC_UPDATE':
      return [{ key: 'kyc', labelKey: 'notifications.detail.ctaKyc' }];
    case 'SCORE_UPDATE':
      return [{ key: 'score', labelKey: 'notifications.detail.ctaScore' }];
    case 'ROTATION_CHANGED':
    case 'PENALTY_APPLIED':
      return [{ key: 'tontines', labelKey: 'notifications.detail.ctaTontine' }];
    case 'SYSTEM':
    default:
      return [];
  }
}

export function executeNotificationDetailAction(
  navigation: NativeStackNavigationProp<RootStackParamList, 'NotificationsScreen'>,
  actionKey: string
): void {
  switch (actionKey) {
    case 'invitations':
      navigation.navigate('MainTabs', {
        screen: 'Tontines',
        params: { initialTab: 'invitations' },
      });
      break;
    case 'payments':
      navigation.navigate('MainTabs', { screen: 'Payments', params: undefined });
      break;
    case 'kyc':
      navigation.navigate('MainTabs', {
        screen: 'Profile',
        params: { screen: 'KycUpload', params: undefined },
      });
      break;
    case 'score':
      navigation.navigate('MainTabs', {
        screen: 'Profile',
        params: { screen: 'ScoreHistory', params: undefined },
      });
      break;
    case 'tontines':
      navigation.navigate('MainTabs', { screen: 'Tontines', params: undefined });
      break;
    default:
      break;
  }
}
