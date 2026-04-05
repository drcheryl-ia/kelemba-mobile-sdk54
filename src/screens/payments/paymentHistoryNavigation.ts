/**
 * Navigation depuis une ligne d'historique paiement (liste / écran historique complet).
 */
import { navigationRef } from '@/navigation/navigationRef';
import type { PaymentHistoryItem } from '@/types/tontine';
import { paymentHistoryPrimaryTotal } from '@/utils/paymentAmountDisplay';

export function openPaymentHistoryItemDetail(
  item: PaymentHistoryItem,
  userUid: string | null
): void {
  if (!navigationRef.isReady()) return;
  if (item.method === 'SYSTEM') return;

  const isCashProofAction =
    item.method === 'CASH' &&
    (item.status === 'PENDING' || item.status === 'PROCESSING') &&
    item.cashAutoValidated !== true &&
    item.memberUserUid !== userUid;

  if (isCashProofAction) {
    navigationRef.navigate('CashProofScreen', {
      paymentUid: item.uid,
      tontineUid: item.tontineUid,
      tontineName: item.tontineName,
      amount: paymentHistoryPrimaryTotal(item),
    });
    return;
  }

  navigationRef.navigate('PaymentStatusScreen', {
    paymentUid: item.uid,
    tontineUid: item.tontineUid,
    tontineName: item.tontineName,
    amount: paymentHistoryPrimaryTotal(item),
    method: item.method,
    initialStatus:
      item.status === 'PENDING' ||
      item.status === 'PROCESSING' ||
      item.status === 'COMPLETED' ||
      item.status === 'FAILED' ||
      item.status === 'REFUNDED'
        ? item.status
        : undefined,
  });
}
