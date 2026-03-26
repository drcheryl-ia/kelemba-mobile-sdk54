import { describe, expect, it, vi, afterEach } from 'vitest';
import type { TontineListItem } from '@/types/tontine';
import {
  aggregateSavingsHomeSummary,
  computeDaysUntilDueIso,
  deriveSavingsHomeRowVm,
} from '@/utils/homeSavingsRowViewModel';

function baseEpargne(overrides: Partial<TontineListItem> = {}): TontineListItem {
  return {
    uid: 'e1',
    name: 'Épargne test',
    status: 'ACTIVE',
    type: 'EPARGNE',
    amountPerShare: 5000,
    frequency: 'MONTHLY',
    totalCycles: 0,
    currentCycle: null,
    membershipRole: 'MEMBER',
    membershipStatus: 'ACTIVE',
    ...overrides,
  };
}

describe('deriveSavingsHomeRowVm', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('retourne suspended si membre suspendu', () => {
    const vm = deriveSavingsHomeRowVm(
      baseEpargne({ savingsMemberStatus: 'SUSPENDED' }),
      new Date('2026-06-01')
    );
    expect(vm.statusKey).toBe('suspended');
  });

  it('retourne late si versement en retard (OVERDUE)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
    const vm = deriveSavingsHomeRowVm(
      baseEpargne({
        nextPaymentDate: '2026-06-01',
        hasPaymentDue: true,
      })
    );
    expect(vm.statusKey).toBe('late');
    vi.useRealTimers();
  });

  it('retourne unlocked si retrait disponible', () => {
    const vm = deriveSavingsHomeRowVm(
      baseEpargne({ savingsWithdrawalAvailable: true }),
      new Date('2026-06-01')
    );
    expect(vm.statusKey).toBe('unlocked');
  });

  it('retourne up_to_date si à jour', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
    const vm = deriveSavingsHomeRowVm(
      baseEpargne({
        nextPaymentDate: '2026-06-15',
        hasPaymentDue: false,
      })
    );
    expect(vm.statusKey).toBe('up_to_date');
    vi.useRealTimers();
  });
});

describe('computeDaysUntilDueIso', () => {
  it('calcule le décalage en jours calendaires', () => {
    const d = new Date('2026-03-20T12:00:00.000Z');
    expect(computeDaysUntilDueIso('2026-03-22', d)).toBe(2);
    expect(computeDaysUntilDueIso('2026-03-18', d)).toBe(-2);
  });
});

describe('aggregateSavingsHomeSummary', () => {
  it('agrège comptage, total épargné et échéance la plus proche', () => {
    const items: TontineListItem[] = [
      baseEpargne({
        uid: 'a',
        savingsTotalSaved: 10000,
        nextPaymentDate: '2026-08-01',
      }),
      baseEpargne({
        uid: 'b',
        savingsTotalSaved: 5000,
        nextPaymentDate: '2026-07-01',
      }),
    ];
    const agg = aggregateSavingsHomeSummary(items);
    expect(agg.activeCount).toBe(2);
    expect(agg.totalSaved).toBe(15000);
    expect(agg.soonestDueIso).toBe('2026-07-01');
  });

  it('totalSaved null si aucun solde renseigné', () => {
    const agg = aggregateSavingsHomeSummary([baseEpargne({ savingsTotalSaved: null })]);
    expect(agg.totalSaved).toBeNull();
  });
});
