/**
 * Chargement paginé de l'historique de paiements pour le module Rapport.
 */
import { getPaymentHistory } from '@/api/paymentApi';
import { logger } from '@/utils/logger';
import type { PaymentHistoryItem } from '@/types/tontine';

const PAGE_SIZE = 100;

export async function fetchAllCompletedPaymentItems(): Promise<PaymentHistoryItem[]> {
  const out: PaymentHistoryItem[] = [];
  let page = 1;
  let total = Infinity;
  try {
    while (out.length < total) {
      const res = await getPaymentHistory(page, PAGE_SIZE, 'COMPLETED', {
        sortOrder: 'desc',
      });
      out.push(...res.data);
      total = res.total > 0 ? res.total : out.length;
      if (res.data.length < PAGE_SIZE) break;
      page += 1;
    }
  } catch (err: unknown) {
    logger.error('[report] fetchAllCompletedPaymentItems failed', {
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
  return out;
}
