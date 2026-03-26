import { describe, expect, it } from 'vitest';
import type { OrganizerCashPendingAction } from '@/api/cashPaymentApi';
import type { PaymentHistoryItem } from '@/types/tontine';
import {
  organizerCashPrimaryTotal,
  paymentHistoryPrimaryTotal,
} from './paymentAmountDisplay';

function baseHistory(over: Partial<PaymentHistoryItem>): PaymentHistoryItem {
  return {
    uid: 'p1',
    amount: 5000,
    penalty: 0,
    totalPaid: 5000,
    method: 'CASH',
    status: 'COMPLETED',
    paidAt: null,
    cycleNumber: 1,
    tontineUid: 't1',
    tontineName: 'T',
    ...over,
  };
}

function baseCash(over: Partial<OrganizerCashPendingAction>): OrganizerCashPendingAction {
  return {
    validationRequestUid: 'v1',
    paymentUid: 'pay1',
    tontineUid: 't1',
    tontineName: 'T',
    cycleUid: 'c1',
    cycleNumber: 1,
    memberUid: 'm1',
    memberName: 'Membre',
    memberPhone: '+236',
    submittedAt: '2025-01-01T10:00:00Z',
    amount: 5000,
    paymentMethod: 'CASH',
    status: 'PENDING_REVIEW',
    receiptPhotoUrl: null,
    receiverName: 'X',
    latitude: null,
    longitude: null,
    ...over,
  };
}

describe('paymentHistoryPrimaryTotal', () => {
  it('utilise totalPaid quand part + pénalité', () => {
    const item = baseHistory({ amount: 5000, penalty: 1000, totalPaid: 6000 });
    expect(paymentHistoryPrimaryTotal(item)).toBe(6000);
  });

  it('fallback part + pénalité si totalPaid absent sur l’objet', () => {
    const item = baseHistory({ amount: 5000, penalty: 1000, totalPaid: 6000 });
    const r = { ...item } as Record<string, unknown>;
    delete r.totalPaid;
    expect(paymentHistoryPrimaryTotal(r as PaymentHistoryItem)).toBe(6000);
  });
});

describe('organizerCashPrimaryTotal', () => {
  it('préfère totalAmount explicite', () => {
    const row = baseCash({
      baseAmount: 5000,
      penaltyAmount: 1000,
      totalAmount: 6000,
    });
    expect(organizerCashPrimaryTotal(row)).toBe(6000);
  });

  it('somme base + pénalité si totalAmount absent', () => {
    const row = baseCash({ baseAmount: 5000, penaltyAmount: 1000 });
    expect(organizerCashPrimaryTotal(row)).toBe(6000);
  });

  it('retombe sur amount si pas de détail', () => {
    const row = baseCash({ amount: 5000 });
    expect(organizerCashPrimaryTotal(row)).toBe(5000);
  });
});
