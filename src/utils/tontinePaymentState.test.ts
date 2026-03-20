import { describe, it, expect } from 'vitest';
import type { TontineListItem } from '@/types/tontine';
import {
  deriveTontinePaymentUiState,
  pickMostUrgentTontineForDashboard,
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

  it('nextPaymentDate passée + hasPaymentDue absent → En retard', () => {
    const now = new Date('2025-06-15T12:00:00');
    const s = deriveTontinePaymentUiState(
      baseTontine({
        hasPaymentDue: undefined,
        nextPaymentDate: '2025-06-10',
      }),
      now
    );
    expect(s.uiStatus).toBe('OVERDUE');
    expect(s.badgeLabel).toContain('En retard');
    expect(s.needsPaymentAttention).toBe(true);
  });

  it('nextPaymentDate future + hasPaymentDue absent → À payer', () => {
    const now = new Date('2025-06-15T12:00:00');
    const s = deriveTontinePaymentUiState(
      baseTontine({
        hasPaymentDue: undefined,
        nextPaymentDate: '2025-06-20',
      }),
      now
    );
    expect(s.uiStatus).toBe('DUE_SOON');
    expect(s.badgeLabel).toContain('À payer');
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
});
