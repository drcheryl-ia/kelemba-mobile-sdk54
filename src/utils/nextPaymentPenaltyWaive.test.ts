import { describe, it, expect } from 'vitest';
import type { NextPaymentData } from '@/types/payment';
import type { PaymentHistoryItem } from '@/types/tontine';
import {
  hasPendingCashValidationForNextPayment,
  withNextPaymentPenaltyWaivedForPendingCashValidation,
} from '@/utils/nextPaymentPenaltyWaive';

function baseNext(overrides: Partial<NextPaymentData> = {}): NextPaymentData {
  return {
    tontineUid: 't-1',
    tontineName: 'Tontine A',
    cycleUid: 'c-1',
    cycleNumber: 3,
    amountDue: 10_000,
    penaltyAmount: 2_000,
    totalDue: 12_000,
    totalAmountDue: 12_000,
    dueDate: '2026-01-10',
    paymentStatus: 'PENDING',
    ...overrides,
  };
}

function cashPendingItem(overrides: Partial<PaymentHistoryItem> = {}): PaymentHistoryItem {
  return {
    uid: 'p-1',
    cycleUid: 'c-1',
    amount: 10_000,
    penalty: 0,
    totalPaid: 10_000,
    method: 'CASH',
    status: 'PENDING',
    paidAt: null,
    cycleNumber: 3,
    tontineUid: 't-1',
    tontineName: 'Tontine A',
    ...overrides,
  };
}

describe('hasPendingCashValidationForNextPayment', () => {
  it('returns true when pending cash matches tontine and cycleUid', () => {
    const np = baseNext();
    expect(hasPendingCashValidationForNextPayment(np, [cashPendingItem()])).toBe(true);
  });

  it('returns false when tontine differs', () => {
    const np = baseNext();
    expect(
      hasPendingCashValidationForNextPayment(np, [cashPendingItem({ tontineUid: 't-2' })])
    ).toBe(false);
  });

  it('returns false when cycleUid differs', () => {
    const np = baseNext();
    expect(
      hasPendingCashValidationForNextPayment(np, [cashPendingItem({ cycleUid: 'c-99' })])
    ).toBe(false);
  });

  it('matches by cycleNumber when history cycleUid is absent', () => {
    const np = baseNext();
    const item = cashPendingItem({ cycleUid: undefined });
    expect(hasPendingCashValidationForNextPayment(np, [item])).toBe(true);
  });

  it('returns false for non-CASH or completed cash', () => {
    const np = baseNext();
    expect(
      hasPendingCashValidationForNextPayment(np, [
        cashPendingItem({ method: 'ORANGE_MONEY' }),
      ])
    ).toBe(false);
    expect(
      hasPendingCashValidationForNextPayment(np, [
        cashPendingItem({ status: 'COMPLETED' }),
      ])
    ).toBe(false);
  });
});

describe('withNextPaymentPenaltyWaivedForPendingCashValidation', () => {
  it('zeros penalty and totals when pending cash matches obligation', () => {
    const np = baseNext({
      amountRemaining: 10_000,
      obligationStatus: 'PENALIZED',
      isOverdue: true,
    });
    const out = withNextPaymentPenaltyWaivedForPendingCashValidation(np, [cashPendingItem()]);
    expect(out).not.toBe(np);
    expect(out?.penaltyAmount).toBe(0);
    expect(out?.totalDue).toBe(10_000);
    expect(out?.totalAmountDue).toBe(10_000);
    expect(out?.obligationStatus).toBe('OVERDUE');
  });

  it('uses amountDue when amountRemaining missing', () => {
    const np = baseNext({ amountRemaining: undefined });
    const out = withNextPaymentPenaltyWaivedForPendingCashValidation(np, [cashPendingItem()]);
    expect(out?.totalDue).toBe(10_000);
  });

  it('returns same reference when no pending cash for obligation', () => {
    const np = baseNext();
    const out = withNextPaymentPenaltyWaivedForPendingCashValidation(np, []);
    expect(out).toBe(np);
  });

  it('returns null when nextPayment null', () => {
    expect(withNextPaymentPenaltyWaivedForPendingCashValidation(null, [])).toBeNull();
  });

  it('does not change PENALIZED to OVERDUE when not overdue', () => {
    const np = baseNext({
      isOverdue: false,
      obligationStatus: 'PENALIZED',
    });
    const out = withNextPaymentPenaltyWaivedForPendingCashValidation(np, [cashPendingItem()]);
    expect(out?.obligationStatus).toBe('DUE');
  });
});
