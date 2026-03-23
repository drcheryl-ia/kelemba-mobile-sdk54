import { describe, it, expect } from 'vitest';
import { parseNextPaymentPayload } from '@/utils/nextPaymentUi';

const base = {
  tontineUid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  tontineName: 'T1',
  cycleUid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  cycleNumber: 2,
  amountDue: 5000,
  penaltyAmount: 0,
  totalDue: 5000,
  dueDate: '2025-07-10',
  paymentStatus: 'PENDING',
};

describe('parseNextPaymentPayload', () => {
  it('retourne null si COMPLETED même avec totalDue > 0 (données incohérentes)', () => {
    expect(
      parseNextPaymentPayload({
        ...base,
        paymentStatus: 'COMPLETED',
        totalDue: 5000,
      })
    ).toBeNull();
  });

  it('retourne null si totalDue <= 0', () => {
    expect(
      parseNextPaymentPayload({
        ...base,
        totalDue: 0,
        amountDue: 0,
      })
    ).toBeNull();
  });

  it('retourne null si dueDate absente', () => {
    expect(
      parseNextPaymentPayload({
        ...base,
        dueDate: '',
      })
    ).toBeNull();
  });

  it('retourne null si cycleUid ou tontineUid absent', () => {
    expect(
      parseNextPaymentPayload({
        ...base,
        cycleUid: '',
      })
    ).toBeNull();
  });

  it('accepte PENDING avec montants et date valides', () => {
    const r = parseNextPaymentPayload(base);
    expect(r).not.toBeNull();
    expect(r?.paymentStatus).toBe('PENDING');
    expect(r?.totalDue).toBe(5000);
    expect(r?.dueDate).toBe('2025-07-10');
  });

  it('accepte PROCESSING avec total dû', () => {
    const r = parseNextPaymentPayload({
      ...base,
      paymentStatus: 'PROCESSING',
      totalDue: 8000,
      penaltyAmount: 3000,
      amountDue: 5000,
    });
    expect(r?.paymentStatus).toBe('PROCESSING');
    expect(r?.totalDue).toBe(8000);
  });

  it('recalcule totalDue depuis amountDue + penalty si totalDue absent', () => {
    const r = parseNextPaymentPayload({
      ...base,
      totalDue: undefined,
      amountDue: 4000,
      penaltyAmount: 1000,
    });
    expect(r?.totalDue).toBe(5000);
  });

  it('normalise dueDate ISO en date seule', () => {
    const r = parseNextPaymentPayload({
      ...base,
      dueDate: '2025-12-01T00:00:00.000Z',
    });
    expect(r?.dueDate).toBe('2025-12-01');
  });

  it('conserve les champs enrichis du backend utiles au pilotage', () => {
    const r = parseNextPaymentPayload({
      ...base,
      amountRemaining: 3500,
      amountPaid: 1500,
      baseContributionAmount: 5000,
      totalAmountDue: 4200,
      isOverdue: true,
      daysLate: 4,
      obligationStatus: 'PENALIZED',
      recordPaymentUid: 'payment-123',
      recordPaymentStatus: 'PROCESSING',
    });
    expect(r).not.toBeNull();
    expect(r?.amountRemaining).toBe(3500);
    expect(r?.amountPaid).toBe(1500);
    expect(r?.baseContributionAmount).toBe(5000);
    expect(r?.totalAmountDue).toBe(4200);
    expect(r?.isOverdue).toBe(true);
    expect(r?.daysLate).toBe(4);
    expect(r?.obligationStatus).toBe('PENALIZED');
    expect(r?.recordPaymentUid).toBe('payment-123');
    expect(r?.recordPaymentStatus).toBe('PROCESSING');
  });

  it('membre à jour — aucun rappel : COMPLETED explicite', () => {
    expect(
      parseNextPaymentPayload({
        ...base,
        paymentStatus: 'COMPLETED',
        totalDue: 0,
      })
    ).toBeNull();
  });
});
