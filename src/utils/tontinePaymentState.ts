/**
 * État UI paiement / échéance pour une tontine liste — logique pure centralisée.
 * Ne jamais inférer « à jour » sans signal explicite du backend ou données cohérentes.
 */
import type { PaymentStatus } from '@/types/domain.types';
import type { TontineListItem } from '@/types/tontine';

function coerceListItemPaymentStatus(tontine: TontineListItem): PaymentStatus | null {
  if (tontine.currentCyclePaymentStatus != null) {
    return tontine.currentCyclePaymentStatus;
  }
  const ps = tontine.paymentStatus;
  if (ps == null || ps === '') return null;
  const allowed: PaymentStatus[] = [
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'REFUNDED',
  ];
  return allowed.includes(ps as PaymentStatus) ? (ps as PaymentStatus) : null;
}

export type PaymentUiStatus =
  | 'UP_TO_DATE'
  | 'DUE_SOON'
  | 'DUE_TODAY'
  | 'OVERDUE'
  | 'UNKNOWN';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'muted';
export type TontineDueState = 'DUE' | 'SETTLED' | 'PROCESSING' | 'UNKNOWN';

export interface ResolvedTontinePaymentContext {
  scheduledDate: string | null;
  displayScheduledDate: string | null;
  daysLeft: number | null;
  dueState: TontineDueState;
  amount: number;
  penaltyAmount: number;
  totalDue: number;
  showAmountBreakdown: boolean;
}

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

function scheduledOnlyState(
  raw: string,
  daysLeft: number | null,
  eligible: boolean
): TontinePaymentUiState {
  return {
    uiStatus: 'UNKNOWN',
    rawPaymentDate: raw.split('T')[0],
    displayDate: formatFrShortFromIso(raw),
    daysLeft,
    daysOverdue: null,
    badgeLabel: 'Date prevue',
    badgeTone: 'muted',
    eligibleForPaymentReminder: eligible,
    needsPaymentAttention: false,
  };
}

function processingState(
  raw: string | null,
  daysLeft: number | null,
  eligible: boolean
): TontinePaymentUiState {
  return {
    uiStatus: 'UNKNOWN',
    rawPaymentDate: raw ? raw.split('T')[0] : null,
    displayDate: raw ? formatFrShortFromIso(raw) : null,
    daysLeft,
    daysOverdue: null,
    badgeLabel: 'Paiement en cours',
    badgeTone: 'warning',
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

function normalizeDate(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  return String(value).split('T')[0];
}

/**
 * Date à afficher pour l’échéance (liste, badges, montants) — alignée backend.
 * - Dette en cours : `currentDueDate` puis `nextPaymentDate` puis date du cycle courant.
 * - À jour sur le cycle : `nextScheduledCycleDate` puis `nextDueDate` puis `nextPaymentDate`
 *   (ne pas réutiliser `currentCycleExpectedDate` comme « prochaine » une fois soldé).
 */
export function resolveDisplayPaymentDate(tontine: TontineListItem): string | null {
  const dueState = resolveTontineDueState(tontine);
  const currentDue = normalizeDate(tontine.currentDueDate);
  const nextScheduled = normalizeDate(tontine.nextScheduledCycleDate);
  const nextDue = normalizeDate(tontine.nextDueDate);
  const nextPayment = normalizeDate(tontine.nextPaymentDate);
  const cycleExpected = normalizeDate(tontine.currentCycleExpectedDate);

  if (dueState === 'DUE' || dueState === 'PROCESSING') {
    return currentDue ?? nextPayment ?? cycleExpected;
  }

  if (dueState === 'SETTLED') {
    return nextScheduled ?? nextDue ?? nextPayment ?? null;
  }

  if (tontine.hasPaymentDue === true) {
    return currentDue ?? nextPayment ?? cycleExpected;
  }
  if (tontine.hasPaymentDue === false) {
    return nextScheduled ?? nextDue ?? nextPayment ?? null;
  }

  return nextScheduled ?? nextDue ?? nextPayment ?? cycleExpected ?? null;
}

/** @deprecated Préférer `resolveDisplayPaymentDate` — alias conservé pour imports existants */
export function resolveScheduledPaymentDate(tontine: TontineListItem): string | null {
  return resolveDisplayPaymentDate(tontine);
}

/**
 * Échéance du cycle courant côté membre (détail tontine) — avant toute « prochaine » date future.
 */
export function resolveCurrentCycleMemberDueDate(tontine: TontineListItem): string | null {
  return (
    normalizeDate(tontine.currentDueDate) ??
    normalizeDate(tontine.nextPaymentDate) ??
    normalizeDate(tontine.currentCycleExpectedDate)
  );
}

export function resolveTontineDueState(tontine: TontineListItem): TontineDueState {
  const paymentStatus = coerceListItemPaymentStatus(tontine);

  if (paymentStatus === 'COMPLETED') return 'SETTLED';
  if (paymentStatus === 'PROCESSING') return 'PROCESSING';
  if (
    paymentStatus === 'PENDING' ||
    paymentStatus === 'FAILED' ||
    paymentStatus === 'REFUNDED'
  ) {
    return 'DUE';
  }
  if (tontine.hasPaymentDue === true) return 'DUE';
  if (tontine.hasPaymentDue === false) return 'SETTLED';
  return 'UNKNOWN';
}

export function resolveTontinePaymentContext(
  tontine: TontineListItem,
  now = new Date()
): ResolvedTontinePaymentContext {
  const scheduledDate = resolveScheduledPaymentDate(tontine);
  const dueTs = scheduledDate ? parseLocalDateOnly(scheduledDate) : null;
  const daysLeft =
    dueTs !== null ? calendarDaysBetween(dueTs, startOfLocalDay(now)) : null;
  const shares = tontine.userSharesCount ?? 1;
  const amount = tontine.amountPerShare * shares;
  const penaltyAmount =
    tontine.penaltyAmount != null && Number.isFinite(tontine.penaltyAmount)
      ? tontine.penaltyAmount
      : 0;
  const totalDue =
    tontine.totalAmountDue != null && Number.isFinite(tontine.totalAmountDue)
      ? tontine.totalAmountDue
      : amount + penaltyAmount;
  const dueState = resolveTontineDueState(tontine);

  return {
    scheduledDate,
    displayScheduledDate: scheduledDate ? formatFrShortFromIso(scheduledDate) : null,
    daysLeft,
    dueState,
    amount,
    penaltyAmount,
    totalDue,
    showAmountBreakdown: dueState === 'DUE',
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

  /** Rappels cotisation dashboard : réservés aux tontines rotatives */
  const reminderEligible = tontine.type !== 'EPARGNE';

  if (!eligibleBase) {
    return unknownState(false);
  }

  const payment = resolveTontinePaymentContext(tontine, now);

  if (payment.dueState === 'DUE') {
    if (payment.scheduledDate === null) {
      return {
        uiStatus: 'UNKNOWN',
        rawPaymentDate: null,
        displayDate: null,
        daysLeft: null,
        daysOverdue: null,
        badgeLabel: '⏳ À payer',
        badgeTone: 'warning',
        eligibleForPaymentReminder: reminderEligible,
        needsPaymentAttention: true,
      };
    }
    if ((payment.daysLeft ?? 0) < 0) {
      return overdueState(payment.scheduledDate, payment.daysLeft ?? 0, reminderEligible);
    }
    if (payment.daysLeft === 0) {
      return dueTodayState(payment.scheduledDate, reminderEligible);
    }
    return dueSoonState(payment.scheduledDate, payment.daysLeft ?? 0, reminderEligible);
  }

  if (payment.dueState === 'PROCESSING') {
    return processingState(payment.scheduledDate, payment.daysLeft, reminderEligible);
  }

  if (payment.dueState === 'SETTLED') {
    return upToDateState(payment.scheduledDate, payment.daysLeft, reminderEligible);
  }

  if (payment.scheduledDate) {
    return scheduledOnlyState(payment.scheduledDate, payment.daysLeft, reminderEligible);
  }

  return unknownState(reminderEligible);
}

export type TontineListDueDateHeadingKey = 'currentDue' | 'nextDue' | 'none';

/** Libellé carte liste : échéance à payer vs prochaine échéance future */
export function getTontineListDueDateHeadingKey(
  tontine: TontineListItem
): TontineListDueDateHeadingKey {
  const raw = resolveDisplayPaymentDate(tontine);
  if (raw == null) return 'none';
  const ui = deriveTontinePaymentUiState(tontine);
  if (ui.needsPaymentAttention) return 'currentDue';
  return 'nextDue';
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
  const payment = resolveTontinePaymentContext(tontine);
  return {
    amount: payment.amount,
    penaltyAmount: payment.penaltyAmount,
    totalDue: payment.totalDue,
  };
}
