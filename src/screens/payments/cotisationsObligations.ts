/**
 * Construction des obligations (cartes cotisations) à partir des tontines + next-payment.
 */
import type { NextPaymentData } from '@/types/payment';
import type { PaymentObligation, PaymentObligationStatus } from '@/types/payments.types';
import type { TontineListItem } from '@/types/tontine';
import {
  deriveTontinePaymentUiState,
  resolveCurrentCycleMemberDueDate,
  resolveTontineDueState,
  resolveTontinePaymentContext,
} from '@/utils/tontinePaymentState';
import { withNextPaymentPenaltyWaivedForPendingCashValidation } from '@/utils/nextPaymentPenaltyWaive';
import type { PaymentHistoryItem } from '@/types/tontine';
import { paymentHistoryPrimaryTotal } from '@/utils/paymentAmountDisplay';

function mapUiToObligationStatus(
  uiStatus: ReturnType<typeof deriveTontinePaymentUiState>['uiStatus'],
  dueState: ReturnType<typeof resolveTontineDueState>
): PaymentObligationStatus {
  /** Paiement initié (Mobile Money / espèces en cours de traitement) — affiché dans « À payer ». */
  if (dueState === 'PROCESSING') return 'DUE_SOON';
  switch (uiStatus) {
    case 'OVERDUE':
      return 'OVERDUE';
    case 'DUE_TODAY':
      return 'DUE_TODAY';
    case 'DUE_SOON':
      return 'DUE_SOON';
    case 'UP_TO_DATE':
      return 'PAID';
    default:
      return 'UPCOMING';
  }
}

export function buildPaymentObligations(
  tontines: TontineListItem[],
  nextPayment: NextPaymentData | null,
  cashHistoryForWaive: PaymentHistoryItem[]
): PaymentObligation[] {
  const np = withNextPaymentPenaltyWaivedForPendingCashValidation(
    nextPayment,
    cashHistoryForWaive
  );

  const out: PaymentObligation[] = [];

  for (const t of tontines) {
    if (t.status !== 'ACTIVE') continue;
    if (t.membershipStatus === 'PENDING') continue;

    const ui = deriveTontinePaymentUiState(t);
    const dueState = resolveTontineDueState(t);
    const ctx = resolveTontinePaymentContext(t);

    let obligationStatus = mapUiToObligationStatus(ui.uiStatus, dueState);

    const shares = t.userSharesCount ?? 1;
    let baseAmount = Math.round(ctx.amount);
    let penaltyAmount = Math.round(ctx.penaltyAmount);
    let totalAmountDue = Math.round(ctx.totalDue);
    let daysLate = 0;
    const dueDate =
      resolveCurrentCycleMemberDueDate(t) ??
      np?.dueDate ??
      ui.rawPaymentDate ??
      '';

    if (obligationStatus === 'OVERDUE') {
      daysLate = Math.max(0, ui.daysOverdue ?? 0);
    } else if (obligationStatus === 'DUE_TODAY') {
      daysLate = 0;
    } else if (obligationStatus === 'DUE_SOON') {
      daysLate = Math.max(0, ui.daysLeft ?? 0);
    } else if (obligationStatus === 'UPCOMING') {
      daysLate =
        ui.daysLeft != null && ui.daysLeft > 0 ? ui.daysLeft : 0;
    }

    if (np != null && np.tontineUid === t.uid) {
      baseAmount = Math.round(np.amountDue);
      penaltyAmount = Math.round(np.penaltyAmount ?? 0);
      totalAmountDue = Math.round(np.totalAmountDue ?? np.totalDue);
      if (np.isOverdue === true && np.daysLate != null) {
        daysLate = Math.max(0, np.daysLate);
        obligationStatus = 'OVERDUE';
      }
    }

    out.push({
      tontineUid: t.uid,
      tontineName: t.name,
      cycleUid: t.currentCycleUid ?? '',
      cycleNumber: t.currentCycleNumber ?? t.currentCycle ?? 0,
      frequency: t.frequency,
      baseAmount,
      penaltyAmount,
      totalAmountDue,
      daysLate,
      dueDate,
      obligationStatus,
      isCreator: t.isCreator === true,
    });
  }

  return out;
}

export function sortPayObligations(
  list: PaymentObligation[]
): PaymentObligation[] {
  const rank: Record<PaymentObligationStatus, number> = {
    OVERDUE: 0,
    DUE_TODAY: 1,
    DUE_SOON: 2,
    UPCOMING: 3,
    PAID: 4,
  };
  return [...list].sort((a, b) => {
    const ra = rank[a.obligationStatus];
    const rb = rank[b.obligationStatus];
    if (ra !== rb) return ra - rb;
    if (
      a.obligationStatus === 'OVERDUE' &&
      b.obligationStatus === 'OVERDUE'
    ) {
      return (b.daysLate ?? 0) - (a.daysLate ?? 0);
    }
    return 0;
  });
}

export function isPendingPipelineTontine(t: TontineListItem): boolean {
  const ps = t.currentCyclePaymentStatus ?? t.paymentStatus;
  return ps === 'PENDING' || ps === 'PROCESSING';
}

export function sumPendingDueAmount(obligations: PaymentObligation[]): number {
  return obligations
    .filter((o) =>
      ['OVERDUE', 'DUE_TODAY', 'DUE_SOON'].includes(o.obligationStatus)
    )
    .reduce((s, o) => s + Math.round(o.totalAmountDue), 0);
}

function isInCurrentMonth(iso: string | null | undefined): boolean {
  if (iso == null || iso === '') return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  );
}

export function sumPaidThisMonth(items: PaymentHistoryItem[]): number {
  return items
    .filter((i) => i.status === 'COMPLETED' && isInCurrentMonth(i.paidAt))
    .reduce((s, i) => s + paymentHistoryPrimaryTotal(i), 0);
}

export function sumPenaltiesThisMonth(items: PaymentHistoryItem[]): number {
  return items
    .filter((i) => i.status === 'COMPLETED' && isInCurrentMonth(i.paidAt))
    .reduce((s, i) => s + Math.round(i.penalty), 0);
}
