import type { PaymentObligation } from '@/types/payments.types';

export function freqLabel(
  frequency: PaymentObligation['frequency']
): string {
  switch (frequency) {
    case 'DAILY':
      return 'Quotidienne';
    case 'WEEKLY':
      return 'Hebdo';
    case 'BIWEEKLY':
      return 'Bimensuelle';
    case 'MONTHLY':
      return 'Mensuelle';
    default:
      return '—';
  }
}
