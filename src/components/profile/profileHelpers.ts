/**
 * Helpers partagés — écran Profil (score, FCFA abrégé, historique).
 */
import type { ScoreEventDto } from '@/types/user.types';
import type { ScoreLabel } from '@/api/types/api.types';
import type { TontineDto } from '@/api/types/api.types';

export function monthDeltaSum(history: ScoreEventDto[]): number {
  const now = new Date();
  const y = now.getFullYear();
  const mo = now.getMonth();
  return history.reduce((sum, e) => {
    const d = new Date(e.createdAt);
    if (d.getFullYear() === y && d.getMonth() === mo) return sum + e.delta;
    return sum;
  }, 0);
}

export function scoreLevelCaption(label: ScoreLabel): string {
  switch (label) {
    case 'EXCELLENT':
      return 'EXCELLENT · Accès prioritaire';
    case 'BON':
      return 'BON · Membre fiable';
    case 'MOYEN':
      return 'MOYEN · À surveiller';
    case 'FAIBLE':
      return 'FAIBLE · Risque';
    case 'CRITIQUE':
      return 'CRITIQUE';
    default:
      return String(label);
  }
}

export function nextObjective(label: ScoreLabel): { title: string; pts: number } | null {
  switch (label) {
    case 'CRITIQUE':
      return { title: 'Faible', pts: 200 };
    case 'FAIBLE':
      return { title: 'Moyen', pts: 400 };
    case 'MOYEN':
      return { title: 'Bon', pts: 600 };
    case 'BON':
      return { title: 'Excellent', pts: 800 };
    case 'EXCELLENT':
      return null;
    default:
      return null;
  }
}

export function formatFcfaAbbrev(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return `${Math.round(n)}`;
}

export function totalFcfaPaidApprox(tontines: TontineDto[]): number {
  return tontines.reduce((sum, t) => {
    if (t.status === 'ACTIVE') {
      return sum + (t.amountPerShare ?? 0) * (t.currentCycle ?? 0);
    }
    if (t.status === 'COMPLETED') {
      return sum + (t.amountPerShare ?? 0) * (t.totalCycles ?? 0);
    }
    return sum;
  }, 0);
}

/**
 * Dates relatives sans `Intl.RelativeTimeFormat` (évite erreurs Hermes iOS / polyfills incomplets).
 */
export function formatScoreEventDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays >= 0 && diffDays < 7) {
    if (diffDays === 0) {
      const hours = Math.floor(diffMs / (60 * 60 * 1000));
      if (hours < 1) return "À l'instant";
      if (hours === 1) return 'Il y a 1 heure';
      if (hours > 0 && hours < 24) return `Il y a ${hours} heures`;
      return "Aujourd'hui";
    }
    if (diffDays === 1) return 'Hier';
    return `Il y a ${diffDays} jours`;
  }
  try {
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}
