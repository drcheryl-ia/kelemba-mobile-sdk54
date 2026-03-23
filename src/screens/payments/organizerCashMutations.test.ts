import { describe, expect, it } from 'vitest';
import type { OrganizerCashPendingAction } from '@/api/cashPaymentApi';
import {
  decrementPendingCount,
  removePendingActionByPaymentUid,
} from './organizerCashMutations';

const stubRest: Pick<
  OrganizerCashPendingAction,
  | 'validationRequestUid'
  | 'cycleUid'
  | 'memberUid'
  | 'memberPhone'
  | 'paymentMethod'
  | 'status'
  | 'receiverName'
  | 'latitude'
  | 'longitude'
> = {
  validationRequestUid: 'vr-x',
  cycleUid: 'cycle-x',
  memberUid: 'member-x',
  memberPhone: '',
  paymentMethod: 'CASH',
  status: 'PENDING_REVIEW',
  receiverName: '',
  latitude: null,
  longitude: null,
};

describe('removePendingActionByPaymentUid', () => {
  it('removes only the targeted pending action', () => {
    const items: OrganizerCashPendingAction[] = [
      {
        ...stubRest,
        paymentUid: 'payment-1',
        tontineUid: 'tontine-1',
        tontineName: 'Alpha',
        memberName: 'Alice',
        cycleNumber: 1,
        amount: 1000,
        submittedAt: '2026-03-22T10:00:00.000Z',
        receiptPhotoUrl: null,
      },
      {
        ...stubRest,
        paymentUid: 'payment-2',
        tontineUid: 'tontine-1',
        tontineName: 'Alpha',
        memberName: 'Bob',
        cycleNumber: 1,
        amount: 2000,
        submittedAt: '2026-03-22T11:00:00.000Z',
        receiptPhotoUrl: null,
      },
    ];

    expect(removePendingActionByPaymentUid(items, 'payment-1')).toEqual([items[1]]);
  });
});

describe('decrementPendingCount', () => {
  it('never goes below zero', () => {
    expect(decrementPendingCount(3)).toBe(2);
    expect(decrementPendingCount(1)).toBe(0);
    expect(decrementPendingCount(0)).toBe(0);
    expect(decrementPendingCount(undefined)).toBe(0);
  });
});
