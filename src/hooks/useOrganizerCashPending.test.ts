import { describe, expect, it } from 'vitest';
import type { OrganizerCashPendingAction } from '@/api/cashPaymentApi';
import {
  filterOrganizerCashPendingForOthers,
  filterOrganizerCashPendingForTontineScope,
  isOpenOrganizerCashStatus,
} from '@/hooks/organizerCashPending.helpers';

function makeAction(
  overrides: Partial<OrganizerCashPendingAction> = {}
): OrganizerCashPendingAction {
  return {
    validationRequestUid: overrides.validationRequestUid ?? 'vr-1',
    paymentUid: overrides.paymentUid ?? 'payment-1',
    tontineUid: overrides.tontineUid ?? 'tontine-1',
    tontineName: overrides.tontineName ?? 'Solidarite Demo',
    memberName: overrides.memberName ?? 'Membre Demo',
    memberUid: overrides.memberUid ?? 'member-2',
    memberPhone: overrides.memberPhone ?? '+23670000000',
    cycleNumber: overrides.cycleNumber ?? 3,
    cycleUid: overrides.cycleUid ?? 'cycle-3',
    amount: overrides.amount ?? 10000,
    submittedAt: overrides.submittedAt ?? '2026-03-22T10:00:00.000Z',
    paymentMethod: overrides.paymentMethod ?? 'CASH',
    receiptPhotoUrl: overrides.receiptPhotoUrl ?? null,
    receiverName: overrides.receiverName ?? 'Organisateur Demo',
    status: overrides.status ?? 'PENDING_REVIEW',
    latitude: overrides.latitude ?? null,
    longitude: overrides.longitude ?? null,
  };
}

describe('useOrganizerCashPending helpers', () => {
  it('treats only PENDING_REVIEW as an open organizer cash status', () => {
    expect(isOpenOrganizerCashStatus('PENDING_REVIEW')).toBe(true);
    expect(isOpenOrganizerCashStatus('PENDING_VALIDATION')).toBe(false);
  });

  it('keeps only PENDING_REVIEW rows regardless of memberUid', () => {
    const actions = [
      makeAction({ paymentUid: 'payment-1', memberUid: 'member-2' }),
      makeAction({
        paymentUid: 'payment-2',
        memberUid: 'viewer-1',
        status: 'PENDING_REVIEW',
      }),
      makeAction({
        paymentUid: 'payment-3',
        memberUid: 'member-4',
        status: 'APPROVED',
      }),
    ];

    expect(filterOrganizerCashPendingForOthers(actions, 'viewer-1')).toEqual([
      actions[0],
      actions[1],
    ]);
  });

  it('keeps only organizer-scope tontines after filtering pending validation requests', () => {
    const actions = [
      makeAction({ paymentUid: 'payment-1', tontineUid: 'tontine-1' }),
      makeAction({ paymentUid: 'payment-2', tontineUid: 'tontine-2' }),
    ];

    expect(
      filterOrganizerCashPendingForTontineScope(
        actions,
        'viewer-1',
        new Set(['tontine-2'])
      )
    ).toEqual([actions[1]]);
  });
});
