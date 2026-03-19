/**
 * Utilitaires score Kelemba — mapping score → niveau, couleur, label.
 * BANNI n'existe pas dans l'API — dérivé de UserProfileResponseDto.status === 'BANNED'.
 */

import type { ScoreEventDto } from '@/types/user.types';
import type { ScoreEventReason } from '@/api/types/api.types';

export type ScoreEventCategory = 'ALL' | 'POSITIVE' | 'NEGATIVE';

export type PeriodFilter = '1M' | '3M' | '6M' | 'ALL';

export const SCORE_REASON_LABEL: Record<ScoreEventReason, string> = {
  PAYMENT_ON_TIME: 'Paiement à temps',
  PAYMENT_EARLY: 'Paiement anticipé',
  PAYMENT_LATE: 'Paiement en retard',
  PAYMENT_MISSED: 'Paiement manqué',
  LATE_1_3_DAYS: 'Retard 1–3 jours',
  LATE_4_7_DAYS: 'Retard 4–7 jours',
  LATE_OVER_7_DAYS: 'Retard > 7 jours',
  CYCLE_COMPLETED: 'Cycle terminé',
  TONTINE_ABANDONED: 'Abandon de tontine',
  PENALTY_APPLIED: 'Pénalité appliquée',
  DISPUTE_LOST: 'Litige perdu',
  BONUS_REFERRAL: 'Bonus parrainage',
  ADMIN_ADJUSTMENT: 'Ajustement admin',
};

export function buildChartData(
  history: ScoreEventDto[],
  currentScore: number
): { labels: string[]; data: number[] } {
  const sorted = [...history].reverse();
  const totalDelta = history.reduce((acc, e) => acc + e.delta, 0);
  let running = currentScore - totalDelta;

  const points = sorted.map((event) => {
    running += event.delta;
    return {
      score: Math.max(0, Math.min(1000, running)),
      date: new Date(event.createdAt),
    };
  });

  const monthLabels = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return d.toLocaleDateString('fr-FR', { month: 'short' });
  });

  const monthData = monthLabels.map((_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const monthPoints = points.filter(
      (p) =>
        p.date.getFullYear() === d.getFullYear() &&
        p.date.getMonth() === d.getMonth()
    );
    return monthPoints.length > 0
      ? monthPoints[monthPoints.length - 1].score
      : i === 5
        ? currentScore
        : 0;
  });

  return { labels: monthLabels, data: monthData };
}

export type ScoreLevel =
  | 'EXCELLENT'
  | 'BON'
  | 'MOYEN'
  | 'FAIBLE'
  | 'CRITIQUE'
  | 'BANNI';

export function getScoreLevel(score: number, isBanned: boolean): ScoreLevel {
  if (isBanned) return 'BANNI';
  if (score >= 801) return 'EXCELLENT';
  if (score >= 601) return 'BON';
  if (score >= 401) return 'MOYEN';
  if (score >= 201) return 'FAIBLE';
  return 'CRITIQUE';
}

export const SCORE_COLOR: Record<ScoreLevel, string> = {
  EXCELLENT: '#1A6B3C',
  BON: '#1A6B3C',
  MOYEN: '#F5A623',
  FAIBLE: '#FF6B35',
  CRITIQUE: '#D0021B',
  BANNI: '#6B7280',
};

export const SCORE_LABEL_FR: Record<ScoreLevel, string> = {
  EXCELLENT: 'Excellent',
  BON: 'Fiable',
  MOYEN: 'Moyen',
  FAIBLE: 'Faible',
  CRITIQUE: 'Critique',
  BANNI: 'Compte banni',
};
