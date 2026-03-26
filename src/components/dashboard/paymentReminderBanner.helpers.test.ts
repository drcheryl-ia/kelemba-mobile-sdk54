import { describe, expect, it, vi, afterEach } from 'vitest';
import { buildDashboardReminderCards, isPendingCashValidationReminder } from './paymentReminderBanner.helpers';
import type { NextPaymentData } from '@/types/payment';
import type { PaymentHistoryItem, TontineListItem } from '@/types/tontine';

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

function makeSavingsTontine(overrides: Partial<TontineListItem>): TontineListItem {
  return {
    uid: 'sav-1',
    name: 'Épargne X',
    status: 'ACTIVE',
    type: 'EPARGNE',
    amountPerShare: 5000,
    frequency: 'MONTHLY',
    totalCycles: 0,
    currentCycle: null,
    membershipRole: 'MEMBER',
    membershipStatus: 'ACTIVE',
    nextPaymentDate: '2026-03-22',
    hasPaymentDue: true,
    savingsCurrentPeriodUid: 'period-uid-1',
    ...overrides,
  } as TontineListItem;
}

function makePayoutTontine(overrides: Partial<TontineListItem>): TontineListItem {
  return {
    uid: 'tontine-pot',
    name: 'Tontine Cagnotte',
    status: 'ACTIVE',
    type: 'ROTATIVE',
    amountPerShare: 5000,
    frequency: 'MONTHLY',
    totalCycles: 12,
    currentCycle: 2,
    membershipRole: 'CREATOR',
    membershipStatus: 'ACTIVE',
    currentCycleUid: 'cycle-pot-1',
    currentCycleNumber: 2,
    canTriggerPayout: true,
    payoutNetAmount: 50_000,
    ...overrides,
  } as TontineListItem;
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
  afterEach(() => {
    vi.useRealTimers();
  });

  it('insère un rappel épargne (échéance ≤ J+2) avant le prochain paiement rotatif', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-20T12:00:00.000Z'));
    const cards = buildDashboardReminderCards(makeNextPayment(), [], {
      savingsTontines: [makeSavingsTontine({ nextPaymentDate: '2026-03-22' })],
      limit: 3,
    });
    expect(cards.length).toBeGreaterThanOrEqual(2);
    expect(cards[0]?.kind).toBe('savingsPeriod');
    expect(cards[0]?.periodUid).toBe('period-uid-1');
    expect(cards.find((c) => c.kind === 'nextPayment')).toBeDefined();
  });

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

  it('prioritizes payout pot after pending validation and before next payment', () => {
    const cards = buildDashboardReminderCards(
      makeNextPayment(),
      [makeHistoryItem({ tontineUid: 'tontine-1', tontineName: 'Tontine Alpha' })],
      {
        organizerPayoutTontines: [makePayoutTontine({ uid: 'tontine-pot' })],
        limit: 3,
      }
    );

    expect(cards).toHaveLength(3);
    expect(cards[0]?.kind).toBe('pendingValidation');
    expect(cards[1]?.kind).toBe('payoutPot');
    expect(cards[2]?.kind).toBe('nextPayment');
  });

  it('shows payout pot before next payment when no pending cash', () => {
    const cards = buildDashboardReminderCards(makeNextPayment(), [], {
      organizerPayoutTontines: [makePayoutTontine({})],
      limit: 2,
    });

    expect(cards).toHaveLength(2);
    expect(cards[0]?.kind).toBe('payoutPot');
    expect(cards[1]?.kind).toBe('nextPayment');
  });
});
