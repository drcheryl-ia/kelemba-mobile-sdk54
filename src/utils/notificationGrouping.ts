/**
 * Groupement des notifications pour SectionList (libellés FR).
 */
import type { Notification } from '@/types/notification.types';

export type NotificationListFilter = 'all' | 'unread' | 'payments';

const PAYMENT_TYPES = new Set<string>([
  'PAYMENT_REMINDER',
  'PAYMENT_RECEIVED',
  'POT_AVAILABLE',
  'POT_DELAYED',
  'PENALTY_APPLIED',
]);

const DAY_MS = 86_400_000;

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function filterNotifications(
  items: Notification[],
  filter: NotificationListFilter
): Notification[] {
  if (filter === 'all') return items;
  if (filter === 'unread') {
    return items.filter((n) => n.readAt == null);
  }
  return items.filter((n) => PAYMENT_TYPES.has(String(n.type)));
}

function sortDesc(a: Notification, b: Notification): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export interface NotificationSection {
  key: string;
  title: string;
  data: Notification[];
}

const monthFmt = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
});

/**
 * Groupe les notifications filtrées par date (ordre des sections : du plus récent au plus ancien).
 */
export function groupNotificationsByDate(
  notifications: Notification[],
  activeFilter: NotificationListFilter
): NotificationSection[] {
  const filtered = filterNotifications(
    notifications.filter(
      (n) =>
        n != null &&
        typeof n.createdAt === 'string' &&
        !Number.isNaN(Date.parse(n.createdAt))
    ),
    activeFilter
  );
  const sorted = [...filtered].sort(sortDesc);

  const now = new Date();
  const t0 = startOfLocalDay(now);

  const map = new Map<string, { title: string; items: Notification[] }>();

  const add = (key: string, title: string, n: Notification) => {
    const cur = map.get(key);
    if (cur) {
      cur.items.push(n);
    } else {
      map.set(key, { title, items: [n] });
    }
  };

  for (const n of sorted) {
    const created = new Date(n.createdAt);
    const tc = startOfLocalDay(created);
    const diffDays = Math.round((t0 - tc) / DAY_MS);

    if (diffDays === 0) {
      add('today', "Aujourd'hui", n);
      continue;
    }
    if (diffDays === 1) {
      add('yesterday', 'Hier', n);
      continue;
    }
    if (diffDays >= 2 && diffDays <= 7) {
      add('week', 'Cette semaine', n);
      continue;
    }

    const sameMonth =
      created.getFullYear() === now.getFullYear() &&
      created.getMonth() === now.getMonth();
    if (sameMonth && diffDays > 7) {
      add('month', 'Ce mois', n);
      continue;
    }

    const y = created.getFullYear();
    const m = created.getMonth();
    const key = `m-${y}-${m}`;
    const title = monthFmt.format(new Date(y, m, 1));
    add(key, title, n);
  }

  const keyOrder: string[] = [];
  for (const k of ['today', 'yesterday', 'week', 'month']) {
    if (map.has(k)) keyOrder.push(k);
  }
  const monthKeys = [...map.keys()]
    .filter((k) => k.startsWith('m-'))
    .sort((a, b) => {
      const [, ya, ma] = a.split('-').map(Number);
      const [, yb, mb] = b.split('-').map(Number);
      if (ya !== yb) return yb - ya;
      return mb - ma;
    });
  for (const k of monthKeys) {
    if (!keyOrder.includes(k)) keyOrder.push(k);
  }

  return keyOrder.map((k) => {
    const entry = map.get(k)!;
    return { key: k, title: entry.title, data: entry.items };
  });
}
