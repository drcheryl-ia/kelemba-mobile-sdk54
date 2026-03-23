import type { OrganizerCashPendingAction } from '@/api/cashPaymentApi';
import type { PaymentHistoryItem, TontineListItem } from '@/types/tontine';

export type ViewerRoleInTontine = 'MEMBER' | 'CREATOR' | 'UNKNOWN';
export type PaymentRoleFilterOption = 'all' | 'member' | 'creator';

export interface PaymentHistoryListItemVm extends PaymentHistoryItem {
  viewerRoleInTontine: ViewerRoleInTontine;
  roleLabel: string | null;
  isActionRequired: boolean;
  statusMessage: string;
  cashStateLabel: string | null;
}

export interface OrganizerCashGroupVm {
  tontineUid: string;
  tontineName: string;
  totalAmount: number;
  count: number;
  /** Plus récente soumission du groupe (tri affichage). */
  newestSubmittedAt: string | null;
  items: OrganizerCashPendingAction[];
}

export type PaymentQuickFilter =
  | 'all'
  | 'actionRequired'
  | 'completed'
  | 'cash'
  | 'mobileMoney';

export function buildViewerRoleByTontine(
  tontines: TontineListItem[]
): Record<string, ViewerRoleInTontine> {
  const out: Record<string, ViewerRoleInTontine> = {};
  for (const tontine of tontines) {
    if (!tontine.uid) continue;
    if (tontine.isCreator || tontine.membershipRole === 'CREATOR') {
      out[tontine.uid] = 'CREATOR';
      continue;
    }
    if (tontine.membershipRole === 'MEMBER') {
      out[tontine.uid] = 'MEMBER';
    }
  }
  return out;
}

function getCashStateLabel(
  item: PaymentHistoryItem,
  currentUserUid: string | null,
  viewerRoleInTontine: ViewerRoleInTontine
): string | null {
  if (item.method !== 'CASH') return null;

  const selfPay =
    currentUserUid != null &&
    item.memberUserUid != null &&
    item.memberUserUid === currentUserUid;

  if (item.status === 'COMPLETED' && (item.cashAutoValidated === true || selfPay)) {
    return 'Validation automatique';
  }
  if (item.status === 'PENDING') {
    if (selfPay && viewerRoleInTontine === 'CREATOR') return null;
    return 'En attente de validation';
  }
  if (item.status === 'PROCESSING') {
    return 'Preuve envoyee · en traitement';
  }
  if (item.status === 'COMPLETED') return 'Valide par l’organisateur';
  if (item.status === 'FAILED') return 'Refuse';
  return null;
}

function getStatusMessage(
  item: PaymentHistoryItem,
  cashStateLabel: string | null,
  viewerRoleInTontine: ViewerRoleInTontine,
  selfPay: boolean
): string {
  switch (item.status) {
    case 'PENDING':
      if (
        item.method === 'CASH' &&
        selfPay &&
        viewerRoleInTontine === 'CREATOR'
      ) {
        return 'Traitement en cours';
      }
      return 'Paiement declare, action complementaire possible';
    case 'PROCESSING':
      return 'Paiement en cours de confirmation';
    case 'COMPLETED':
      return cashStateLabel === 'Validation automatique'
        ? 'Validation automatique'
        : 'Paiement confirme';
    case 'FAILED':
      return 'Paiement refuse ou preuve rejetee';
    case 'REFUNDED':
      return 'Montant recredite';
    default:
      return 'Statut du paiement indisponible';
  }
}

export function buildPaymentHistoryVm(
  item: PaymentHistoryItem,
  currentUserUid: string | null,
  roleByTontine: Record<string, ViewerRoleInTontine>
): PaymentHistoryListItemVm {
  const viewerRoleInTontine = roleByTontine[item.tontineUid] ?? 'UNKNOWN';
  const selfPay =
    currentUserUid != null &&
    item.memberUserUid != null &&
    item.memberUserUid === currentUserUid;
  const cashStateLabel = getCashStateLabel(
    item,
    currentUserUid,
    viewerRoleInTontine
  );

  return {
    ...item,
    viewerRoleInTontine,
    roleLabel:
      viewerRoleInTontine === 'CREATOR'
        ? 'Organisateur'
        : viewerRoleInTontine === 'MEMBER'
          ? 'Membre'
          : null,
    isActionRequired:
      (item.status === 'PENDING' ||
        item.status === 'PROCESSING' ||
        item.status === 'FAILED') &&
      !(
        item.method === 'CASH' &&
        selfPay &&
        viewerRoleInTontine === 'CREATOR'
      ),
    statusMessage: getStatusMessage(
      item,
      cashStateLabel,
      viewerRoleInTontine,
      selfPay
    ),
    cashStateLabel,
  };
}

export function matchesQuickFilter(
  item: PaymentHistoryListItemVm,
  quickFilter: PaymentQuickFilter
): boolean {
  if (quickFilter === 'all') return true;
  if (quickFilter === 'actionRequired') return item.isActionRequired;
  if (quickFilter === 'completed') return item.status === 'COMPLETED';
  if (quickFilter === 'cash') return item.method === 'CASH';
  return item.method === 'ORANGE_MONEY' || item.method === 'TELECEL_MONEY';
}

export function matchesRoleFilter(
  item: PaymentHistoryListItemVm,
  roleFilter: PaymentRoleFilterOption
): boolean {
  if (roleFilter === 'all') return true;
  if (roleFilter === 'creator') return item.viewerRoleInTontine === 'CREATOR';
  return item.viewerRoleInTontine === 'MEMBER';
}

export function groupOrganizerCashActions(
  actions: OrganizerCashPendingAction[]
): OrganizerCashGroupVm[] {
  const groups = new Map<string, OrganizerCashGroupVm>();

  for (const action of actions) {
    const key = action.tontineUid || action.tontineName || action.paymentUid;
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(action);
      existing.totalAmount += action.amount;
      existing.count += 1;
      if (
        existing.newestSubmittedAt == null ||
        new Date(action.submittedAt).getTime() >
          new Date(existing.newestSubmittedAt).getTime()
      ) {
        existing.newestSubmittedAt = action.submittedAt;
      }
      continue;
    }

    groups.set(key, {
      tontineUid: action.tontineUid,
      tontineName: action.tontineName,
      totalAmount: action.amount,
      count: 1,
      newestSubmittedAt: action.submittedAt,
      items: [action],
    });
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      items: [...group.items].sort(
        (a, b) =>
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      ),
    }))
    .sort((a, b) => {
      const aTime = a.newestSubmittedAt
        ? new Date(a.newestSubmittedAt).getTime()
        : 0;
      const bTime = b.newestSubmittedAt
        ? new Date(b.newestSubmittedAt).getTime()
        : 0;
      return bTime - aTime;
    });
}
