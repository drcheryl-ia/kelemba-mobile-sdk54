import { describe, expect, it } from 'vitest';
import { normalizeCurrentCycle } from '@/utils/currentCycleNormalizer';

describe('normalizeCurrentCycle', () => {
  it('maps enriched cycle metrics and delayedByMemberUids into the canonical shape', () => {
    const cycle = normalizeCurrentCycle({
      uid: 'cycle-1',
      cycleNumber: 1,
      expectedDate: '2026-03-21T00:00:00.000Z',
      actualPayoutDate: null,
      totalAmount: 50000,
      collectedAmount: 0,
      totalExpected: 50000,
      collectionProgress: 0,
      delayedByMemberUids: ['user-1'],
      status: 'ACTIVE',
      beneficiaryMembershipUid: 'member-8',
    });

    expect(cycle.expectedDate).toBe('2026-03-21');
    expect(cycle.collectedAmount).toBe(0);
    expect(cycle.totalExpected).toBe(50000);
    expect(cycle.collectionProgress).toBe(0);
    expect(cycle.delayedByMemberIds).toEqual(['user-1']);
    expect(cycle.beneficiaryMembershipUid).toBe('member-8');
  });

  it('keeps legacy totalAmount for compatibility when enriched metrics are absent', () => {
    const cycle = normalizeCurrentCycle({
      uid: 'cycle-legacy',
      cycleNumber: 2,
      expectedDate: '2026-04-21',
      actualPayoutDate: null,
      totalAmount: 40000,
      status: 'ACTIVE',
    });

    expect(cycle.totalAmount).toBe(40000);
    expect(cycle.collectedAmount).toBeUndefined();
    expect(cycle.totalExpected).toBeUndefined();
    expect(cycle.collectionProgress).toBeUndefined();
    expect(cycle.delayedByMemberIds).toBeNull();
  });
});
