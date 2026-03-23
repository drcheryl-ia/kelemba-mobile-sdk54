import type { CurrentCycle, TontineMember } from '@/types/tontine';

export interface ResolveCurrentCycleMetricsInput {
  currentCycle: CurrentCycle | null;
  amountPerShare: number;
  members: TontineMember[];
}

export interface CurrentCycleMetrics {
  collected: number;
  expected: number;
  progress: number;
  beneficiaryNetAmount: number | null;
}

function clampToPositiveFinite(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function resolveLegacyCollectedAmount(
  members: TontineMember[],
  amountPerShare: number
): number {
  return members.reduce((sum, member) => {
    if (member.currentCyclePaymentStatus !== 'COMPLETED') return sum;
    return sum + amountPerShare * member.sharesCount;
  }, 0);
}

function resolveLegacyExpectedAmount(
  members: TontineMember[],
  amountPerShare: number
): number {
  const payingShares = members.reduce((sum, member) => sum + member.sharesCount, 0);
  return amountPerShare * payingShares;
}

function resolveBeneficiaryNetAmount(
  currentCycle: CurrentCycle,
  members: TontineMember[],
  amountPerShare: number,
  expected: number
): number | null {
  const backendValue = clampToPositiveFinite(currentCycle.beneficiaryNetAmount);
  if (backendValue != null) return backendValue;

  if (expected <= 0 || !currentCycle.beneficiaryMembershipUid) return null;

  const beneficiaryMember = members.find(
    (member) => member.uid === currentCycle.beneficiaryMembershipUid
  );
  if (!beneficiaryMember) return null;

  const beneficiaryContribution = amountPerShare * beneficiaryMember.sharesCount;
  return Math.max(0, expected - beneficiaryContribution);
}

export function resolveCurrentCycleMetrics({
  currentCycle,
  amountPerShare,
  members,
}: ResolveCurrentCycleMetricsInput): CurrentCycleMetrics {
  if (!currentCycle) {
    return {
      collected: 0,
      expected: 0,
      progress: 0,
      beneficiaryNetAmount: null,
    };
  }

  const collected =
    clampToPositiveFinite(currentCycle.collectedAmount) ??
    resolveLegacyCollectedAmount(members, amountPerShare);

  const expected =
    clampToPositiveFinite(currentCycle.totalExpected) ??
    resolveLegacyExpectedAmount(members, amountPerShare);

  const backendProgress = clampToPositiveFinite(currentCycle.collectionProgress);
  const progress =
    backendProgress != null
      ? clampProgress(backendProgress)
      : expected > 0
        ? clampProgress(collected / expected)
        : 0;
  const beneficiaryNetAmount = resolveBeneficiaryNetAmount(
    currentCycle,
    members,
    amountPerShare,
    expected
  );

  return {
    collected,
    expected,
    progress,
    beneficiaryNetAmount,
  };
}
