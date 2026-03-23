import { describe, it, expect } from 'vitest';
import type { NextPaymentData } from '@/types/payment';
import { resolvePaymentScreenAmounts } from '@/utils/paymentScreenAmounts';

function np(overrides: Partial<NextPaymentData>): NextPaymentData {
  return {
    tontineUid: 't1',
    tontineName: 'T',
    cycleUid: 'c1',
    cycleNumber: 1,
    amountDue: 10000,
    penaltyAmount: 0,
    totalDue: 10000,
    dueDate: '2026-01-01',
    paymentStatus: 'PENDING',
    ...overrides,
  };
}

describe('resolvePaymentScreenAmounts', () => {
  it('uses next-payment when cycle and tontine match', () => {
    const r = resolvePaymentScreenAmounts(
      { baseAmount: 999, penaltyAmount: 999 },
      np({
        amountRemaining: 8000,
        penaltyAmount: 2000,
        totalAmountDue: 10000,
        totalDue: 10000,
        daysLate: 3,
        isOverdue: true,
      }),
      'c1',
      't1'
    );
    expect(r.source).toBe('next_payment');
    expect(r.cotisationRestante).toBe(8000);
    expect(r.penalty).toBe(2000);
    expect(r.total).toBe(10000);
    expect(r.daysLate).toBe(3);
    expect(r.showOverdueContext).toBe(true);
  });

  it('falls back to route when cycleUid differs', () => {
    const r = resolvePaymentScreenAmounts(
      { baseAmount: 5000, penaltyAmount: 500, penaltyDays: 2 },
      np({ cycleUid: 'other' }),
      'c1',
      't1'
    );
    expect(r.source).toBe('route');
    expect(r.total).toBe(5500);
    expect(r.cotisationRestante).toBe(5000);
    expect(r.penalty).toBe(500);
  });

  it('route: no penalty state', () => {
    const r = resolvePaymentScreenAmounts(
      { baseAmount: 10000, penaltyAmount: 0 },
      null,
      'c1',
      't1'
    );
    expect(r.penalty).toBe(0);
    expect(r.total).toBe(10000);
    expect(r.showOverdueContext).toBe(false);
  });
});
