/**
 * Utilitaires Tontine Épargne.
 */
import { formatFcfa } from '@/utils/formatters';

// Formate un montant FCFA avec séparateur de milliers
export const formatFCFA = formatFcfa;

// Calcule le pourcentage de progression (safe — évite division par zéro)
export const progressPercent = (current: number, target: number): number =>
  target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

// Retourne true si la date de déblocage est passée ou aujourd'hui
export const isUnlockReached = (unlockDate: string): boolean =>
  new Date(unlockDate) <= new Date();

// Retourne true si on est dans la fenêtre de versement
export const isPeriodOpen = (
  period: { openDate: string; closeDate: string } | null
): boolean => {
  if (!period) return false;
  const now = new Date();
  return (
    now >= new Date(period.openDate) && now <= new Date(period.closeDate)
  );
};

// Calcule le nombre de jours restants avant une date
export const daysUntil = (isoDate: string): number => {
  const diff = new Date(isoDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

// Libellé de fréquence en français
export const frequencyLabel = (freq: string): string =>
  ({ WEEKLY: 'Hebdomadaire', BIWEEKLY: 'Bimensuel', MONTHLY: 'Mensuel' }[
    freq
  ] ?? freq);
