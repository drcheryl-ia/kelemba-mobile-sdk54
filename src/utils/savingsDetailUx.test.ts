import { describe, expect, it } from 'vitest';
import { deriveSavingsDetailStatusKey } from '@/utils/savingsDetailUx';

describe('deriveSavingsDetailStatusKey', () => {
  it('priorise suspendu puis retard puis retrait', () => {
    expect(
      deriveSavingsDetailStatusKey({
        memberStatus: 'SUSPENDED',
        periodOpen: true,
        contributedThisPeriod: false,
        unlockReached: true,
      })
    ).toBe('SUSPENDED');

    expect(
      deriveSavingsDetailStatusKey({
        memberStatus: 'ACTIVE',
        periodOpen: true,
        contributedThisPeriod: false,
        unlockReached: false,
      })
    ).toBe('LATE');

    expect(
      deriveSavingsDetailStatusKey({
        memberStatus: 'ACTIVE',
        periodOpen: false,
        contributedThisPeriod: false,
        unlockReached: true,
      })
    ).toBe('WITHDRAW_AVAILABLE');
  });

  it('à jour sinon', () => {
    expect(
      deriveSavingsDetailStatusKey({
        memberStatus: 'ACTIVE',
        periodOpen: true,
        contributedThisPeriod: true,
        unlockReached: false,
      })
    ).toBe('UP_TO_DATE');
  });
});
