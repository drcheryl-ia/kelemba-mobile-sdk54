/**
 * Montants affichés (historique cotisations & validations espèces organisateur).
 */
import type { OrganizerCashPendingAction } from '@/api/cashPaymentApi';
import type { PaymentHistoryItem } from '@/types/tontine';

/** Total réel cotisation : total payé backend, sinon part + pénalité. */
export function paymentHistoryPrimaryTotal(item: PaymentHistoryItem): number {
  return item.totalPaid ?? item.amount + item.penalty;
}

/**
 * Total à valider / afficher pour une ligne pending organisateur.
 * Préfère totalAmount, sinon base + pénalité si au moins un des deux est fourni, sinon amount.
 */
export function organizerCashPrimaryTotal(row: OrganizerCashPendingAction): number {
  const sumParts =
    row.baseAmount != null || row.penaltyAmount != null
      ? (row.baseAmount ?? 0) + (row.penaltyAmount ?? 0)
      : null;
  return row.totalAmount ?? sumParts ?? row.amount;
}

/** Part affichée (cotisation hors pénalité). */
export function organizerCashShareAmount(row: OrganizerCashPendingAction): number {
  return row.baseAmount ?? row.amount;
}

export function paymentHistoryShowAmountBreakdown(item: PaymentHistoryItem): boolean {
  const total = paymentHistoryPrimaryTotal(item);
  return item.penalty > 0 || total !== item.amount;
}

export function organizerCashShowAmountBreakdown(row: OrganizerCashPendingAction): boolean {
  const total = organizerCashPrimaryTotal(row);
  const share = organizerCashShareAmount(row);
  return (row.penaltyAmount ?? 0) > 0 || total !== share;
}
