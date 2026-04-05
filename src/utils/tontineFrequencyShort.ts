import type { TontineFrequency } from '@/api/types/api.types';

/** Libellé court pour la grille « Part [freq] » (TontineFullCard). */
export function freqShort(frequency: TontineFrequency): string {
  switch (frequency) {
    case 'DAILY':
      return 'quotidienne';
    case 'WEEKLY':
      return 'hebdo';
    case 'BIWEEKLY':
      return 'bimensuelle';
    case 'MONTHLY':
      return 'mensuelle';
    default:
      return '';
  }
}

/** Libellé lisible pour méta-lignes (InvitationCard). */
export function frequencyReadable(frequency: TontineFrequency): string {
  switch (frequency) {
    case 'DAILY':
      return 'quotidienne';
    case 'WEEKLY':
      return 'hebdomadaire';
    case 'BIWEEKLY':
      return 'bimensuelle';
    case 'MONTHLY':
      return 'mensuelle';
    default:
      return '';
  }
}
