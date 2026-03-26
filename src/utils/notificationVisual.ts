/**
 * Accent visuel des notifications (liste + cartes).
 */
import type { NotificationType } from '@/types/notification.types';

export type NotificationAccent = 'danger' | 'warning' | 'success' | 'neutral';

/** Retard, pénalité, alerte forte */
const DANGER_TYPES: NotificationType[] = ['PENALTY_APPLIED', 'POT_DELAYED'];

/** Rappels / urgence modérée */
const WARNING_TYPES: NotificationType[] = ['PAYMENT_REMINDER'];

/** Paiement reçu, cagnotte, invitation positive */
const SUCCESS_TYPES: NotificationType[] = [
  'PAYMENT_RECEIVED',
  'POT_AVAILABLE',
  'TONTINE_INVITATION',
];

export function getNotificationAccent(type: NotificationType): NotificationAccent {
  if (DANGER_TYPES.includes(type)) return 'danger';
  if (WARNING_TYPES.includes(type)) return 'warning';
  if (SUCCESS_TYPES.includes(type)) return 'success';
  return 'neutral';
}

export const NOTIFICATION_ACCENT_STYLES: Record<
  NotificationAccent,
  { border: string; tintBg: string }
> = {
  danger: { border: '#D0021B', tintBg: '#FEF2F2' },
  warning: { border: '#F5A623', tintBg: '#FFFBEB' },
  success: { border: '#1A6B3C', tintBg: '#F0FDF4' },
  neutral: { border: '#E5E7EB', tintBg: '#FFFFFF' },
};
