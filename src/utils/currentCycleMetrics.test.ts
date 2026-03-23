import { describe, expect, it } from 'vitest';
import type { CurrentCycle, TontineMember } from '@/types/tontine';
import { resolveCurrentCycleMetrics } from '@/utils/currentCycleMetrics';

function buildCycle(overrides: Partial<CurrentCycle> = {}): CurrentCycle {
  return {
    uid: 'cycle-1',
    cycleNumber: 1,
    expectedDate: '2026-03-21',
    actualPayoutDate: null,
    totalAmount: 40000,
    delayedByMemberIds: [],
    status: 'ACTIVE',
    beneficiaryMembershipUid: 'member-4',
    ...overrides,
  };
}

function buildMembers(): TontineMember[] {
  return [
    {
      uid: 'member-1',
      userUid: 'user-1',
      fullName: 'Member One',
      phone: '0001',
      sharesCount: 2,
      rotationOrder: 1,
      memberRole: 'MEMBER',
      membershipStatus: 'ACTIVE',
      kelembScore: 0,
      currentCyclePaymentStatus: 'PENDING',
      paidAmount: 0,
      signedAt: null,
    },
    {
      uid: 'member-2',
      userUid: 'user-2',
      fullName: 'Member Two',
      phone: '0002',
      sharesCount: 1,
      rotationOrder: 2,
      memberRole: 'MEMBER',
      membershipStatus: 'ACTIVE',
      kelembScore: 0,
      currentCyclePaymentStatus: 'PENDING',
      paidAmount: 0,
      signedAt: null,
    },
    {
      uid: 'member-3',
      userUid: 'user-3',
      fullName: 'Member Three',
      phone: '0003',
      sharesCount: 1,
      rotationOrder: 3,
      memberRole: 'MEMBER',
      membershipStatus: 'ACTIVE',
      kelembScore: 0,
      currentCyclePaymentStatus: 'PENDING',
      paidAmount: 0,
      signedAt: null,
    },
    {
      uid: 'member-4',
      userUid: 'user-4',
      fullName: 'Beneficiary',
      phone: '0004',
      sharesCount: 1,
      rotationOrder: 4,
      memberRole: 'MEMBER',
      membershipStatus: 'ACTIVE',
      kelembScore: 0,
      currentCyclePaymentStatus: 'PENDING',
      paidAmount: 0,
      signedAt: null,
    },
  ];
}

describe('resolveCurrentCycleMetrics', () => {
  it('returns 0 collected and 0 progress for a legacy cycle with no completed members', () => {
    const metrics = resolveCurrentCycleMetrics({
      currentCycle: buildCycle({ totalAmount: 40000 }),
      amountPerShare: 10000,
      members: buildMembers(),
    });

    expect(metrics.collected).toBe(0);
    expect(metrics.expected).toBe(50000);
    expect(metrics.progress).toBe(0);
    expect(metrics.beneficiaryNetAmount).toBe(40000);
  });

  it('uses enriched backend values when they are present', () => {
    const metrics = resolveCurrentCycleMetrics({
      currentCycle: buildCycle({
        collectedAmount: 0,
        totalExpected: 50000,
        collectionProgress: 0,
      }),
      amountPerShare: 10000,
      members: buildMembers(),
    });

    expect(metrics.collected).toBe(0);
    expect(metrics.expected).toBe(50000);
    expect(metrics.progress).toBe(0);
    expect(metrics.beneficiaryNetAmount).toBe(40000);
  });

  it('falls back to completed members when enriched collected amount is absent, including the beneficiary', () => {
    const members = buildMembers();
    members[0].currentCyclePaymentStatus = 'COMPLETED';
    members[1].currentCyclePaymentStatus = 'COMPLETED';
    members[3].currentCyclePaymentStatus = 'COMPLETED';
    members[2].currentCyclePaymentStatus = 'PROCESSING';

    const metrics = resolveCurrentCycleMetrics({
      currentCycle: buildCycle({ totalAmount: 90000 }),
      amountPerShare: 10000,
      members,
    });

    expect(metrics.collected).toBe(40000);
    expect(metrics.expected).toBe(50000);
    expect(metrics.progress).toBe(0.8);
    expect(metrics.beneficiaryNetAmount).toBe(40000);
  });

  it('bounds progress to 0 when expected is zero and backend progress is invalid', () => {
    const metrics = resolveCurrentCycleMetrics({
      currentCycle: buildCycle({
        totalAmount: 0,
        totalExpected: 0,
        collectionProgress: Number.NaN,
      }),
      amountPerShare: 10000,
      members: [],
    });

    expect(metrics.collected).toBe(0);
    expect(metrics.expected).toBe(0);
    expect(metrics.progress).toBe(0);
    expect(metrics.beneficiaryNetAmount).toBeNull();
  });

  it('uses the backend beneficiary net amount when it is provided', () => {
    const metrics = resolveCurrentCycleMetrics({
      currentCycle: buildCycle({
        collectedAmount: 25000,
        totalExpected: 50000,
        beneficiaryNetAmount: 37500,
      }),
      amountPerShare: 10000,
      members: buildMembers(),
    });

    expect(metrics.beneficiaryNetAmount).toBe(37500);
  });
});
