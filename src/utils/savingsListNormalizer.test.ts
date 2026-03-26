import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  mergeUnifiedTontines,
  normalizeSavingsListItem,
  parseSavingsListPayload,
  deriveSavingsPaymentHints,
} from '@/utils/savingsListNormalizer';
import type { TontineListItem } from '@/types/tontine';

describe('normalizeSavingsListItem', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mappe une ligne épargne vers TontineListItem (type EPARGNE, sans cycle rotatif)', () => {
    const raw = {
      uid: 's1',
      name: 'Cagnotte A',
      status: 'ACTIVE',
      frequency: 'MONTHLY',
      minimumContribution: 5000,
      startDate: '2025-01-10',
      isCreator: true,
      membershipStatus: 'ACTIVE',
    };
    const item = normalizeSavingsListItem(raw);
    expect(item.type).toBe('EPARGNE');
    expect(item.uid).toBe('s1');
    expect(item.name).toBe('Cagnotte A');
    expect(item.status).toBe('ACTIVE');
    expect(item.frequency).toBe('MONTHLY');
    expect(item.amountPerShare).toBe(5000);
    expect(item.currentCycle).toBeNull();
    expect(item.totalCycles).toBe(0);
    expect(item.membershipRole).toBe('CREATOR');
    expect(item.nextPaymentDate).toBeNull();
    expect(item.hasPaymentDue).toBe(false);
  });

  it('déduit échéance depuis currentPeriod OPEN', () => {
    const raw = {
      uid: 's2',
      name: 'B',
      status: 'ACTIVE',
      frequency: 'WEEKLY',
      minimumContribution: 1000,
      currentPeriod: {
        status: 'OPEN',
        closeDate: '2026-04-01T00:00:00.000Z',
      },
    };
    const item = normalizeSavingsListItem(raw);
    expect(item.nextPaymentDate).toBe('2026-04-01');
    expect(item.hasPaymentDue).toBe(true);
  });

  it('parseSavingsListPayload accepte tableau ou enveloppe { savings: [] }', () => {
    expect(parseSavingsListPayload([{ uid: 'a' }])).toEqual([{ uid: 'a' }]);
    expect(parseSavingsListPayload({ savings: [{ uid: 'b' }] })).toEqual([{ uid: 'b' }]);
    expect(parseSavingsListPayload({ data: [{ uid: 'c' }] })).toEqual([{ uid: 'c' }]);
  });

  it('OPEN avec close dépassée et non contribué → dette et date close', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T12:00:00.000Z'));
    const raw = {
      uid: 'late1',
      name: 'Late',
      status: 'ACTIVE',
      frequency: 'MONTHLY',
      minimumContribution: 1000,
      currentPeriod: {
        status: 'OPEN',
        closeDate: '2026-03-10',
      },
      hasContributedThisPeriod: false,
    };
    const hints = deriveSavingsPaymentHints(raw);
    expect(hints.hasPaymentDue).toBe(true);
    expect(hints.nextPaymentDate).toBe('2026-03-10');
    const item = normalizeSavingsListItem(raw);
    expect(item.hasPaymentDue).toBe(true);
    expect(item.nextPaymentDate).toBe('2026-03-10');
    vi.useRealTimers();
  });

  it('expose déblocage, épargne et statut membre si présents dans la liste', () => {
    const raw = {
      uid: 's3',
      name: 'C',
      status: 'ACTIVE',
      frequency: 'MONTHLY',
      minimumContribution: 2000,
      unlockDate: '2027-12-31',
      personalBalance: 15000,
      memberStatus: 'ACTIVE',
      withdrawalAvailable: false,
    };
    const item = normalizeSavingsListItem(raw);
    expect(item.savingsUnlockDate).toBe('2027-12-31');
    expect(item.savingsTotalSaved).toBe(15000);
    expect(item.savingsMemberStatus).toBe('ACTIVE');
    expect(item.savingsWithdrawalAvailable).toBe(false);
  });
});

describe('mergeUnifiedTontines', () => {
  const rotA: TontineListItem = {
    uid: 'r1',
    name: 'Rot',
    status: 'ACTIVE',
    type: 'ROTATIVE',
    amountPerShare: 100,
    frequency: 'MONTHLY',
    totalCycles: 12,
    currentCycle: 1,
    membershipRole: 'MEMBER',
    membershipStatus: 'ACTIVE',
  };

  const savB: TontineListItem = {
    uid: 'e1',
    name: 'Épargne',
    status: 'ACTIVE',
    type: 'EPARGNE',
    amountPerShare: 500,
    frequency: 'MONTHLY',
    totalCycles: 0,
    currentCycle: null,
    membershipRole: 'MEMBER',
    membershipStatus: 'ACTIVE',
  };

  it('concatène ROTATIVE + EPARGNE et déduplique par uid (rotative prioritaire)', () => {
    const dupSav: TontineListItem = { ...savB, uid: 'r1', name: 'Doublon' };
    const merged = mergeUnifiedTontines([rotA], [dupSav, savB]);
    expect(merged.map((t) => t.uid).sort()).toEqual(['e1', 'r1']);
    expect(merged.find((t) => t.uid === 'r1')?.name).toBe('Rot');
  });

  it('liste uniquement rotative : inchangé fonctionnellement (un seul flux)', () => {
    const merged = mergeUnifiedTontines([rotA], []);
    expect(merged).toHaveLength(1);
    expect(merged[0].type).toBe('ROTATIVE');
  });
});
