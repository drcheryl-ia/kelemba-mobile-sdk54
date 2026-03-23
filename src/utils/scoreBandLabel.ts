/**
 * Libellés d’affichage pour le score — données issues du backend (scoreLabel / currentScore).
 * Ne recalcule pas le score métier.
 */
import type { ScoreLabel } from '@/api/types/api.types';

export type ScoreBandDisplay =
  | 'Excellent'
  | 'Bon'
  | 'Moyen'
  | 'Faible'
  | 'Critique'
  | 'Banni';

/** Correspondance API ScoreLabel → libellé court dashboard. */
export function scoreLabelToBandDisplay(label: ScoreLabel): ScoreBandDisplay {
  switch (label) {
    case 'EXCELLENT':
      return 'Excellent';
    case 'BON':
      return 'Bon';
    case 'MOYEN':
      return 'Moyen';
    case 'FAIBLE':
      return 'Faible';
    case 'CRITIQUE':
      return 'Critique';
    default:
      return 'Moyen';
  }
}

/** Affichage de secours si le libellé API est absent (paliers indicatifs uniquement). */
export function scoreValueToBandDisplay(score: number): ScoreBandDisplay {
  if (score <= 0) return 'Banni';
  if (score >= 800) return 'Excellent';
  if (score >= 600) return 'Bon';
  if (score >= 400) return 'Moyen';
  if (score >= 200) return 'Faible';
  if (score >= 1) return 'Critique';
  return 'Banni';
}
