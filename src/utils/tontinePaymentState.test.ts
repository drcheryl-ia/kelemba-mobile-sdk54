import { describe, it, expect } from 'vitest';
import type { TontineListItem } from '@/types/tontine';
import {
  deriveTontinePaymentUiState,
  pickMostUrgentTontineForDashboard,
  resolveDisplayPaymentDate,
  resolveScheduledPaymentDate,
  resolveTontineDueState,
  resolveTontinePaymentContext,
} from '@/utils/tontinePaymentState';

function baseTontine(over: Partial<TontineListItem> = {}): TontineListItem {
  return {
    uid: 't1',
    name: 'Test',
    status: 'ACTIVE',
    amountPerShare: 5000,
    frequency: 'MONTHLY',
    totalCycles: 12,
    currentCycle: 1,
    membershipRole: 'MEMBER',
    membershipStatus: 'ACTIVE',
    ...over,
  };
}

describe('deriveTontinePaymentUiState', () => {
  it('hasPaymentDue absent → ne pas afficher À jour (UNKNOWN)', () => {
    const now = new Date('2025-06-15T12:00:00');
    const s = deriveTontinePaymentUiState(
      baseTontine({ hasPaymentDue: undefined, nextPaymentDate: undefined }),
      now
    );
    expect(s.uiStatus).toBe('UNKNOWN');
    expect(s.badgeLabel).toContain('Statut indisponible');
    expect(s.needsPaymentAttention).toBe(false);
  });

  it('currentCycleExpectedDate seule reste informative sans marquer une dette', () => {
    const now = new Date('2025-06-15T12:00:00');
    const s = deriveTontinePaymentUiState(
      baseTontine({
        hasPaymentDue: undefined,
        nextPaymentDate: undefined,
        currentCycleExpectedDate: '2025-06-20',
      }),
      now
    );
    expect(s.uiStatus).toBe('UNKNOWN');
    expect(s.displayDate).toBe('20/06/2025');
    expect(s.badgeLabel).toBe('Date prevue');
    expect(s.needsPaymentAttention).toBe(false);
  });

  it('hasPaymentDue true garde un état dû explicite', () => {
    const now = new Date('2025-06-15T12:00:00');
    const s = deriveTontinePaymentUiState(
      baseTontine({
        hasPaymentDue: true,
        nextPaymentDate: '2025-06-20',
      }),
      now
    );
    expect(s.uiStatus).toBe('DUE_SOON');
    expect(s.badgeLabel).toContain('À payer');
    expect(s.needsPaymentAttention).toBe(true);
  });

  it('hasPaymentDue false sans date → À jour', () => {
    const now = new Date('2025-06-15T12:00:00');
    const s = deriveTontinePaymentUiState(
      baseTontine({
        hasPaymentDue: false,
        nextPaymentDate: null,
      }),
      now
    );
    expect(s.uiStatus).toBe('UP_TO_DATE');
    expect(s.badgeLabel).toContain('À jour');
  });

  it('PENDING sans hasPaymentDue affiche une dette dès qu une date est connue', () => {
    const now = new Date('2025-06-15T12:00:00');
    const s = deriveTontinePaymentUiState(
      baseTontine({
        hasPaymentDue: undefined,
        nextPaymentDate: '2025-06-20',
        currentCyclePaymentStatus: 'PENDING',
      }),
      now
    );
    expect(s.uiStatus).toBe('DUE_SOON');
    expect(s.needsPaymentAttention).toBe(true);
  });

  it('currentCyclePaymentStatus processing neutralise le rappel agressif', () => {
    const now = new Date('2025-06-15T12:00:00');
    const s = deriveTontinePaymentUiState(
      baseTontine({
        hasPaymentDue: undefined,
        nextPaymentDate: '2025-06-20',
        currentCyclePaymentStatus: 'PROCESSING',
      }),
      now
    );

    expect(s.badgeLabel).toBe('Paiement en cours');
    expect(s.needsPaymentAttention).toBe(false);
  });
});

describe('resolveDisplayPaymentDate', () => {
  it('hasPaymentDue + currentDueDate prioritaire sur nextPaymentDate', () => {
    expect(
      resolveDisplayPaymentDate(
        baseTontine({
          hasPaymentDue: true,
          currentDueDate: '2025-06-10',
          nextPaymentDate: '2025-06-18',
          currentCycleExpectedDate: '2025-06-20',
        })
      )
    ).toBe('2025-06-10');
  });

  it('à jour : nextScheduledCycleDate sans retomber sur currentCycleExpectedDate', () => {
    expect(
      resolveDisplayPaymentDate(
        baseTontine({
          hasPaymentDue: false,
          currentCyclePaymentStatus: 'COMPLETED',
          nextScheduledCycleDate: '2025-07-01',
          currentCycleExpectedDate: '2025-06-15',
          nextPaymentDate: null,
        })
      )
    ).toBe('2025-07-01');
  });

  it('à jour sans nextScheduled ni nextDue ni nextPayment : pas de date cycle courant seule', () => {
    expect(
      resolveDisplayPaymentDate(
        baseTontine({
          hasPaymentDue: false,
          currentCyclePaymentStatus: 'COMPLETED',
          currentCycleExpectedDate: '2025-06-15',
          nextPaymentDate: null,
        })
      )
    ).toBeNull();
  });
});

describe('resolveTontinePaymentContext', () => {
  it('prefers currentDueDate then nextPaymentDate over currentCycleExpectedDate and keeps computed amounts', () => {
    const now = new Date('2025-06-15T12:00:00');
    const payment = resolveTontinePaymentContext(
      baseTontine({
        currentDueDate: '2025-06-12',
        nextPaymentDate: '2025-06-18',
        currentCycleExpectedDate: '2025-06-20',
        hasPaymentDue: true,
        userSharesCount: 2,
      }),
      now
    );

    expect(
      resolveScheduledPaymentDate(
        baseTontine({
          currentDueDate: '2025-06-12',
          nextPaymentDate: '2025-06-18',
          currentCycleExpectedDate: '2025-06-20',
          hasPaymentDue: true,
        })
      )
    ).toBe('2025-06-12');
    expect(payment.scheduledDate).toBe('2025-06-12');
    expect(payment.amount).toBe(10000);
    expect(payment.totalDue).toBe(10000);
    expect(payment.showAmountBreakdown).toBe(true);
  });

  it('keeps explicit penalty and total from backend without inventing extra values', () => {
    const payment = resolveTontinePaymentContext(
      baseTontine({
        hasPaymentDue: true,
        nextPaymentDate: '2025-06-20',
        penaltyAmount: 1500,
        totalAmountDue: 11500,
        userSharesCount: 2,
      })
    );

    expect(payment.amount).toBe(10000);
    expect(payment.penaltyAmount).toBe(1500);
    expect(payment.totalDue).toBe(11500);
  });

  it('derives due state from explicit member payment status when available', () => {
    expect(
      resolveTontineDueState(
        baseTontine({ currentCyclePaymentStatus: 'COMPLETED', hasPaymentDue: undefined })
      )
    ).toBe('SETTLED');
    expect(
      resolveTontineDueState(
        baseTontine({ currentCyclePaymentStatus: 'PENDING', hasPaymentDue: undefined })
      )
    ).toBe('DUE');
  });

  it('falls back to legacy paymentStatus string when currentCyclePaymentStatus absent', () => {
    expect(
      resolveTontineDueState(
        baseTontine({
          currentCyclePaymentStatus: undefined,
          paymentStatus: 'PENDING',
        })
      )
    ).toBe('DUE');
  });
});

describe('pickMostUrgentTontineForDashboard', () => {
  it('priorise le retard sur une échéance future', () => {
    const now = new Date('2025-06-15T12:00:00');
    const a = baseTontine({
      uid: 'a',
      nextPaymentDate: '2025-06-20',
      hasPaymentDue: true,
    });
    const b = baseTontine({
      uid: 'b',
      nextPaymentDate: '2025-06-01',
      hasPaymentDue: true,
    });
    const pick = pickMostUrgentTontineForDashboard([a, b], now);
    expect(pick?.uid).toBe('b');
  });

  it('ignore une simple date planifiée quand la dette membre n est pas confirmée', () => {
    const now = new Date('2025-06-15T12:00:00');
    const scheduledOnly = baseTontine({
      uid: 'scheduled',
      hasPaymentDue: undefined,
      nextPaymentDate: undefined,
      currentCycleExpectedDate: '2025-06-16',
    });
    const due = baseTontine({
      uid: 'due',
      hasPaymentDue: true,
      nextPaymentDate: '2025-06-18',
    });

    const pick = pickMostUrgentTontineForDashboard([scheduledOnly, due], now);
    expect(pick?.uid).toBe('due');
  });
});
