/**
 * Mapping historique API → entrées UI `PaymentHistoryEntry`.
 */
import type { PaymentHistoryEntry } from '@/types/payments.types';
import type { PaymentHistoryItem } from '@/types/tontine';

function entryTypeFor(
  item: PaymentHistoryItem
): PaymentHistoryEntry['entryType'] {
  if (item.cashAutoValidated === true) return 'CASH_VALIDATED';
  if (item.penalty > 0 && item.amount === 0) return 'PENALTY';
  return 'PAYMENT';
}

export function paymentHistoryItemToEntry(
  item: PaymentHistoryItem
): PaymentHistoryEntry {
  const paidAt = item.paidAt ?? item.createdAt ?? '';
  return {
    uid: item.uid,
    tontineUid: item.tontineUid,
    tontineName: item.tontineName,
    cycleNumber: item.cycleNumber,
    amount: Math.round(item.amount),
    penaltyAmount: Math.round(item.penalty),
    method: item.method,
    status: item.status,
    externalRef: null,
    paidAt,
    entryType: entryTypeFor(item),
  };
}
