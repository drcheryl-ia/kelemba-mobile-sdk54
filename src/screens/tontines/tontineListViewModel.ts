import { isMembershipPending } from '@/utils/tontineMerge';
import {
  deriveTontinePaymentUiState,
  resolveScheduledPaymentDate,
} from '@/utils/tontinePaymentState';
import type { TontineType } from '@/types/savings.types';
import type { TontineListItem, TontineStatus } from '@/types/tontine';

export type TontineQuickFilter = 'all' | 'active' | 'draft';
export type TontineStatusFilter =
  | 'all'
  | 'draft'
  | 'active'
  | 'between_rounds'
  | 'paused'
  | 'completed'
  | 'cancelled';
export type TontineRoleFilter = 'all' | 'creator' | 'member';
export type TontineSortOption =
  | 'priority'
  | 'dueDate'
  | 'amount'
  | 'name'
  | 'recent';
export type TontineTypeFilter = 'ALL' | TontineType;

export interface TontineAdvancedFilters {
  typeFilter: TontineTypeFilter;
  statusFilter: TontineStatusFilter;
  roleFilter: TontineRoleFilter;
  sortBy: TontineSortOption;
}

export type TontinePrimaryActionKind =
  | 'VIEW'
  | 'RESPOND'
  | 'FINALIZE'
  | 'MANAGE'
  | 'PAY'
  | 'NEW_ROTATION';

export type TontinePersonalStatusKind =
  | 'INVITATION_RECEIVED'
  | 'VALIDATION_PENDING'
  | 'UP_TO_DATE'
  | 'PAYMENT_DUE'
  | 'OVERDUE'
  | 'PROCESSING'
  | 'DRAFT'
  | 'UNKNOWN';

export interface TontineOverviewStats {
  activeCount: number;
  draftCount: number;
  pendingActionsCount: number;
}

function isCreator(item: TontineListItem): boolean {
  return item.isCreator === true || item.membershipRole === 'CREATOR';
}

function matchesStatus(item: TontineListItem, filter: TontineStatusFilter): boolean {
  if (filter === 'all') return true;

  const map: Record<Exclude<TontineStatusFilter, 'all'>, TontineStatus> = {
    draft: 'DRAFT',
    active: 'ACTIVE',
    between_rounds: 'BETWEEN_ROUNDS',
    paused: 'PAUSED',
    completed: 'COMPLETED',
    cancelled: 'CANCELLED',
  };

  return item.status === map[filter];
}

function isActionableActiveTontine(item: TontineListItem): boolean {
  if (item.status !== 'ACTIVE' && item.status !== 'BETWEEN_ROUNDS') {
    return false;
  }
  return deriveTontinePaymentUiState(item).needsPaymentAttention;
}

function compareByDueDate(a: TontineListItem, b: TontineListItem): number {
  const aDate = resolveScheduledPaymentDate(a);
  const bDate = resolveScheduledPaymentDate(b);

  if (aDate == null && bDate == null) {
    return a.name.localeCompare(b.name, 'fr-FR');
  }
  if (aDate == null) return 1;
  if (bDate == null) return -1;

  const dateCompare = aDate.localeCompare(bDate);
  if (dateCompare !== 0) return dateCompare;
  return a.name.localeCompare(b.name, 'fr-FR');
}

export function getTontinePriority(item: TontineListItem): number {
  if (isMembershipPending(item)) return 0;
  if (item.status === 'DRAFT') return 1;
  if (isActionableActiveTontine(item)) return 2;
  if (item.status === 'ACTIVE' || item.status === 'BETWEEN_ROUNDS') return 3;
  if (item.status === 'PAUSED') return 4;
  return 5;
}

export function getPrimaryActionKind(item: TontineListItem): TontinePrimaryActionKind {
  if (isMembershipPending(item)) {
    return item.invitationOrigin === 'INVITE' ? 'RESPOND' : 'VIEW';
  }

  if (item.status === 'DRAFT') return 'FINALIZE';

  if (item.status === 'BETWEEN_ROUNDS' && isCreator(item)) {
    return 'NEW_ROTATION';
  }

  if ((item.status === 'ACTIVE' || item.status === 'BETWEEN_ROUNDS') && isCreator(item)) {
    return 'MANAGE';
  }

  if (item.status === 'ACTIVE' && deriveTontinePaymentUiState(item).needsPaymentAttention) {
    return 'PAY';
  }

  return 'VIEW';
}

export function getPersonalStatusKind(item: TontineListItem): TontinePersonalStatusKind {
  if (isMembershipPending(item)) {
    return item.invitationOrigin === 'INVITE'
      ? 'INVITATION_RECEIVED'
      : 'VALIDATION_PENDING';
  }

  if (item.status === 'DRAFT') return 'DRAFT';

  const payState = deriveTontinePaymentUiState(item);

  if (payState.uiStatus === 'OVERDUE') return 'OVERDUE';
  if (payState.uiStatus === 'DUE_SOON' || payState.uiStatus === 'DUE_TODAY') {
    return 'PAYMENT_DUE';
  }
  if (payState.badgeLabel === 'Paiement en cours') return 'PROCESSING';
  if (payState.uiStatus === 'UP_TO_DATE') return 'UP_TO_DATE';

  return 'UNKNOWN';
}

export function matchesQuickFilter(
  item: TontineListItem,
  quickFilter: TontineQuickFilter
): boolean {
  if (quickFilter === 'all') return true;
  if (quickFilter === 'draft') return item.status === 'DRAFT';
  return item.status === 'ACTIVE' || item.status === 'BETWEEN_ROUNDS';
}

export function applyAdvancedFilters(
  items: TontineListItem[],
  filters: TontineAdvancedFilters
): TontineListItem[] {
  return items.filter((item) => {
    const typeOk =
      filters.typeFilter === 'ALL' || (item.type ?? 'ROTATIVE') === filters.typeFilter;
    const statusOk = matchesStatus(item, filters.statusFilter);
    const roleOk =
      filters.roleFilter === 'all' ||
      (filters.roleFilter === 'creator' ? isCreator(item) : !isCreator(item));
    return typeOk && statusOk && roleOk;
  });
}

export function sortTontinesForList(
  items: TontineListItem[],
  sortBy: TontineSortOption
): TontineListItem[] {
  const copy = [...items];

  copy.sort((a, b) => {
    if (sortBy === 'amount') {
      const amountCompare = b.amountPerShare - a.amountPerShare;
      return amountCompare !== 0 ? amountCompare : a.name.localeCompare(b.name, 'fr-FR');
    }

    if (sortBy === 'name') {
      return a.name.localeCompare(b.name, 'fr-FR');
    }

    if (sortBy === 'recent') {
      const aDate = a.startDate ?? '';
      const bDate = b.startDate ?? '';
      if (aDate !== bDate) return bDate.localeCompare(aDate);
      return a.name.localeCompare(b.name, 'fr-FR');
    }

    if (sortBy === 'dueDate') {
      return compareByDueDate(a, b);
    }

    const priorityCompare = getTontinePriority(a) - getTontinePriority(b);
    if (priorityCompare !== 0) return priorityCompare;
    return compareByDueDate(a, b);
  });

  return copy;
}

export function buildTontineOverviewStats(items: TontineListItem[]): TontineOverviewStats {
  return items.reduce<TontineOverviewStats>(
    (acc, item) => {
      if (
        !isMembershipPending(item) &&
        (item.status === 'ACTIVE' || item.status === 'BETWEEN_ROUNDS')
      ) {
        acc.activeCount += 1;
      }
      if (item.status === 'DRAFT') {
        acc.draftCount += 1;
      }
      if (
        isMembershipPending(item) ||
        item.status === 'DRAFT' ||
        isActionableActiveTontine(item)
      ) {
        acc.pendingActionsCount += 1;
      }
      return acc;
    },
    { activeCount: 0, draftCount: 0, pendingActionsCount: 0 }
  );
}
