import type { ReportPeriod } from '@/types/report.types';

/** Premier instant de la période (mois / trimestre civil / année) — `null` si tout l’historique. */
export function getPeriodStartDate(period: ReportPeriod): Date | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (period === 'all') return null;
  if (period === 'current_month') return new Date(y, m, 1);
  if (period === 'quarter') return new Date(y, Math.floor(m / 3) * 3, 1);
  if (period === 'year') return new Date(y, 0, 1);
  return null;
}

export interface DateRange {
  from: Date;
  to: Date;
}

/** Plage calendaire [from, to] pour filtrer les paiements (paidAt). */
export function reportPeriodToRange(period: ReportPeriod): DateRange | null {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  if (period === 'all') return null;
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  if (period === 'current_month') {
    from.setDate(1);
    return { from, to };
  }
  if (period === 'quarter') {
    from.setMonth(from.getMonth() - 3);
    return { from, to };
  }
  if (period === 'year') {
    from.setMonth(0, 1);
    return { from, to };
  }
  return null;
}

export function paymentDateInRange(
  paidAt: string | null,
  range: DateRange | null
): boolean {
  if (range == null) return true;
  if (paidAt == null || paidAt === '') return false;
  const t = Date.parse(paidAt);
  if (Number.isNaN(t)) return false;
  return t >= range.from.getTime() && t <= range.to.getTime();
}
