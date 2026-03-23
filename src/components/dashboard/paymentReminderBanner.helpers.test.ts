import { describe, expect, it } from 'vitest';
import { buildDashboardReminderCards, isPendingCashValidationReminder } from './paymentReminderBanner.helpers';
import type { NextPaymentData } from '@/types/payment';
import type { PaymentHistoryItem } from '@/types/tontine';

function makeHistoryItem(overrides: Partial<PaymentHistoryItem>): PaymentHistoryItem {
  return {
    uid: 'payment-1',
    amount: 10000,
    penalty: 0,
    totalPaid: 10000,
    method: 'CASH',
    status: 'PENDING',
    paidAt: null,
    createdAt: '2026-03-20T10:00:00.000Z',
    cycleNumber: 2,
    tontineUid: 'tontine-1',
    tontineName: 'Tontine Alpha',
    ...overrides,
  };
}

function makeNextPayment(overrides: Partial<NextPaymentData>): NextPaymentData {
  return {
    tontineUid: 'tontine-2',
    tontineName: 'Tontine Beta',
    cycleUid: 'cycle-2',
    cycleNumber: 3,
    amountDue: 10000,
    penaltyAmount: 0,
    totalDue: 10000,
    dueDate: '2026-03-25',
    paymentStatus: 'PENDING',
    ...overrides,
  };
}

describe('isPendingCashValidationReminder', () => {
  it('keeps only non auto-validated cash items waiting for organizer decision', () => {
    expect(isPendingCashValidationReminder(makeHistoryItem({ status: 'PENDING' }))).toBe(true);
    expect(isPendingCashValidationReminder(makeHistoryItem({ status: 'PROCESSING' }))).toBe(true);
    expect(
      isPendingCashValidationReminder(
        makeHistoryItem({ status: 'COMPLETED', cashAutoValidated: true })
      )
    ).toBe(false);
    expect(
      isPendingCashValidationReminder(
        makeHistoryItem({ method: 'ORANGE_MONEY', status: 'PENDING' })
      )
    ).toBe(false);
  });
});

describe('buildDashboardReminderCards', () => {
  it('prioritizes pending validation before next payment and keeps another tontine below', () => {
    const cards = buildDashboardReminderCards(
      makeNextPayment(),
      [makeHistoryItem({ tontineUid: 'tontine-1', tontineName: 'Tontine Alpha' })]
    );

    expect(cards).toHaveLength(2);
    expect(cards[0]?.kind).toBe('pendingValidation');
    expect(cards[0]?.tontineUid).toBe('tontine-1');
    expect(cards[1]?.kind).toBe('nextPayment');
    expect(cards[1]?.tontineUid).toBe('tontine-2');
  });

  it('avoids duplicating a second reminder for the same tontine', () => {
    const cards = buildDashboardReminderCards(
      makeNextPayment({ tontineUid: 'tontine-1', tontineName: 'Tontine Alpha' }),
      [makeHistoryItem({ tontineUid: 'tontine-1', tontineName: 'Tontine Alpha' })]
    );

    expect(cards).toHaveLength(1);
    expect(cards[0]?.kind).toBe('pendingValidation');
  });

  it('falls back to multiple pending validations when several tontines need attention', () => {
    const cards = buildDashboardReminderCards(null, [
      makeHistoryItem({
        uid: 'payment-1',
        tontineUid: 'tontine-1',
        tontineName: 'Tontine Alpha',
        createdAt: '2026-03-20T10:00:00.000Z',
      }),
      makeHistoryItem({
        uid: 'payment-2',
        tontineUid: 'tontine-2',
        tontineName: 'Tontine Beta',
        createdAt: '2026-03-21T10:00:00.000Z',
      }),
    ]);

    expect(cards).toHaveLength(2);
    expect(cards[0]?.tontineUid).toBe('tontine-2');
    expect(cards[1]?.tontineUid).toBe('tontine-1');
  });
});
