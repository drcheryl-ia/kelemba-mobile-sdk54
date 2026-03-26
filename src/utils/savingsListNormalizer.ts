/**
 * Normalisation des réponses GET /v1/savings (liste) vers TontineListItem unifié.
 */
import type { TontineFrequency } from '@/api/types/api.types';
import type { SavingsMemberStatus } from '@/types/savings.types';
import type { TontineListItem, TontineStatus } from '@/types/tontine';

const SAVINGS_MEMBER: SavingsMemberStatus[] = [
  'ACTIVE',
  'SUSPENDED',
  'WITHDRAWN',
  'EXCLUDED',
];

function parseSavingsMemberStatus(raw: unknown): SavingsMemberStatus | null {
  if (typeof raw !== 'string') return null;
  return SAVINGS_MEMBER.includes(raw as SavingsMemberStatus)
    ? (raw as SavingsMemberStatus)
    : null;
}

function nestedRecord(raw: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const v = raw[key];
  if (v && typeof v === 'object' && v !== null && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

function optionalNumber(v: unknown): number | null | undefined {
  if (v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

const ALLOWED_STATUS: TontineStatus[] = [
  'DRAFT',
  'ACTIVE',
  'BETWEEN_ROUNDS',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
];

const ALLOWED_FREQ: TontineFrequency[] = [
  'DAILY',
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
];

function optionalString(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v);
  return s === '' ? undefined : s;
}

function optionalIsoDate(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  return String(v).split('T')[0];
}

function parseStatus(raw: unknown): TontineStatus {
  const s = typeof raw === 'string' ? raw : '';
  return ALLOWED_STATUS.includes(s as TontineStatus) ? (s as TontineStatus) : 'PAUSED';
}

function parseFrequency(raw: unknown): TontineFrequency {
  const s = typeof raw === 'string' ? raw : '';
  return ALLOWED_FREQ.includes(s as TontineFrequency)
    ? (s as TontineFrequency)
    : 'MONTHLY';
}

function optionalBool(v: unknown): boolean | undefined {
  if (v === true || v === false) return v;
  return undefined;
}

/**
 * Extrait le tableau d’éléments depuis la réponse liste GET /v1/savings.
 */
export function parseSavingsListPayload(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null);
  }
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    const nested =
      o.savings ??
      o.data ??
      o.tontines ??
      o.items ??
      o.results;
    if (Array.isArray(nested)) {
      return nested.filter(
        (x): x is Record<string, unknown> => typeof x === 'object' && x !== null
      );
    }
  }
  return [];
}

function parseLocalDayStartMs(isoYmd: string): number | null {
  const part = isoYmd.split('T')[0];
  const parts = part.split('-').map(Number);
  if (parts.length < 3) return null;
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt.getTime();
}

/**
 * Dérive prochaine échéance / cotisation depuis une période épargne embarquée (si présente).
 * Exportée pour tests — ne pas appeler hors normalisation liste si possible.
 */
export function deriveSavingsPaymentHints(
  raw: Record<string, unknown>,
  now = new Date()
): {
  nextPaymentDate: string | null | undefined;
  hasPaymentDue: boolean | undefined;
} {
  const currentPeriod = raw.currentPeriod;
  if (currentPeriod && typeof currentPeriod === 'object' && currentPeriod !== null) {
    const p = currentPeriod as Record<string, unknown>;
    const st = typeof p.status === 'string' ? p.status : '';
    const close = optionalIsoDate(p.closeDate);
    const contributed =
      p.hasContributedThisPeriod === true ||
      p.contributedThisPeriod === true ||
      raw.hasContributedThisPeriod === true;

    if (st === 'OPEN' && close != null) {
      const closeMs = parseLocalDayStartMs(close);
      const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      if (closeMs != null && closeMs < todayMs && !contributed) {
        return {
          nextPaymentDate: close,
          hasPaymentDue: true,
        };
      }
      return {
        nextPaymentDate: close,
        hasPaymentDue: contributed ? false : true,
      };
    }

    if (st === 'OPEN' && close == null) {
      const nextDue = optionalIsoDate(
        raw.nextPaymentDate ?? raw.memberNextDueDate ?? raw.nextContributionDueDate
      );
      if (nextDue !== undefined && nextDue !== null) {
        return {
          nextPaymentDate: nextDue,
          hasPaymentDue: optionalBool(raw.hasPaymentDue) ?? true,
        };
      }
    }
  }

  const nextDue = optionalIsoDate(
    raw.nextPaymentDate ?? raw.memberNextDueDate ?? raw.nextContributionDueDate
  );
  if (nextDue !== undefined && nextDue !== null) {
    return {
      nextPaymentDate: nextDue,
      hasPaymentDue: optionalBool(raw.hasPaymentDue) ?? false,
    };
  }

  return {
    nextPaymentDate: null,
    hasPaymentDue: false,
  };
}

/**
 * Liste brute → TontineListItem (type EPARGNE, pas de cycle rotatif).
 */
export function normalizeSavingsListItem(raw: Record<string, unknown>): TontineListItem {
  const uid = String(raw.uid ?? raw.tontineUid ?? '');
  const name = String(raw.name ?? raw.tontineName ?? '');
  const status = parseStatus(raw.tontineStatus ?? raw.status);
  const frequency = parseFrequency(raw.frequency);
  const amountPerShare = Number(
    raw.amountPerShare ?? raw.minimumContribution ?? raw.minContribution ?? 0
  );
  const totalCycles = Number.isFinite(Number(raw.totalCycles)) ? Number(raw.totalCycles) : 0;

  const membershipRole =
    raw.isCreator === true ||
    raw.userRole === 'CREATOR' ||
    raw.membershipRole === 'CREATOR'
      ? ('CREATOR' as const)
      : ('MEMBER' as const);

  const membershipStatus =
    typeof raw.membershipStatus === 'string' &&
    (raw.membershipStatus === 'PENDING' ||
      raw.membershipStatus === 'ACTIVE' ||
      raw.membershipStatus === 'LEFT' ||
      raw.membershipStatus === 'EXPELLED')
      ? (raw.membershipStatus as TontineListItem['membershipStatus'])
      : 'ACTIVE';

  const hints = deriveSavingsPaymentHints(raw);
  const cp = nestedRecord(raw, 'currentPeriod');
  const savingsCurrentPeriodUid =
    typeof cp?.uid === 'string' && cp.uid.length > 0 ? cp.uid : null;

  const savingsCfg = nestedRecord(raw, 'savingsConfig');
  const tontineNested = nestedRecord(raw, 'tontine');

  const savingsUnlockDate =
    optionalIsoDate(
      raw.unlockDate ??
        savingsCfg?.unlockDate ??
        tontineNested?.unlockDate ??
        raw.tontineUnlockDate
    ) ?? null;

  const totalRaw =
    optionalNumber(raw.personalBalance) ??
    optionalNumber(raw.totalContributed) ??
    optionalNumber(raw.myBalance) ??
    optionalNumber(raw.totalSaved);
  const savingsTotalSaved =
    totalRaw !== undefined && totalRaw !== null ? totalRaw : null;

  const savingsMemberStatus = parseSavingsMemberStatus(
    raw.memberStatus ?? raw.savingsMemberStatus
  );

  let savingsWithdrawalAvailable: boolean | null | undefined;
  if (raw.withdrawalAvailable === true || raw.withdrawalAvailable === false) {
    savingsWithdrawalAvailable = raw.withdrawalAvailable;
  } else if (raw.canWithdraw === true || raw.canWithdraw === false) {
    savingsWithdrawalAvailable = raw.canWithdraw;
  } else {
    savingsWithdrawalAvailable = undefined;
  }

  return {
    uid,
    name,
    status,
    type: 'EPARGNE',
    amountPerShare: Number.isFinite(amountPerShare) ? amountPerShare : 0,
    frequency,
    totalCycles,
    currentCycle: null,
    membershipRole,
    membershipStatus,
    hasPaymentDue: hints.hasPaymentDue,
    nextPaymentDate: hints.nextPaymentDate,
    currentDueDate: undefined,
    nextDueDate: undefined,
    nextScheduledCycleDate: undefined,
    currentCycleExpectedDate: undefined,
    currentCyclePaymentStatus: null,
    isCreator: membershipRole === 'CREATOR',
    canInvite: optionalBool(raw.canInvite) ?? false,
    startDate: optionalString(raw.startDate ?? raw.startedAt),
    activeMemberCount:
      typeof raw.memberCount === 'number'
        ? raw.memberCount
        : typeof raw.activeMemberCount === 'number'
          ? raw.activeMemberCount
          : undefined,
    organizerName: optionalString(raw.organizerName ?? raw.creatorName),
    savingsUnlockDate,
    savingsTotalSaved,
    savingsMemberStatus,
    savingsWithdrawalAvailable:
      savingsWithdrawalAvailable === undefined ? undefined : savingsWithdrawalAvailable,
    savingsCurrentPeriodUid,
  };
}

export function statusRankForUnifiedSort(status: TontineStatus): number {
  if (status === 'ACTIVE' || status === 'BETWEEN_ROUNDS') return 0;
  if (status === 'DRAFT') return 1;
  if (status === 'PAUSED') return 2;
  return 3;
}

/**
 * Fusionne listes rotative + épargne : les rotatives priment en cas de même uid.
 */
export function mergeUnifiedTontines(
  rotative: TontineListItem[],
  savings: TontineListItem[]
): TontineListItem[] {
  const byUid = new Map<string, TontineListItem>();
  for (const t of rotative) {
    if (t.uid) byUid.set(t.uid, t);
  }
  for (const t of savings) {
    if (!t.uid) continue;
    if (!byUid.has(t.uid)) {
      byUid.set(t.uid, t);
    }
  }
  const merged = [...byUid.values()];
  merged.sort((a, b) => {
    const ra = statusRankForUnifiedSort(a.status);
    const rb = statusRankForUnifiedSort(b.status);
    if (ra !== rb) return ra - rb;
    const da = a.startDate ?? '';
    const db = b.startDate ?? '';
    if (da !== db) return db.localeCompare(da);
    return a.name.localeCompare(b.name, 'fr-FR');
  });
  return merged;
}
