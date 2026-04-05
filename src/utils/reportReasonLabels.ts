import { COLORS } from '@/theme/colors';
import type { ScoreEventDto } from '@/types/user.types';
import type { ScoreEventDisplay } from '@/types/report.types';

export function reportScoreReasonLabel(reason: string): string {
  const map: Record<string, string> = {
    PAYMENT_ON_TIME: 'Cotisation versée à temps',
    PAYMENT_EARLY: 'Cotisation versée en avance',
    PAYMENT_LATE: 'Cotisation en retard',
    PAYMENT_MISSED: 'Cotisation manquée',
    LATE_1_3_DAYS: 'Retard de 1 à 3 jours',
    LATE_4_7_DAYS: 'Retard de 4 à 7 jours',
    LATE_OVER_7_DAYS: 'Retard de plus de 7 jours',
    CYCLE_COMPLETED: 'Tontine complétée sans retard',
    TONTINE_ABANDONED: 'Abandon de tontine',
    PENALTY_APPLIED: 'Pénalité appliquée',
    DISPUTE_LOST: 'Litige perdu',
    ADMIN_ADJUSTMENT: 'Ajustement administratif',
    BONUS_REFERRAL: 'Bonus parrainage',
    SAVINGS_CONTRIBUTION_ON_TIME: 'Versement épargne à temps',
    SAVINGS_CONTRIBUTION_LATE: 'Versement épargne en retard',
    SAVINGS_EARLY_EXIT: 'Sortie anticipée épargne',
    SAVINGS_CYCLE_COMPLETED: 'Cycle épargne complété',
    PAYOUT_COMPLETED_AS_ORGANIZER: 'Cagnotte versée avec succès',
  };
  return map[reason] ?? reason;
}

export function reportDotColor(delta: number): string {
  if (delta > 0) return COLORS.primary;
  if (delta < 0) return COLORS.dangerText;
  return COLORS.gray500;
}

export function toScoreEventDisplays(events: ScoreEventDto[]): ScoreEventDisplay[] {
  return events.map((e) => ({
    uid: e.uid,
    delta: e.delta,
    reason: String(e.reason),
    reasonLabel: reportScoreReasonLabel(String(e.reason)),
    tontineUid: e.tontineUid,
    createdAt: e.createdAt,
    dotColor: reportDotColor(e.delta),
  }));
}
