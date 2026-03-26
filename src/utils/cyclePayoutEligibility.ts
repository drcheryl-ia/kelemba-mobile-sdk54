/**
 * Éligibilité versement cagnotte (organisateur) — sans inventer d’état : s’appuie sur le cycle courant
 * et éventuellement sur GET /cycles/:uid/completion.
 */
import type { CurrentCycle, TontineListItem } from '@/types/tontine';
import type { CycleCompletionInfo } from '@/types/cyclePayout';

function clampProgress(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

/** Collecte effectivement complète d’après les champs cycle (source backend). */
export function isCycleCollectionComplete(cycle: CurrentCycle): boolean {
  const p = cycle.collectionProgress;
  if (p != null && Number.isFinite(Number(p))) {
    return clampProgress(Number(p)) >= 1;
  }
  const te = cycle.totalExpected ?? cycle.totalAmount;
  const ca = cycle.collectedAmount;
  if (te != null && te > 0 && ca != null && Number.isFinite(ca)) {
    return ca >= te;
  }
  return false;
}

/**
 * Bouton « Payer la cagnotte » : organisateur, cycle actif versement pas encore engagé,
 * collecte complète (completion API si dispo, sinon métriques cycle).
 */
export function canShowOrganizerPayoutCta(
  isOrganizer: boolean,
  cycle: CurrentCycle | null,
  completion: CycleCompletionInfo | undefined
): boolean {
  if (!isOrganizer || cycle == null) return false;
  if (cycle.status !== 'ACTIVE') return false;
  if (completion?.isComplete !== undefined) {
    return completion.isComplete === true;
  }
  return isCycleCollectionComplete(cycle);
}

/** Reconstruit un `CurrentCycle` minimal depuis la ligne liste (champs hydratés par `normalizeTontineListItem`). */
export function buildCurrentCycleFromListItem(item: TontineListItem): CurrentCycle | null {
  if (item.currentCycleUid == null || item.currentCycleUid === '') return null;
  return {
    uid: item.currentCycleUid,
    cycleNumber: item.currentCycle ?? 0,
    expectedDate: item.currentCycleExpectedDate ?? '',
    actualPayoutDate: null,
    totalAmount:
      item.currentCycleTotalExpected ?? item.currentCycleCollectedAmount ?? 0,
    collectedAmount: item.currentCycleCollectedAmount ?? undefined,
    totalExpected: item.currentCycleTotalExpected ?? undefined,
    collectionProgress: item.collectionProgress ?? undefined,
    beneficiaryNetAmount: item.payoutNetAmount ?? item.beneficiaryNetAmount ?? undefined,
    delayedByMemberIds: null,
    status: item.currentCycleStatus ?? 'ACTIVE',
    beneficiaryMembershipUid: null,
  };
}

/** Éligibilité « Payer la cagnotte » sur la carte liste — réutilise `canShowOrganizerPayoutCta`. */
export function canShowOrganizerPayoutFromListItem(item: TontineListItem): boolean {
  const isOrganizer = item.isCreator === true || item.membershipRole === 'CREATOR';
  const cycle = buildCurrentCycleFromListItem(item);
  return canShowOrganizerPayoutCta(isOrganizer, cycle, undefined);
}

export type DashboardOrganizerPayoutPhase = 'ready' | 'in_progress';

/**
 * Rappel accueil « cagnotte » : organisateur, tontine rotative, cycle identifié.
 * `ready` = collecte complète et versement déclenchable (`canTriggerPayout` depuis la liste).
 * `in_progress` = versement déjà engagé côté backend.
 */
export function resolveDashboardOrganizerPayoutReminder(
  item: TontineListItem
): DashboardOrganizerPayoutPhase | null {
  const isOrganizer = item.isCreator === true || item.membershipRole === 'CREATOR';
  if (!isOrganizer) return null;
  if (item.type === 'EPARGNE') return null;
  if (item.currentCycleUid == null || item.currentCycleUid === '') return null;

  if (item.currentCycleStatus === 'PAYOUT_IN_PROGRESS') {
    return 'in_progress';
  }
  if (
    item.currentCycleStatus === 'PAYOUT_COMPLETED' ||
    item.currentCycleStatus === 'COMPLETED' ||
    item.currentCycleStatus === 'SKIPPED'
  ) {
    return null;
  }
  if (item.canTriggerPayout === true) {
    return 'ready';
  }
  return null;
}

/** Pourcentage 0–100 pour la barre ; `null` si progression non fiable (pas de donnée). */
export function listItemCollectionProgressPercent(item: TontineListItem): number | null {
  const p = item.collectionProgress;
  if (p != null && Number.isFinite(Number(p))) {
    return Math.round(Math.min(1, Math.max(0, Number(p))) * 100);
  }
  const c = item.currentCycleCollectedAmount;
  const e = item.currentCycleTotalExpected;
  if (c != null && e != null && e > 0 && Number.isFinite(c) && Number.isFinite(e)) {
    return Math.round(Math.min(1, Math.max(0, c / e)) * 100);
  }
  return null;
}
