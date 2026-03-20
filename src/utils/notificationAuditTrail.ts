/**
 * Audit trail local pour les notifications financières.
 * Conforme CLAUDE.md — actions financières sensibles tracées via logger.
 */
import { logger } from '@/utils/logger';

const FINANCIAL_NOTIFICATION_TYPES = new Set([
  'PAYMENT_RECEIVED',
  'POT_AVAILABLE',
  'PENALTY_APPLIED',
  'PAYMENT_REMINDER',
  'POT_DELAYED',
]);

export function auditNotificationReceived(
  type: string,
  data: Record<string, unknown>
): void {
  if (!FINANCIAL_NOTIFICATION_TYPES.has(type)) return;
  logger.info('[AUDIT][Notification financière reçue]', {
    type,
    tontineUid: data.tontineUid ?? null,
    cycleUid: data.cycleUid ?? null,
    timestamp: new Date().toISOString(),
  });
}
