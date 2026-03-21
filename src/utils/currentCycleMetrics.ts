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
  currentCycle: CurrentCycle,
  members: TontineMember[],
  amountPerShare: number
): number {
  const beneficiaryMembershipUid = currentCycle.beneficiaryMembershipUid;
  const payingShares = members.reduce((sum, member) => {
    if (beneficiaryMembershipUid && member.uid === beneficiaryMembershipUid) {
      return sum;
    }
    return sum + member.sharesCount;
  }, 0);

  return amountPerShare * payingShares;
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
    };
  }

  const collected =
    clampToPositiveFinite(currentCycle.collectedAmount) ??
    resolveLegacyCollectedAmount(members, amountPerShare);

  const expected =
    clampToPositiveFinite(currentCycle.totalExpected) ??
    resolveLegacyExpectedAmount(currentCycle, members, amountPerShare);

  const backendProgress = clampToPositiveFinite(currentCycle.collectionProgress);
  const progress =
    backendProgress != null
      ? clampProgress(backendProgress)
      : expected > 0
        ? clampProgress(collected / expected)
        : 0;

  return {
    collected,
    expected,
    progress,
  };
}
