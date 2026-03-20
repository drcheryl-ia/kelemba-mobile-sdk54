/**
 * Fusion tontines + invitations pour affichage unifié.
 * Les invitations (pending) doivent apparaître dans la liste principale comme cartes grisées.
 */
import type { TontineListItem } from '@/types/tontine';

/**
 * Condition de verrouillage centralisée : adhésion non finalisée.
 * ACTIVE l'emporte toujours ; sinon pending si au moins une condition est vraie.
 */
export function isMembershipPending(item: TontineListItem): boolean {
  return item.membershipStatus === 'PENDING';
}

/**
 * Normalise un item pending avec flags explicites.
 */
export function normalizePendingTontine(item: TontineListItem): TontineListItem {
  return {
    ...item,
    membershipStatus: 'PENDING',
    isPending: true,
  };
}

/**
 * Fusionne tontines et invitations en une liste dédupliquée par uid.
 * Normalise les items pending avec membershipStatus, isPending, invitationOrigin.
 */
export function mergeDisplayableTontines(
  tontines: TontineListItem[],
  invitations: TontineListItem[]
): TontineListItem[] {
  const byUid = new Map<string, TontineListItem>();

  for (const t of tontines) {
    if (t.uid) {
      const normalized = isMembershipPending(t) ? normalizePendingTontine(t) : t;
      byUid.set(t.uid, normalized);
    }
  }

  for (const inv of invitations) {
    if (!inv.uid) continue;
    const existing = byUid.get(inv.uid);
    // Les invitations/received ont toujours membershipStatus PENDING.
    // Si la même tontine existe dans /tontines/me sans PENDING confirmé,
    // la version PENDING des invitations prend la priorité.
    if (!existing || existing.membershipStatus !== 'PENDING') {
      byUid.set(inv.uid, normalizePendingTontine({ ...inv, membershipStatus: 'PENDING' }));
    }
  }

  return Array.from(byUid.values());
}
