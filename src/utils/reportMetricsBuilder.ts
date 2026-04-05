/**
 * Agrégation métriques rapport à partir des tontines et paiements (client).
 */
import type { ReportMetrics, ReportPeriod, TontineReportItem } from '@/types/report.types';
import type { PaymentHistoryItem } from '@/types/tontine';
import type { TontineListItem, TontineStatus } from '@/types/tontine';
import { paymentDateInRange, reportPeriodToRange } from '@/utils/reportPeriod';
import { freqLabel } from '@/utils/paymentUiLabels';

function mapStatus(s: TontineStatus): TontineReportItem['status'] {
  if (s === 'COMPLETED') return 'COMPLETED';
  if (s === 'DRAFT') return 'DRAFT';
  if (s === 'CANCELLED') return 'CANCELLED';
  return 'ACTIVE';
}

function isActiveMembership(t: TontineListItem): boolean {
  return t.membershipStatus === 'ACTIVE';
}

export function buildTontineReportItems(
  tontines: TontineListItem[],
  payments: PaymentHistoryItem[]
): TontineReportItem[] {
  const byTontine = new Map<string, PaymentHistoryItem[]>();
  for (const p of payments) {
    if (p.status !== 'COMPLETED') continue;
    const list = byTontine.get(p.tontineUid) ?? [];
    list.push(p);
    byTontine.set(p.tontineUid, list);
  }

  return tontines.map((t) => {
    const mine = byTontine.get(t.uid) ?? [];
    const totalPaidByUser = mine.reduce((s, p) => s + p.totalPaid, 0);
    const penaltiesCount = mine.filter((p) => p.penalty > 0).length;
    const onTime = mine.filter((p) => p.penalty === 0).length;
    const cyclesTotal = Math.max(mine.length, t.totalCycles ?? 0, 1);
    const punctualityRate =
      mine.length > 0 ? Math.round((onTime / mine.length) * 100) : 100;
    const cc = t.currentCycle ?? t.currentCycleNumber ?? 0;
    const ct = t.totalCycles ?? 0;

    return {
      tontineUid: t.uid,
      tontineName: t.name,
      status: mapStatus(t.status),
      isCreator: t.membershipRole === 'CREATOR' || t.isCreator === true,
      memberCount: t.activeMemberCount ?? 0,
      frequency: freqLabel(t.frequency),
      amountPerShare: t.amountPerShare,
      userSharesCount: t.userSharesCount ?? 1,
      totalPaidByUser,
      cyclesCurrent: cc,
      cyclesTotal: ct > 0 ? ct : Math.max(mine.length, 1),
      punctualityRate,
      penaltiesCount,
      myPayoutCycleNumber: t.myPayoutCycleNumber ?? null,
      totalReceivedAsBeneficiary: 0,
    };
  });
}

export function buildReportMetrics(
  tontines: TontineListItem[],
  allPayments: PaymentHistoryItem[],
  period: ReportPeriod
): ReportMetrics {
  const range = reportPeriodToRange(period);
  const completed = allPayments.filter((p) => p.status === 'COMPLETED');

  const totalPaidAllTime = completed.reduce((s, p) => s + p.totalPaid, 0);

  const inPeriod = completed.filter((p) => paymentDateInRange(p.paidAt, range));
  const paidThisPeriod = inPeriod.reduce((s, p) => s + p.totalPaid, 0);
  const contributionsExcludingPenalty = inPeriod.reduce((s, p) => s + p.amount, 0);
  const penaltiesPaid = inPeriod.reduce((s, p) => s + p.penalty, 0);

  const cyclesTotal = inPeriod.length;
  const cyclesOnTime = inPeriod.filter((p) => p.penalty === 0).length;
  const punctualityRate =
    cyclesTotal > 0 ? Math.round((cyclesOnTime / cyclesTotal) * 100) : 100;
  const lateCyclesCount = Math.max(0, cyclesTotal - cyclesOnTime);
  const lateDaysSum = lateCyclesCount * 5;

  const completedTontinesCount = tontines.filter((t) => t.status === 'COMPLETED').length;
  const activeTontinesCount = tontines.filter(
    (t) =>
      (t.status === 'ACTIVE' ||
        t.status === 'BETWEEN_ROUNDS' ||
        t.status === 'PAUSED') &&
      isActiveMembership(t)
  ).length;

  let nextPayoutAmount: number | null = null;
  let nextPayoutTontineName: string | null = null;
  let nextPayoutCycleNumber: number | null = null;
  for (const t of tontines) {
    if (!isActiveMembership(t)) continue;
    if (t.status !== 'ACTIVE' && t.status !== 'BETWEEN_ROUNDS' && t.status !== 'PAUSED')
      continue;
    if (t.isMyTurnNow === true || t.canTriggerPayout === true) {
      const amt =
        t.payoutNetAmount ??
        t.beneficiaryNetAmount ??
        (t.amountPerShare ?? 0) * (t.userSharesCount ?? 1);
      if (amt > 0) {
        nextPayoutAmount = Math.round(amt);
        nextPayoutTontineName = t.name;
        nextPayoutCycleNumber =
          t.currentCycleNumber ?? t.currentCycle ?? null;
        break;
      }
    }
  }

  return {
    totalPaidAllTime: Math.round(totalPaidAllTime),
    paidThisPeriod: Math.round(paidThisPeriod),
    penaltiesPaid: Math.round(penaltiesPaid),
    punctualityRate,
    cyclesOnTime,
    cyclesTotal,
    completedTontinesCount,
    activeTontinesCount,
    nextPayoutAmount,
    nextPayoutTontineName,
    nextPayoutCycleNumber,
    contributionsExcludingPenalty: Math.round(contributionsExcludingPenalty),
    totalReceivedAsBeneficiaryPeriod: 0,
    lateCyclesCount,
    lateDaysSum,
  };
}
