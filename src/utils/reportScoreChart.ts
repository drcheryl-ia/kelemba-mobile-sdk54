/**
 * Reconstitution des scores journaliers pour le mini-graphique Rapport.
 */
import type { ScoreEventDisplay } from '@/types/report.types';

/**
 * Pour chaque jour des 14 derniers jours, score après application des événements
 * dont la date est ≤ fin de journée (méthode pure, pas d'effet de bord).
 */
export function computeDailyScores(
  history: ScoreEventDisplay[],
  currentScore: number
): { date: string; score: number }[] {
  const sorted = [...history].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
  );
  const sumDelta = sorted.reduce((s, e) => s + e.delta, 0);
  const events = sorted.map((e) => ({
    t: Date.parse(e.createdAt),
    d: e.delta,
  }));

  const out: { date: string; score: number }[] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const dayEnd = new Date(now);
    dayEnd.setDate(dayEnd.getDate() - i);
    dayEnd.setHours(23, 59, 59, 999);
    const key = dayEnd.toISOString().split('T')[0] ?? '';
    let s = currentScore - sumDelta;
    for (const ev of events) {
      if (ev.t <= dayEnd.getTime()) s += ev.d;
    }
    const clamped = Math.max(0, Math.min(1000, s));
    out.push({ date: key, score: Math.round(clamped) });
  }
  return out;
}
