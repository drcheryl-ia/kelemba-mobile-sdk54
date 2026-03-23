import type { NextPaymentData } from '@/types/payment';
import type { PaymentHistoryItem } from '@/types/tontine';

export type DashboardReminderKind = 'pendingValidation' | 'nextPayment';

export interface DashboardReminderCardVm {
  key: string;
  kind: DashboardReminderKind;
  tontineUid: string;
  tontineName: string;
  amount: number;
  cycleUid?: string;
  cycleNumber?: number;
  dueDate?: string;
  createdAt?: string;
  status?: PaymentHistoryItem['status'];
}

function getReminderTime(value: string | null | undefined): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function isPendingCashValidationReminder(item: PaymentHistoryItem): boolean {
  return (
    item.method === 'CASH' &&
    (item.status === 'PENDING' || item.status === 'PROCESSING') &&
    item.cashAutoValidated !== true
  );
}

export function buildDashboardReminderCards(
  nextPayment: NextPaymentData | null,
  historyItems: PaymentHistoryItem[],
  limit = 2
): DashboardReminderCardVm[] {
  const cards: DashboardReminderCardVm[] = [];
  const usedTontines = new Set<string>();

  const pendingValidationCandidates = [...historyItems]
    .filter(isPendingCashValidationReminder)
    .sort(
      (a, b) =>
        getReminderTime(b.createdAt ?? b.paidAt ?? null) -
        getReminderTime(a.createdAt ?? a.paidAt ?? null)
    );

  for (const item of pendingValidationCandidates) {
    if (!item.tontineUid || usedTontines.has(item.tontineUid)) continue;
    cards.push({
      key: `pending-${item.uid}`,
      kind: 'pendingValidation',
      tontineUid: item.tontineUid,
      tontineName: item.tontineName,
      amount: item.totalPaid,
      cycleUid: item.cycleUid,
      cycleNumber: item.cycleNumber,
      createdAt: item.createdAt ?? item.paidAt ?? undefined,
      status: item.status,
    });
    usedTontines.add(item.tontineUid);
    if (cards.length >= limit) return cards;
  }

  if (nextPayment && !usedTontines.has(nextPayment.tontineUid) && cards.length < limit) {
    cards.push({
      key: `next-${nextPayment.cycleUid}`,
      kind: 'nextPayment',
      tontineUid: nextPayment.tontineUid,
      tontineName: nextPayment.tontineName,
      amount: nextPayment.totalDue,
      cycleUid: nextPayment.cycleUid,
      cycleNumber: nextPayment.cycleNumber,
      dueDate: nextPayment.dueDate,
      status: nextPayment.paymentStatus,
    });
  }

  return cards;
}
