/**
 * Montants affichés / envoyés sur PaymentScreen — alignés sur GET /users/me/next-payment
 * lorsque la réponse correspond au cycle / tontine du flux.
 */
import type { NextPaymentData } from '@/types/payment';

export type PaymentScreenResolvedAmounts = {
  cotisationRestante: number;
  penalty: number;
  /** Référence backend : totalAmountDue ou totalDue */
  total: number;
  daysLate: number | undefined;
  source: 'next_payment' | 'route';
  /** Retard calendaire ou pénalité > 0 */
  showOverdueContext: boolean;
};

export function resolvePaymentScreenAmounts(
  routeParams: {
    baseAmount: number;
    penaltyAmount: number;
    penaltyDays?: number;
  },
  nextForObligation: NextPaymentData | null,
  cycleUid: string,
  tontineUid: string
): PaymentScreenResolvedAmounts {
  if (
    nextForObligation != null &&
    nextForObligation.cycleUid === cycleUid &&
    nextForObligation.tontineUid === tontineUid
  ) {
    const cotisationRestante =
      nextForObligation.amountRemaining != null &&
      Number.isFinite(nextForObligation.amountRemaining)
        ? nextForObligation.amountRemaining
        : nextForObligation.amountDue;
    const penalty = Number.isFinite(nextForObligation.penaltyAmount)
      ? nextForObligation.penaltyAmount
      : 0;
    const totalRaw = nextForObligation.totalAmountDue ?? nextForObligation.totalDue;
    const total = Number.isFinite(totalRaw) ? totalRaw : cotisationRestante + penalty;
    const daysLate = nextForObligation.daysLate;
    const showOverdueContext =
      nextForObligation.isOverdue === true ||
      (daysLate != null && daysLate > 0) ||
      penalty > 0;

    return {
      cotisationRestante,
      penalty,
      total,
      daysLate,
      source: 'next_payment',
      showOverdueContext,
    };
  }

  const cotisationRestante = routeParams.baseAmount;
  const penalty = routeParams.penaltyAmount ?? 0;
  const total = cotisationRestante + penalty;
  const daysLate = routeParams.penaltyDays;
  const showOverdueContext =
    penalty > 0 || (daysLate != null && daysLate > 0);

  return {
    cotisationRestante,
    penalty,
    total,
    daysLate,
    source: 'route',
    showOverdueContext,
  };
}
