import type { TontineListItem } from '@/types/tontine';
import { deriveTontinePaymentUiState } from '@/utils/tontinePaymentState';

function isActiveStatus(s: TontineListItem['status']): boolean {
  return s === 'ACTIVE' || s === 'BETWEEN_ROUNDS';
}

export function computeActiveCount(tontines: TontineListItem[]): number {
  return tontines.filter((t) => isActiveStatus(t.status)).length;
}

/** Somme des engagements (parts × montant) pour les tontines ACTIVE. */
export function computeTotalEngagedThisMonth(tontines: TontineListItem[]): number {
  let sum = 0;
  for (const t of tontines) {
    if (!isActiveStatus(t.status)) continue;
    const shares = Math.max(1, t.userSharesCount ?? 1);
    const per = t.amountPerShare ?? 0;
    if (Number.isFinite(per)) sum += per * shares;
  }
  return Math.round(sum);
}

/**
 * Parmi les ACTIVE avec `myPayoutCycleNumber` défini, retourne le libellé du cycle
 * dont le numéro est le plus proche du cycle courant.
 */
export function computeNextBeneficiaryCycleLabel(
  tontines: TontineListItem[]
): string | null {
  let best: { diff: number; cycle: number } | null = null;

  for (const t of tontines) {
    if (!isActiveStatus(t.status)) continue;
    const mine = t.myPayoutCycleNumber;
    if (mine == null || !Number.isFinite(mine)) continue;

    const cur =
      t.currentCycleNumber ?? t.currentCycle ?? 0;
    const diff = Math.abs(mine - cur);

    if (best == null || diff < best.diff) {
      best = { diff, cycle: mine };
    }
  }

  return best == null ? null : `Cycle ${best.cycle}`;
}

export interface WorstOverduePick {
  tontineUid: string;
  tontineName: string;
  daysLate: number;
}

/**
 * Si au moins une tontine ACTIVE est en retard de cotisation, retourne celle
 * avec le retard maximal (`daysLate` max).
 */
export function computeWorstOverdueTontine(
  tontines: TontineListItem[]
): WorstOverduePick | null {
  let best: WorstOverduePick | null = null;

  for (const t of tontines) {
    /** Bandeau retard : uniquement statut ACTIVE (spec liste). */
    if (t.status !== 'ACTIVE') continue;
    const ui = deriveTontinePaymentUiState(t);
    if (ui.uiStatus !== 'OVERDUE') continue;

    const rawLate = ui.daysOverdue ?? t.daysOverdue ?? 0;
    const daysLate = Math.max(0, Math.round(Number(rawLate)));

    if (best == null || daysLate > best.daysLate) {
      best = {
        tontineUid: t.uid,
        tontineName: t.name,
        daysLate,
      };
    }
  }

  return best;
}
