/**
 * Navigation depuis une notification (tap sur la ligne).
 */
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import type { Notification } from '@/types/notification.types';
import { extractTontineUid } from '@/utils/notificationPayload';

type Nav = NativeStackNavigationProp<RootStackParamList, 'NotificationsScreen'>;

export function navigateFromNotification(n: Notification, navigation: Nav): void {
  const tontineUid = extractTontineUid(n);
  const t = String(n.type);

  switch (t) {
    case 'PAYMENT_REMINDER':
    case 'POT_DELAYED':
    case 'PENALTY_APPLIED':
      if (tontineUid) {
        navigation.navigate('TontineDetails', {
          tontineUid,
          tab: 'dashboard',
        });
      }
      break;
    case 'PAYMENT_RECEIVED':
      if (tontineUid) {
        navigation.navigate('TontineDetails', {
          tontineUid,
          tab: 'payments',
        });
      }
      break;
    case 'POT_AVAILABLE':
      if (tontineUid) {
        navigation.navigate('TontineDetails', {
          tontineUid,
          isCreator: true,
          tab: 'dashboard',
        });
      }
      break;
    case 'TONTINE_INVITATION':
      if (tontineUid) {
        navigation.navigate('TontineContractSignature', {
          mode: 'INVITE_ACCEPT',
          tontineUid,
        });
      }
      break;
    case 'ROTATION_CHANGED':
    case 'ROTATION_SWAP_REQUESTED':
      if (tontineUid) {
        navigation.navigate('TontineDetails', {
          tontineUid,
          tab: 'rotation',
        });
      }
      break;
    case 'SCORE_UPDATE':
      navigation.navigate('MainTabs', {
        screen: 'Profile',
        params: { screen: 'ScoreHistory' },
      });
      break;
    case 'KYC_UPDATE':
      navigation.navigate('MainTabs', {
        screen: 'Profile',
        params: { screen: 'Profile' },
      });
      break;
    case 'CASH_PENDING':
      navigation.navigate('MainTabs', {
        screen: 'Payments',
        params: { initialSegment: 'cashValidations' },
      });
      break;
    default:
      if (t.startsWith('SAVINGS_') && tontineUid) {
        navigation.navigate('SavingsDetailScreen', { tontineUid });
      }
      break;
  }
}
