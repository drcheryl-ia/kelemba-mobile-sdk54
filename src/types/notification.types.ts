/**
 * Types des notifications — tirés de schema.prisma / api-contract.
 */

export type NotificationType =
  | 'PAYMENT_REMINDER'
  | 'PAYMENT_RECEIVED'
  | 'POT_AVAILABLE'
  | 'POT_DELAYED'
  | 'KYC_UPDATE'
  | 'TONTINE_INVITATION'
  | 'ROTATION_CHANGED'
  | 'ROTATION_SWAP_REQUESTED'
  | 'PENALTY_APPLIED'
  | 'SCORE_UPDATE'
  | 'SYSTEM'
  | 'CASH_PENDING'
  | 'SAVINGS_REMINDER'
  | 'SAVINGS_MATURED';

export type NotificationPriority =
  | 'CRITICAL'
  | 'HIGH'
  | 'NORMAL'
  | 'DIGEST';

export type NotificationChannel = 'PUSH' | 'SMS' | 'IN_APP';

export interface Notification {
  uid: string;
  type: NotificationType;
  channel: NotificationChannel;
  priority: NotificationPriority;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  /** Payload JSON (objet ou string sérialisée selon API). */
  data?: Record<string, unknown> | string | null;
  archivedAt?: string | null;
}

export interface NotificationsPage {
  items: Notification[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UnreadCountResponse {
  count: number;
}

export type FilterTab = 'ALL' | 'UNREAD' | 'PAYMENTS' | 'TONTINES' | 'SYSTEM';

export type SectionKey = 'today' | 'thisWeek' | 'older';
