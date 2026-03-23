/**
 * Éligibilité versement cagnotte (organisateur) — sans inventer d’état : s’appuie sur le cycle courant
 * et éventuellement sur GET /cycles/:uid/completion.
 */
import type { CurrentCycle } from '@/types/tontine';
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
