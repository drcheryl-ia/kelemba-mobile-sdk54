/**
 * Pénalités : si un paiement espèces est en attente de validation organisateur pour la même
 * obligation que le « prochain paiement », on n’applique pas de pénalité (affichage + navigation).
 */
import type { NextPaymentData } from '@/types/payment';
import type { PaymentHistoryItem } from '@/types/tontine';
import { isPendingCashValidationReminder } from '@/components/dashboard/paymentReminderBanner.helpers';

function matchesSameObligation(
  item: PaymentHistoryItem,
  nextPayment: NextPaymentData
): boolean {
  if (item.tontineUid !== nextPayment.tontineUid) return false;
  const itemCycle = item.cycleUid?.trim();
  if (itemCycle) {
    return itemCycle === nextPayment.cycleUid;
  }
  return item.cycleNumber === nextPayment.cycleNumber;
}

export function hasPendingCashValidationForNextPayment(
  nextPayment: NextPaymentData,
  cashHistoryItems: PaymentHistoryItem[]
): boolean {
  return cashHistoryItems.some(
    (item) =>
      isPendingCashValidationReminder(item) && matchesSameObligation(item, nextPayment)
  );
}

/**
 * Retourne une copie du prochain paiement avec pénalité annulée si l’historique confirme
 * un cash en attente de validation pour la même obligation ; sinon retourne l’entrée inchangée.
 */
export function withNextPaymentPenaltyWaivedForPendingCashValidation(
  nextPayment: NextPaymentData | null,
  cashHistoryItems: PaymentHistoryItem[]
): NextPaymentData | null {
  if (nextPayment == null) return null;
  if (!hasPendingCashValidationForNextPayment(nextPayment, cashHistoryItems)) {
    return nextPayment;
  }
  const base =
    nextPayment.amountRemaining != null && Number.isFinite(nextPayment.amountRemaining)
      ? nextPayment.amountRemaining
      : nextPayment.amountDue;

  let obligationStatus = nextPayment.obligationStatus;
  if (obligationStatus === 'PENALIZED') {
    obligationStatus = nextPayment.isOverdue === true ? 'OVERDUE' : 'DUE';
  }

  return {
    ...nextPayment,
    penaltyAmount: 0,
    totalDue: base,
    totalAmountDue: base,
    obligationStatus,
  };
}
