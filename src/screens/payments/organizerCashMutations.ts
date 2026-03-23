import type { OrganizerCashPendingAction } from '@/api/cashPaymentApi';

export type CashDecisionAction = 'APPROVE' | 'REJECT';

export function removePendingActionByPaymentUid(
  actions: OrganizerCashPendingAction[] | undefined,
  paymentUid: string
): OrganizerCashPendingAction[] {
  if (!Array.isArray(actions)) return [];
  return actions.filter((item) => item.paymentUid !== paymentUid);
}

export function decrementPendingCount(count: number | undefined): number {
  if (typeof count !== 'number' || !Number.isFinite(count)) return 0;
  return Math.max(0, count - 1);
}
