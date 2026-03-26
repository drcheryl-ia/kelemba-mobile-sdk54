import { describe, expect, it } from 'vitest';
import type { TontineRotationResponse } from '@/types/rotation';
import {
  allUserBeneficiaryPayoutsReceived,
  deriveHomePayoutFromRotation,
  memberHasPendingBeneficiaryPayout,
} from '@/utils/homePayoutScheduleFromRotation';

function baseResponse(
  cycles: TontineRotationResponse['cycles'],
  currentCycleNumber = 1
): TontineRotationResponse {
  return {
    tontineUid: 't-1',
    tontineName: 'Test',
    totalAmount: 100,
    currentCycleNumber,
    totalCycles: 4,
    memberCount: 2,
    cycles,
  };
}

describe('deriveHomePayoutFromRotation', () => {
  it('retourne null si aucun cycle bénéficiaire pour l’utilisateur', () => {
    const r = baseResponse([
      {
        uid: 'c1',
        cycleNumber: 1,
        beneficiaryUid: 'other',
        beneficiaryName: 'X',
        expectedDate: '2026-04-01',
        actualPayoutDate: null,
        collectedAmount: 0,
        totalExpected: 100,
        status: 'PENDING',
        displayStatus: 'PROCHAIN',
        delayedByMemberUids: [],
        isCurrentUserBeneficiary: false,
      },
    ]);
    expect(deriveHomePayoutFromRotation(r)).toBeNull();
  });

  it('parts multiples : un tour versé et un à venir → prochain tour', () => {
    const r = baseResponse([
      {
        uid: 'c1',
        cycleNumber: 1,
        beneficiaryUid: 'me',
        beneficiaryName: 'Moi',
        expectedDate: '2026-01-01',
        actualPayoutDate: '2026-01-02',
        collectedAmount: 100,
        totalExpected: 100,
        status: 'PAYOUT_COMPLETED',
        displayStatus: 'VERSÉ',
        delayedByMemberUids: [],
        isCurrentUserBeneficiary: true,
      },
      {
        uid: 'c3',
        cycleNumber: 3,
        beneficiaryUid: 'me',
        beneficiaryName: 'Moi',
        expectedDate: '2026-06-01',
        actualPayoutDate: null,
        collectedAmount: 0,
        totalExpected: 100,
        status: 'PENDING',
        displayStatus: 'À_VENIR',
        delayedByMemberUids: [],
        isCurrentUserBeneficiary: true,
      },
    ]);
    const d = deriveHomePayoutFromRotation(r);
    expect(d?.kind).toBe('next_beneficiary_turn');
    if (d?.kind === 'next_beneficiary_turn') {
      expect(d.expectedDateIso).toBe('2026-06-01');
      expect(d.beneficiaryCycleNumber).toBe(3);
      expect(d.isMyTurnNow).toBe(false);
    }
  });

  it('tous les tours bénéficiaires versés → all_beneficiary_turns_done', () => {
    const r = baseResponse([
      {
        uid: 'c1',
        cycleNumber: 1,
        beneficiaryUid: 'me',
        beneficiaryName: 'Moi',
        expectedDate: '2026-01-01',
        actualPayoutDate: '2026-01-02',
        collectedAmount: 100,
        totalExpected: 100,
        status: 'PAYOUT_COMPLETED',
        displayStatus: 'VERSÉ',
        delayedByMemberUids: [],
        isCurrentUserBeneficiary: true,
      },
      {
        uid: 'c2',
        cycleNumber: 2,
        beneficiaryUid: 'me',
        beneficiaryName: 'Moi',
        expectedDate: '2026-02-01',
        actualPayoutDate: '2026-02-02',
        collectedAmount: 100,
        totalExpected: 100,
        status: 'COMPLETED',
        displayStatus: 'VERSÉ',
        delayedByMemberUids: [],
        isCurrentUserBeneficiary: true,
      },
    ]);
    expect(deriveHomePayoutFromRotation(r)).toEqual({
      kind: 'all_beneficiary_turns_done',
    });
  });

  it('tour en cours bénéficiaire → isMyTurnNow', () => {
    const r = baseResponse(
      [
        {
          uid: 'c2',
          cycleNumber: 2,
          beneficiaryUid: 'me',
          beneficiaryName: 'Moi',
          expectedDate: '2026-03-10',
          actualPayoutDate: null,
          collectedAmount: 50,
          totalExpected: 100,
          status: 'ACTIVE',
          displayStatus: 'EN_COURS',
          delayedByMemberUids: [],
          isCurrentUserBeneficiary: true,
        },
      ],
      2
    );
    const d = deriveHomePayoutFromRotation(r);
    expect(d?.kind).toBe('next_beneficiary_turn');
    if (d?.kind === 'next_beneficiary_turn') {
      expect(d.isMyTurnNow).toBe(true);
    }
  });
});

describe('allUserBeneficiaryPayoutsReceived', () => {
  it('false si aucun cycle bénéficiaire', () => {
    expect(
      allUserBeneficiaryPayoutsReceived([
        {
          isCurrentUserBeneficiary: false,
          displayStatus: 'À_VENIR',
          status: 'PENDING',
        },
      ])
    ).toBe(false);
  });

  it('false si un seul tour versé mais un autre bénéficiaire encore à venir (parts multiples)', () => {
    expect(
      allUserBeneficiaryPayoutsReceived([
        {
          isCurrentUserBeneficiary: true,
          displayStatus: 'VERSÉ',
          status: 'PAYOUT_COMPLETED',
        },
        {
          isCurrentUserBeneficiary: true,
          displayStatus: 'À_VENIR',
          status: 'PENDING',
        },
      ])
    ).toBe(false);
  });

  it('true si un tour bénéficiaire unique est versé (une part)', () => {
    expect(
      allUserBeneficiaryPayoutsReceived([
        {
          isCurrentUserBeneficiary: true,
          displayStatus: 'VERSÉ',
          status: 'PAYOUT_COMPLETED',
        },
      ])
    ).toBe(true);
  });

  it('true si tous les tours bénéficiaires sont versés (plusieurs parts)', () => {
    expect(
      allUserBeneficiaryPayoutsReceived([
        {
          isCurrentUserBeneficiary: true,
          displayStatus: 'VERSÉ',
          status: 'PAYOUT_COMPLETED',
        },
        {
          isCurrentUserBeneficiary: true,
          displayStatus: 'VERSÉ',
          status: 'COMPLETED',
        },
      ])
    ).toBe(true);
  });
});

describe('memberHasPendingBeneficiaryPayout', () => {
  it('true si aucun cycle bénéficiaire pour ce membre dans la réponse', () => {
    expect(
      memberHasPendingBeneficiaryPayout('alice', [
        {
          beneficiaryUid: 'bob',
          displayStatus: 'À_VENIR',
          status: 'PENDING',
        },
      ])
    ).toBe(true);
  });

  it('true si au moins un tour bénéficiaire non versé', () => {
    expect(
      memberHasPendingBeneficiaryPayout('alice', [
        {
          beneficiaryUid: 'alice',
          displayStatus: 'VERSÉ',
          status: 'PAYOUT_COMPLETED',
        },
        {
          beneficiaryUid: 'alice',
          displayStatus: 'À_VENIR',
          status: 'PENDING',
        },
      ])
    ).toBe(true);
  });

  it('false si tous les tours bénéficiaires sont versés', () => {
    expect(
      memberHasPendingBeneficiaryPayout('alice', [
        {
          beneficiaryUid: 'alice',
          displayStatus: 'VERSÉ',
          status: 'PAYOUT_COMPLETED',
        },
      ])
    ).toBe(false);
  });
});
