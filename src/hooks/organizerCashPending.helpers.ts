import type { OrganizerCashPendingAction } from '@/api/cashPaymentApi';
import type { TontineListItem } from '@/types/tontine';

/** GET pending-actions : le backend ne renvoie que les demandes en revue. */
export function isOpenOrganizerCashStatus(status?: string): boolean {
  return status === 'PENDING_REVIEW';
}

/**
 * Demandes à traiter par l'organisateur (liste globale).
 * Pas d'exclusion par memberUid côté client : le périmètre est porté par l'API.
 */
export function filterOrganizerCashPendingForOthers(
  actions: OrganizerCashPendingAction[],
  viewerUid: string | null
): OrganizerCashPendingAction[] {
  if (!viewerUid) return [];
  return actions.filter((a) => a.status === 'PENDING_REVIEW');
}

/** UIDs des tontines ou l'utilisateur est createur / organisateur. */
export function getOrganizerTontineUids(
  tontines: TontineListItem[]
): Set<string> {
  const uids = new Set<string>();
  for (const tontine of tontines) {
    if (!tontine.uid) continue;
    if (tontine.isCreator === true || tontine.membershipRole === 'CREATOR') {
      uids.add(tontine.uid);
    }
  }
  return uids;
}

/** Filtre self-pay + perimetre tontines dont l'utilisateur est organisateur. */
export function filterOrganizerCashPendingForTontineScope(
  actions: OrganizerCashPendingAction[],
  viewerUid: string | null,
  organizerTontineUids: Set<string>
): OrganizerCashPendingAction[] {
  return filterOrganizerCashPendingForOthers(actions, viewerUid).filter((a) =>
    Boolean(a.tontineUid && organizerTontineUids.has(a.tontineUid))
  );
}
