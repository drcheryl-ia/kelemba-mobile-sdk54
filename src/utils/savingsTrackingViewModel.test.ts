import { describe, expect, it } from 'vitest';
import type { MyBalanceResponse } from '@/types/savings.types';
import type { TontineListItem, TontineReportSummary } from '@/types/tontine';
import {
  buildSavingsTrackingGlobalTotals,
  countRotativeBeneficiaryTurns,
  estimatedBonusDeltaFromBalance,
  filterByTrackingRole,
  isOrganizerInTontine,
  isParticipatingTontineRow,
  splitEpargneRotative,
} from './savingsTrackingViewModel';

function baseItem(over: Partial<TontineListItem>): TontineListItem {
  return {
    uid: 'u1',
    name: 'T1',
    status: 'ACTIVE',
    amountPerShare: 1000,
    frequency: 'MONTHLY',
    totalCycles: 12,
    currentCycle: 1,
    membershipRole: 'MEMBER',
    membershipStatus: 'ACTIVE',
    ...over,
  } as TontineListItem;
}

describe('savingsTrackingViewModel', () => {
  it('isParticipatingTontineRow exclut invitation en attente', () => {
    expect(isParticipatingTontineRow(baseItem({ membershipStatus: 'PENDING' }))).toBe(false);
    expect(isParticipatingTontineRow(baseItem({ isPending: true }))).toBe(false);
    expect(isParticipatingTontineRow(baseItem({ membershipStatus: 'ACTIVE' }))).toBe(true);
  });

  it('filterByTrackingRole membre vs organisateur sans doublon logique', () => {
    const items = [
      baseItem({ uid: 'a', membershipRole: 'CREATOR', isCreator: true }),
      baseItem({ uid: 'b', membershipRole: 'MEMBER' }),
    ];
    expect(filterByTrackingRole(items, 'all')).toHaveLength(2);
    expect(filterByTrackingRole(items, 'organizer').map((t) => t.uid)).toEqual(['a']);
    expect(filterByTrackingRole(items, 'member').map((t) => t.uid)).toEqual(['b']);
  });

  it('splitEpargneRotative ne mélange pas les types', () => {
    const { epargne, rotative } = splitEpargneRotative([
      baseItem({ uid: 'e', type: 'EPARGNE' }),
      baseItem({ uid: 'r', type: 'ROTATIVE' }),
    ]);
    expect(epargne).toHaveLength(1);
    expect(rotative).toHaveLength(1);
  });

  it('isOrganizerInTontine', () => {
    expect(isOrganizerInTontine(baseItem({ isCreator: true }))).toBe(true);
    expect(isOrganizerInTontine(baseItem({ membershipRole: 'CREATOR' }))).toBe(true);
    expect(isOrganizerInTontine(baseItem({ membershipRole: 'MEMBER' }))).toBe(false);
  });

  it('estimatedBonusDeltaFromBalance retourne null si pas de surplus projeté', () => {
    const b: MyBalanceResponse = {
      personalBalance: 0,
      totalContributed: 10000,
      isBonusEligible: true,
      missedPeriodsCount: 0,
      periodsRemaining: 2,
      estimatedFinalBalance: 9000,
      currentPeriod: null,
      contributionThisPeriod: null,
    };
    expect(estimatedBonusDeltaFromBalance(b)).toBeNull();
  });

  it('buildSavingsTrackingGlobalTotals agrège sans doubler les UIDs', () => {
    const items = [
      baseItem({ uid: 'e1', type: 'EPARGNE', penaltyAmount: 100 }),
      baseItem({ uid: 'r1', type: 'ROTATIVE', penaltyAmount: 50 }),
    ];
    const bal: MyBalanceResponse = {
      personalBalance: 5000,
      totalContributed: 4000,
      isBonusEligible: true,
      missedPeriodsCount: 0,
      periodsRemaining: 1,
      estimatedFinalBalance: 4500,
      currentPeriod: null,
      contributionThisPeriod: null,
    };
    const totals = buildSavingsTrackingGlobalTotals({
      filteredItems: items,
      balanceByEpargneUid: { e1: bal },
      rotativePayoutCounts: { r1: 2 },
    });
    expect(totals.totalPenaltiesFromList).toBe(150);
    expect(totals.activeEpargneCount).toBe(1);
    expect(totals.activeRotativeCount).toBe(1);
    expect(totals.rotativePayoutTurnsTotal).toBe(2);
  });

  it('countRotativeBeneficiaryTurns compte les cycles terminés', () => {
    const report: TontineReportSummary = {
      tontineUid: 't',
      cycles: [
        { cycleNumber: 1, expectedDate: '2024-01-01', status: 'COMPLETED', beneficiaryUid: 'me' },
        { cycleNumber: 2, expectedDate: '2024-02-01', status: 'ACTIVE', beneficiaryUid: 'me' },
        { cycleNumber: 3, expectedDate: '2024-03-01', status: 'COMPLETED', beneficiaryUid: 'other' },
      ],
    };
    expect(countRotativeBeneficiaryTurns(report, 'me')).toBe(1);
  });
});
