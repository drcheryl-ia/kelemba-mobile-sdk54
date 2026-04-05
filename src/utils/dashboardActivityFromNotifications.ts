/**
 * Dérive les lignes « Activité récente » depuis les notifications (3 premières).
 */
import type { Notification } from '@/types/notification.types';
import type { ActivityItem, ActivityItemType } from '@/types/dashboard.types';
import { COLORS } from '@/theme/colors';

function mapType(t: Notification['type']): ActivityItemType {
  switch (t) {
    case 'PENALTY_APPLIED':
      return 'penalty';
    case 'SCORE_UPDATE':
      return 'score';
    case 'TONTINE_INVITATION':
      return 'invitation';
    default:
      return 'payment';
  }
}

function dotForType(t: ActivityItemType): string {
  switch (t) {
    case 'penalty':
      return COLORS.danger;
    case 'score':
      return COLORS.secondary;
    case 'invitation':
      return COLORS.accent;
    default:
      return COLORS.primary;
  }
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function activityItemsFromNotifications(
  items: Notification[]
): ActivityItem[] {
  return items.slice(0, 3).map((n) => {
    const type = mapType(n.type);
    return {
      id: n.uid,
      type,
      description: n.title?.trim() ? n.title : n.message,
      timestamp: formatTime(n.createdAt),
      dotColor: dotForType(type),
    };
  });
}
