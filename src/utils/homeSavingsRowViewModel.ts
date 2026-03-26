/**
 * Vue liste / accueil — tontine épargne (données TontineListItem + dérivés locaux testés).
 */
import type { TontineListItem } from '@/types/tontine';
import { deriveTontinePaymentUiState, resolveDisplayPaymentDate } from '@/utils/tontinePaymentState';
import { isUnlockReached } from '@/utils/savings.utils';

const MS_PER_DAY = 86_400_000;

export type SavingsHomeRowStatusKey = 'suspended' | 'unlocked' | 'late' | 'up_to_date';

export function computeDaysUntilDueIso(dueIso: string, now = new Date()): number {
  const parts = dueIso.split('T')[0].split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return 0;
  const [y, m, d] = parts;
  const dueLocal = new Date(y, m - 1, d);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((dueLocal.getTime() - todayStart.getTime()) / MS_PER_DAY);
}

export interface SavingsHomeRowVm {
  nextDueIso: string | null;
  unlockIso: string | null;
  minAmount: number;
  statusKey: SavingsHomeRowStatusKey;
  daysUntilDue: number | null;
}

/**
 * Statut et dates pour une ligne épargne (accueil, cartes dédiées).
 */
export function deriveSavingsHomeRowVm(item: TontineListItem, now = new Date()): SavingsHomeRowVm {
  const minAmount = item.amountPerShare;
  if (item.type !== 'EPARGNE') {
    return {
      nextDueIso: null,
      unlockIso: null,
      minAmount,
      statusKey: 'up_to_date',
      daysUntilDue: null,
    };
  }

  const nextDueIso = resolveDisplayPaymentDate(item);
  const unlockIso = item.savingsUnlockDate ?? null;
  const daysUntilDue =
    nextDueIso != null && nextDueIso !== '' ? computeDaysUntilDueIso(nextDueIso, now) : null;

  if (item.savingsMemberStatus === 'SUSPENDED') {
    return { nextDueIso, unlockIso, minAmount, statusKey: 'suspended', daysUntilDue };
  }

  if (item.savingsWithdrawalAvailable === true) {
    return { nextDueIso, unlockIso, minAmount, statusKey: 'unlocked', daysUntilDue };
  }

  if (unlockIso != null && unlockIso !== '' && isUnlockReached(unlockIso)) {
    return { nextDueIso, unlockIso, minAmount, statusKey: 'unlocked', daysUntilDue };
  }

  const ui = deriveTontinePaymentUiState(item, now);
  if (ui.uiStatus === 'OVERDUE') {
    return { nextDueIso, unlockIso, minAmount, statusKey: 'late', daysUntilDue };
  }

  return { nextDueIso, unlockIso, minAmount, statusKey: 'up_to_date', daysUntilDue };
}

export interface SavingsHomeAggregate {
  activeCount: number;
  totalSaved: number | null;
  soonestDueIso: string | null;
}

export function aggregateSavingsHomeSummary(items: TontineListItem[]): SavingsHomeAggregate {
  const ep = items.filter((t) => t.type === 'EPARGNE');
  let total = 0;
  let anySaved = false;
  for (const t of ep) {
    if (t.savingsTotalSaved != null && Number.isFinite(t.savingsTotalSaved)) {
      total += t.savingsTotalSaved;
      anySaved = true;
    }
  }
  let soonest: string | null = null;
  for (const t of ep) {
    const { nextDueIso } = deriveSavingsHomeRowVm(t);
    if (nextDueIso != null && nextDueIso !== '') {
      if (soonest == null || nextDueIso.localeCompare(soonest) < 0) {
        soonest = nextDueIso;
      }
    }
  }
  return {
    activeCount: ep.length,
    totalSaved: anySaved ? total : null,
    soonestDueIso: soonest,
  };
}
