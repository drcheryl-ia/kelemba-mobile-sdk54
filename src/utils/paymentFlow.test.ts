import { describe, expect, it } from 'vitest';
import type { TontineMember } from '@/types/tontine';
import {
  getCashMethodSublabel,
  getCashSelectionInfoText,
  getCashSummaryInfoText,
  getTontineCreatorName,
  isTontineCreatorMember,
  resolvePaymentSubmissionMode,
  shouldAutoApproveCreatorCash,
} from '@/utils/paymentFlow';

function buildMembers(): TontineMember[] {
  return [
    {
      uid: 'member-1',
      userUid: 'user-1',
      fullName: 'Organisateur Demo',
      phone: '0001',
      sharesCount: 1,
      rotationOrder: 1,
      memberRole: 'CREATOR',
      membershipStatus: 'ACTIVE',
      kelembScore: 0,
      currentCyclePaymentStatus: 'PENDING',
      paidAmount: 0,
      signedAt: null,
    },
    {
      uid: 'member-2',
      userUid: 'user-2',
      fullName: 'Membre Demo',
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
  ];
}

describe('paymentFlow', () => {
  it('resolves creator self-cash separately from member cash and mobile money', () => {
    expect(resolvePaymentSubmissionMode('CASH', true)).toBe('CASH_CREATOR');
    expect(resolvePaymentSubmissionMode('CASH', false)).toBe('CASH_MEMBER');
    expect(resolvePaymentSubmissionMode('ORANGE_MONEY', true)).toBe('MOBILE_MONEY');
    expect(resolvePaymentSubmissionMode('TELECEL_MONEY', false)).toBe('MOBILE_MONEY');
  });

  it('derives creator membership and creator name from tontine members', () => {
    const members = buildMembers();

    expect(isTontineCreatorMember(members, 'user-1')).toBe(true);
    expect(isTontineCreatorMember(members, 'user-2')).toBe(false);
    expect(getTontineCreatorName(members)).toBe('Organisateur Demo');
  });

  it('returns creator-specific cash copy', () => {
    expect(getCashMethodSublabel(true)).toContain('Auto-confirmation');
    expect(getCashSelectionInfoText(true)).toContain('auto-validera');
    expect(getCashSummaryInfoText('10 000 FCFA', true)).toContain('complété immédiatement');
  });

  it('returns member cash copy that preserves organizer validation flow', () => {
    expect(getCashMethodSublabel(false)).toContain("organisateur");
    expect(getCashSelectionInfoText(false)).toContain('preuve');
    expect(getCashSummaryInfoText('10 000 FCFA', false)).toContain('validation');
  });

  it('requests creator auto-approval until cash is fully completed with no pending validation', () => {
    expect(
      shouldAutoApproveCreatorCash({
        status: 'PENDING',
        validationRequestUid: 'validation-1',
      })
    ).toBe(true);
    expect(
      shouldAutoApproveCreatorCash({
        status: 'PENDING',
        validationRequestUid: null,
      })
    ).toBe(true);
    expect(
      shouldAutoApproveCreatorCash({
        status: 'COMPLETED',
        validationRequestUid: 'validation-1',
      })
    ).toBe(true);
    expect(
      shouldAutoApproveCreatorCash({
        status: 'COMPLETED',
        validationRequestUid: null,
      })
    ).toBe(false);
  });
});
