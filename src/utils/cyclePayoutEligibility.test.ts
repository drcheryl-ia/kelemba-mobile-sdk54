import { describe, expect, it } from 'vitest';
import { canShowOrganizerPayoutCta, isCycleCollectionComplete } from './cyclePayoutEligibility';
import type { CurrentCycle } from '@/types/tontine';

function baseCycle(over: Partial<CurrentCycle> = {}): CurrentCycle {
  return {
    uid: 'c1',
    cycleNumber: 1,
    expectedDate: '2025-01-01',
    actualPayoutDate: null,
    totalAmount: 1000,
    delayedByMemberIds: [],
    status: 'ACTIVE',
    ...over,
  };
}

describe('isCycleCollectionComplete', () => {
  it('retourne true si collectionProgress >= 1', () => {
    expect(isCycleCollectionComplete(baseCycle({ collectionProgress: 1 }))).toBe(true);
    expect(isCycleCollectionComplete(baseCycle({ collectionProgress: 1.02 }))).toBe(true);
  });

  it('retourne true si collectedAmount >= totalExpected', () => {
    expect(
      isCycleCollectionComplete(
        baseCycle({ collectionProgress: undefined, totalExpected: 100, collectedAmount: 100 })
      )
    ).toBe(true);
  });

  it('retourne false si incomplet', () => {
    expect(
      isCycleCollectionComplete(
        baseCycle({ collectionProgress: 0.5, totalExpected: 100, collectedAmount: 50 })
      )
    ).toBe(false);
  });
});

describe('canShowOrganizerPayoutCta', () => {
  it('affiche le CTA pour organisateur + ACTIVE + collecte complète (sans completion API)', () => {
    expect(
      canShowOrganizerPayoutCta(
        true,
        baseCycle({ collectionProgress: 1 }),
        undefined
      )
    ).toBe(true);
  });

  it('masque pour non-organisateur', () => {
    expect(
      canShowOrganizerPayoutCta(false, baseCycle({ collectionProgress: 1 }), undefined)
    ).toBe(false);
  });

  it('masque si cycle incomplet', () => {
    expect(
      canShowOrganizerPayoutCta(true, baseCycle({ collectionProgress: 0.8 }), undefined)
    ).toBe(false);
  });

  it('respecte isComplete: false depuis completion', () => {
    expect(
      canShowOrganizerPayoutCta(true, baseCycle({ collectionProgress: 1 }), { isComplete: false, raw: {} })
    ).toBe(false);
  });

  it('respecte isComplete: true depuis completion', () => {
    expect(
      canShowOrganizerPayoutCta(true, baseCycle({ collectionProgress: 0.2 }), { isComplete: true, raw: {} })
    ).toBe(true);
  });

  it('masque si statut cycle !== ACTIVE', () => {
    expect(
      canShowOrganizerPayoutCta(true, baseCycle({ status: 'PAYOUT_IN_PROGRESS', collectionProgress: 1 }), undefined)
    ).toBe(false);
  });
});
