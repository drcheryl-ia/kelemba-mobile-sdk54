import { describe, expect, it } from 'vitest';
import type { TontineListItem } from '@/types/tontine';
import {
  buildTontineOverviewStats,
  getPrimaryActionKind,
  getTontinePriority,
  sortTontinesForList,
} from './tontineListViewModel';

function makeItem(overrides: Partial<TontineListItem>): TontineListItem {
  return {
    uid: 't-1',
    name: 'Alpha',
    status: 'ACTIVE',
    type: 'ROTATIVE',
    amountPerShare: 10000,
    frequency: 'MONTHLY',
    totalCycles: 12,
    currentCycle: 2,
    membershipRole: 'MEMBER',
    membershipStatus: 'ACTIVE',
    hasPaymentDue: false,
    nextPaymentDate: '2026-03-30',
    ...overrides,
  };
}

describe('getTontinePriority', () => {
  it('keeps pending before draft before active', () => {
    const pending = makeItem({ membershipStatus: 'PENDING', status: 'ACTIVE' });
    const draft = makeItem({ uid: 't-2', status: 'DRAFT', membershipStatus: 'ACTIVE' });
    const activeDue = makeItem({ uid: 't-3', hasPaymentDue: true, paymentStatus: 'PENDING' });
    const activeClean = makeItem({ uid: 't-4', hasPaymentDue: false, paymentStatus: 'COMPLETED' });

    expect(getTontinePriority(pending)).toBeLessThan(getTontinePriority(draft));
    expect(getTontinePriority(draft)).toBeLessThan(getTontinePriority(activeDue));
    expect(getTontinePriority(activeDue)).toBeLessThan(getTontinePriority(activeClean));
  });
});

describe('getPrimaryActionKind', () => {
  it('returns pragmatic CTA kinds from real statuses', () => {
    expect(getPrimaryActionKind(makeItem({ status: 'DRAFT' }))).toBe('FINALIZE');
    expect(
      getPrimaryActionKind(
        makeItem({
          status: 'ACTIVE',
          membershipRole: 'MEMBER',
          hasPaymentDue: true,
          paymentStatus: 'PENDING',
        })
      )
    ).toBe('PAY');
    expect(
      getPrimaryActionKind(
        makeItem({
          membershipRole: 'CREATOR',
          isCreator: true,
          status: 'ACTIVE',
        })
      )
    ).toBe('MANAGE');
    expect(
      getPrimaryActionKind(
        makeItem({
          membershipStatus: 'PENDING',
          invitationOrigin: 'INVITE',
        })
      )
    ).toBe('RESPOND');
  });

  it('ne propose pas NEW_ROTATION pour une tontine EPARGNE (organisateur)', () => {
    expect(
      getPrimaryActionKind(
        makeItem({
          type: 'EPARGNE',
          status: 'BETWEEN_ROUNDS',
          membershipRole: 'CREATOR',
          isCreator: true,
        })
      )
    ).toBe('MANAGE');
  });
});

describe('sortTontinesForList', () => {
  it('sorts by priority before due date', () => {
    const items = [
      makeItem({ uid: 't-1', name: 'Stable', hasPaymentDue: false, paymentStatus: 'COMPLETED' }),
      makeItem({ uid: 't-2', name: 'Draft', status: 'DRAFT', membershipStatus: 'ACTIVE' }),
      makeItem({ uid: 't-3', name: 'Pending', membershipStatus: 'PENDING' }),
      makeItem({ uid: 't-4', name: 'Due', hasPaymentDue: true, paymentStatus: 'PENDING' }),
    ];

    const result = sortTontinesForList(items, 'priority');

    expect(result.map((item) => item.uid)).toEqual(['t-3', 't-2', 't-4', 't-1']);
  });
});

describe('buildTontineOverviewStats', () => {
  it('computes active, draft, and pending action counters from loaded data', () => {
    const stats = buildTontineOverviewStats([
      makeItem({ status: 'ACTIVE', hasPaymentDue: true, paymentStatus: 'PENDING' }),
      makeItem({ uid: 't-2', status: 'BETWEEN_ROUNDS' }),
      makeItem({ uid: 't-3', status: 'DRAFT' }),
      makeItem({ uid: 't-4', membershipStatus: 'PENDING' }),
    ]);

    expect(stats).toEqual({
      activeCount: 2,
      draftCount: 1,
      pendingActionsCount: 3,
    });
  });
});
