/**
 * État UI paiement / échéance pour une tontine liste — logique pure centralisée.
 * Ne jamais inférer « à jour » sans signal explicite du backend ou données cohérentes.
 */
import type { TontineListItem } from '@/types/tontine';

export type PaymentUiStatus =
  | 'UP_TO_DATE'
  | 'DUE_SOON'
  | 'DUE_TODAY'
  | 'OVERDUE'
  | 'UNKNOWN';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'muted';

export interface TontinePaymentUiState {
  uiStatus: PaymentUiStatus;
  /** YYYY-MM-DD si connue */
  rawPaymentDate: string | null;
  /** Affichage court fr */
  displayDate: string | null;
  /** Différence calendaire (local) : négatif = retard */
  daysLeft: number | null;
  daysOverdue: number | null;
  badgeLabel: string;
  badgeTone: BadgeTone;
  /** Tontine éligible au rappel cotisation (ACTIVE / BETWEEN_ROUNDS, membre actif) */
  eligibleForPaymentReminder: boolean;
  /** Afficher accent paiement (badge / CTA) */
  needsPaymentAttention: boolean;
}

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Parse une date-only YYYY-MM-DD en minuit **local** (évite décalage fuseau sur la chaîne). */
export function parseLocalDateOnly(iso: string | null | undefined): number | null {
  if (iso == null || iso === '') return null;
  const ymd = String(iso).split('T')[0];
  const parts = ymd.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  if (y < 1970 || y > 2100) return null;
  return new Date(y, m - 1, d).getTime();
}

export function calendarDaysBetween(dueStart: number, todayStart: number): number {
  return Math.round((dueStart - todayStart) / 86_400_000);
}

export function formatFrShortFromIso(iso: string | null | undefined): string | null {
  if (iso == null || iso === '') return null;
  const ymd = String(iso).split('T')[0];
  const parts = ymd.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

function unknownState(eligible: boolean): TontinePaymentUiState {
  return {
    uiStatus: 'UNKNOWN',
    rawPaymentDate: null,
    displayDate: null,
    daysLeft: null,
    daysOverdue: null,
    badgeLabel: '… Statut indisponible',
    badgeTone: 'muted',
    eligibleForPaymentReminder: eligible,
    needsPaymentAttention: false,
  };
}

function overdueState(
  raw: string,
  daysLeft: number,
  eligible: boolean
): TontinePaymentUiState {
  const overdue = Math.max(0, -daysLeft);
  return {
    uiStatus: 'OVERDUE',
    rawPaymentDate: raw.split('T')[0],
    displayDate: formatFrShortFromIso(raw),
    daysLeft,
    daysOverdue: overdue,
    badgeLabel: '⚠ En retard',
    badgeTone: 'danger',
    eligibleForPaymentReminder: eligible,
    needsPaymentAttention: true,
  };
}

function dueTodayState(raw: string, eligible: boolean): TontinePaymentUiState {
  return {
    uiStatus: 'DUE_TODAY',
    rawPaymentDate: raw.split('T')[0],
    displayDate: formatFrShortFromIso(raw),
    daysLeft: 0,
    daysOverdue: 0,
    badgeLabel: '📅 Aujourd\'hui',
    badgeTone: 'warning',
    eligibleForPaymentReminder: eligible,
    needsPaymentAttention: true,
  };
}

function dueSoonState(raw: string, daysLeft: number, eligible: boolean): TontinePaymentUiState {
  return {
    uiStatus: 'DUE_SOON',
    rawPaymentDate: raw.split('T')[0],
    displayDate: formatFrShortFromIso(raw),
    daysLeft,
    daysOverdue: 0,
    badgeLabel: '⏳ À payer',
    badgeTone: 'warning',
    eligibleForPaymentReminder: eligible,
    needsPaymentAttention: true,
  };
}

function upToDateState(raw: string | null, daysLeft: number | null, eligible: boolean): TontinePaymentUiState {
  return {
    uiStatus: 'UP_TO_DATE',
    rawPaymentDate: raw ? raw.split('T')[0] : null,
    displayDate: raw ? formatFrShortFromIso(raw) : null,
    daysLeft,
    daysOverdue: 0,
    badgeLabel: '✓ À jour',
    badgeTone: 'success',
    eligibleForPaymentReminder: eligible,
    needsPaymentAttention: false,
  };
}

/**
 * Dérive l'état d'affichage paiement / échéance pour une ligne tontine (liste / dashboard).
 */
export function deriveTontinePaymentUiState(
  tontine: TontineListItem,
  now = new Date()
): TontinePaymentUiState {
  const eligibleBase =
    (tontine.status === 'ACTIVE' || tontine.status === 'BETWEEN_ROUNDS') &&
    tontine.membershipStatus !== 'PENDING';

  if (!eligibleBase) {
    return unknownState(false);
  }

  const todayTs = startOfLocalDay(now);
  const rawDate =
    tontine.nextPaymentDate === undefined
      ? undefined
      : tontine.nextPaymentDate === null || tontine.nextPaymentDate === ''
        ? null
        : String(tontine.nextPaymentDate).split('T')[0];

  const dueTs =
    rawDate != null && rawDate !== '' ? parseLocalDateOnly(rawDate) : null;
  const daysLeft =
    dueTs !== null ? calendarDaysBetween(dueTs, todayTs) : null;

  const hasDue = tontine.hasPaymentDue;
  const explicitTrue = hasDue === true;
  const explicitFalse = hasDue === false;
  const dueUnknown = hasDue === undefined;

  // 2 — hasPaymentDue === true
  if (explicitTrue) {
    if (dueTs === null) {
      return {
        uiStatus: 'UNKNOWN',
        rawPaymentDate: null,
        displayDate: null,
        daysLeft: null,
        daysOverdue: null,
        badgeLabel: '⏳ À payer',
        badgeTone: 'warning',
        eligibleForPaymentReminder: true,
        needsPaymentAttention: true,
      };
    }
    if (daysLeft! < 0) return overdueState(rawDate!, daysLeft!, true);
    if (daysLeft === 0) return dueTodayState(rawDate!, true);
    return dueSoonState(rawDate!, daysLeft!, true);
  }

  // 3 — hasPaymentDue === false : à jour seulement si signal explicite
  if (explicitFalse) {
    const noDate = rawDate === undefined || rawDate === null || rawDate === '';
    if (noDate) {
      return upToDateState(null, null, true);
    }
    // Date présente mais backend dit à jour : si date passée, priorité sécurité → retard
    if (daysLeft !== null && daysLeft < 0) {
      return overdueState(rawDate!, daysLeft, true);
    }
    return upToDateState(rawDate!, daysLeft, true);
  }

  // 4 — hasPaymentDue absent, date présente
  if (dueUnknown && dueTs !== null && rawDate) {
    if (daysLeft! < 0) return overdueState(rawDate, daysLeft!, true);
    if (daysLeft === 0) return dueTodayState(rawDate, true);
    return dueSoonState(rawDate, daysLeft!, true);
  }

  // 5 — aucune donnée fiable
  return unknownState(true);
}

/** Tontine la plus urgente pour bannière dashboard (parmi items déjà filtrés « officiels »). */
export function pickMostUrgentTontineForDashboard(
  tontines: TontineListItem[],
  now = new Date()
): TontineListItem | null {
  const scored = tontines
    .map((t) => ({ t, s: deriveTontinePaymentUiState(t, now) }))
    .filter(
      ({ s }) =>
        s.uiStatus === 'OVERDUE' ||
        s.uiStatus === 'DUE_TODAY' ||
        s.uiStatus === 'DUE_SOON'
    );
  if (scored.length === 0) return null;

  const rank = (u: PaymentUiStatus) =>
    u === 'OVERDUE' ? 0 : u === 'DUE_TODAY' ? 1 : 2;

  scored.sort((a, b) => {
    const ra = rank(a.s.uiStatus);
    const rb = rank(b.s.uiStatus);
    if (ra !== rb) return ra - rb;
    if (a.s.uiStatus === 'OVERDUE' && b.s.uiStatus === 'OVERDUE') {
      return (b.s.daysOverdue ?? 0) - (a.s.daysOverdue ?? 0);
    }
    return (a.s.daysLeft ?? 999) - (b.s.daysLeft ?? 999);
  });

  return scored[0].t;
}

export type DashboardBannerReminderKind = 'OVERDUE' | 'TODAY' | 'SOON';

export function reminderHeadlineFr(kind: DashboardBannerReminderKind): string {
  switch (kind) {
    case 'OVERDUE':
      return 'Versement en retard';
    case 'TODAY':
      return 'Versement aujourd\'hui';
    default:
      return 'Versement à venir';
  }
}

/** Construit montants fallback pour la bannière à partir d'une TontineListItem. */
export function resolveAmountsForListItem(tontine: TontineListItem): {
  amount: number;
  penaltyAmount: number;
  totalDue: number;
} {
  const shares = tontine.userSharesCount ?? 1;
  const base = tontine.amountPerShare * shares;
  const penalty = tontine.penaltyAmount ?? 0;
  const total =
    tontine.totalAmountDue != null && Number.isFinite(tontine.totalAmountDue)
      ? tontine.totalAmountDue
      : base + penalty;
  return {
    amount: base,
    penaltyAmount: penalty,
    totalDue: total,
  };
}
