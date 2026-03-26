import type { NextPaymentData } from '@/types/payment';
import type { PaymentHistoryItem, TontineListItem } from '@/types/tontine';
import {
  resolveDashboardOrganizerPayoutReminder,
  type DashboardOrganizerPayoutPhase,
} from '@/utils/cyclePayoutEligibility';
import {
  computeDaysUntilDueIso,
  deriveSavingsHomeRowVm,
} from '@/utils/homeSavingsRowViewModel';

export type DashboardReminderKind =
  | 'pendingValidation'
  | 'payoutPot'
  | 'nextPayment'
  | 'savingsPeriod';

export interface DashboardReminderCardVm {
  key: string;
  kind: DashboardReminderKind;
  tontineUid: string;
  tontineName: string;
  amount: number;
  cycleUid?: string;
  cycleNumber?: number;
  dueDate?: string;
  createdAt?: string;
  status?: PaymentHistoryItem['status'];
  /** Versement cagnotte (organisateur) — référence liste pour navigation */
  payoutPhase?: DashboardOrganizerPayoutPhase;
  organizerPayoutSource?: TontineListItem;
  /** Versement épargne — période courante si connue */
  periodUid?: string;
}

function getReminderTime(value: string | null | undefined): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function isPendingCashValidationReminder(item: PaymentHistoryItem): boolean {
  return (
    item.method === 'CASH' &&
    (item.status === 'PENDING' || item.status === 'PROCESSING') &&
    item.cashAutoValidated !== true
  );
}

export interface BuildDashboardReminderCardsOptions {
  /** Tontines où `resolveDashboardOrganizerPayoutReminder` est non nul (organisateur). */
  organizerPayoutTontines?: TontineListItem[];
  /** Tontines épargne actives — rappels J-2…J et retard (fenêtre vs `deriveSavingsHomeRowVm`). */
  savingsTontines?: TontineListItem[];
  limit?: number;
}

/**
 * Rappels période épargne : échéance dans ≤2 jours ou en retard (priorité aux plus urgents).
 */
export function buildSavingsReminderCandidates(
  items: TontineListItem[],
  now = new Date(),
  max = 4
): DashboardReminderCardVm[] {
  const ep = items.filter(
    (t) =>
      t.type === 'EPARGNE' &&
      t.membershipStatus !== 'PENDING' &&
      t.status !== 'DRAFT'
  );
  const scored: {
    t: TontineListItem;
    due: string;
    days: number;
  }[] = [];

  for (const t of ep) {
    const vm = deriveSavingsHomeRowVm(t, now);
    if (vm.statusKey === 'suspended' || vm.statusKey === 'unlocked') continue;
    const due = vm.nextDueIso;
    if (due == null || due === '') continue;
    const days = computeDaysUntilDueIso(due, now);
    if (days > 2) continue;
    scored.push({ t, due, days });
  }

  scored.sort((a, b) => {
    if (a.days < 0 && b.days >= 0) return -1;
    if (a.days >= 0 && b.days < 0) return 1;
    return a.days - b.days;
  });

  const out: DashboardReminderCardVm[] = [];
  for (const s of scored) {
    if (out.length >= max) break;
    const periodUid = s.t.savingsCurrentPeriodUid ?? undefined;
    out.push({
      key: `savings-${s.t.uid}-${s.due}`,
      kind: 'savingsPeriod',
      tontineUid: s.t.uid,
      tontineName: s.t.name,
      amount: s.t.amountPerShare,
      dueDate: s.due,
      periodUid,
    });
  }
  return out;
}

function sortOrganizerPayoutTontines(items: TontineListItem[]): TontineListItem[] {
  return [...items].sort((a, b) => {
    const pa = resolveDashboardOrganizerPayoutReminder(a);
    const pb = resolveDashboardOrganizerPayoutReminder(b);
    if (pa === 'ready' && pb !== 'ready') return -1;
    if (pa !== 'ready' && pb === 'ready') return 1;
    return a.name.localeCompare(b.name, 'fr');
  });
}

export function buildDashboardReminderCards(
  nextPayment: NextPaymentData | null,
  historyItems: PaymentHistoryItem[],
  options?: BuildDashboardReminderCardsOptions | number
): DashboardReminderCardVm[] {
  const opts: BuildDashboardReminderCardsOptions =
    typeof options === 'number' ? { limit: options } : (options ?? {});
  const limit = opts.limit ?? 2;
  const organizerPayoutTontines = opts.organizerPayoutTontines ?? [];
  const savingsTontines = opts.savingsTontines ?? [];

  const cards: DashboardReminderCardVm[] = [];
  const usedTontines = new Set<string>();

  const pendingValidationCandidates = [...historyItems]
    .filter(isPendingCashValidationReminder)
    .sort(
      (a, b) =>
        getReminderTime(b.createdAt ?? b.paidAt ?? null) -
        getReminderTime(a.createdAt ?? a.paidAt ?? null)
    );

  for (const item of pendingValidationCandidates) {
    if (!item.tontineUid || usedTontines.has(item.tontineUid)) continue;
    cards.push({
      key: `pending-${item.uid}`,
      kind: 'pendingValidation',
      tontineUid: item.tontineUid,
      tontineName: item.tontineName,
      amount: item.totalPaid,
      cycleUid: item.cycleUid,
      cycleNumber: item.cycleNumber,
      createdAt: item.createdAt ?? item.paidAt ?? undefined,
      status: item.status,
    });
    usedTontines.add(item.tontineUid);
    if (cards.length >= limit) return cards;
  }

  const payoutSorted = sortOrganizerPayoutTontines(organizerPayoutTontines);
  for (const t of payoutSorted) {
    if (!t.uid || usedTontines.has(t.uid)) continue;
    const phase = resolveDashboardOrganizerPayoutReminder(t);
    if (!phase || t.currentCycleUid == null) continue;
    const net =
      t.payoutNetAmount ??
      t.beneficiaryNetAmount ??
      t.amountPerShare ??
      0;
    cards.push({
      key: `payout-${t.uid}-${t.currentCycleUid}`,
      kind: 'payoutPot',
      tontineUid: t.uid,
      tontineName: t.name,
      amount: net,
      cycleUid: t.currentCycleUid,
      cycleNumber: t.currentCycleNumber ?? t.currentCycle ?? undefined,
      payoutPhase: phase,
      organizerPayoutSource: t,
    });
    usedTontines.add(t.uid);
    if (cards.length >= limit) return cards;
  }

  const savingsCandidates = buildSavingsReminderCandidates(savingsTontines, new Date(), limit);
  for (const s of savingsCandidates) {
    if (!s.tontineUid || usedTontines.has(s.tontineUid)) continue;
    cards.push(s);
    usedTontines.add(s.tontineUid);
    if (cards.length >= limit) return cards;
  }

  if (nextPayment && !usedTontines.has(nextPayment.tontineUid) && cards.length < limit) {
    cards.push({
      key: `next-${nextPayment.cycleUid}`,
      kind: 'nextPayment',
      tontineUid: nextPayment.tontineUid,
      tontineName: nextPayment.tontineName,
      amount: nextPayment.totalDue,
      cycleUid: nextPayment.cycleUid,
      cycleNumber: nextPayment.cycleNumber,
      dueDate: nextPayment.dueDate,
      status: nextPayment.paymentStatus,
    });
  }

  return cards;
}
