import type { CurrentCycle } from '@/types/tontine';

function optionalFiniteNumber(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function optionalStringDate(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  return String(v).split('T')[0];
}

function optionalStringArray(v: unknown): string[] | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (!Array.isArray(v)) return undefined;
  return v.map((item) => String(item));
}

export function normalizeCurrentCycle(raw: Record<string, unknown>): CurrentCycle {
  return {
    uid: String(raw.uid ?? ''),
    cycleNumber: Number(raw.cycleNumber ?? 0),
    expectedDate: optionalStringDate(raw.expectedDate) ?? '',
    actualPayoutDate: optionalStringDate(raw.actualPayoutDate) ?? null,
    totalAmount:
      optionalFiniteNumber(raw.totalAmount ?? raw.totalExpected ?? raw.collectedAmount) ?? 0,
    collectedAmount: optionalFiniteNumber(raw.collectedAmount),
    totalExpected: optionalFiniteNumber(raw.totalExpected),
    collectionProgress: optionalFiniteNumber(raw.collectionProgress),
    delayedByMemberIds:
      optionalStringArray(raw.delayedByMemberIds ?? raw.delayedByMemberUids) ?? null,
    status: (raw.status ?? 'PENDING') as CurrentCycle['status'],
    beneficiaryMembershipUid:
      raw.beneficiaryMembershipUid != null
        ? String(raw.beneficiaryMembershipUid)
        : null,
  };
}
