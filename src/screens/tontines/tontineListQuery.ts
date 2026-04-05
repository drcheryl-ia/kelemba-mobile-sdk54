/**
 * Filtrage / tri client-side — liste tontines (TontineListScreen).
 */
import {
  deriveTontinePaymentUiState,
  parseLocalDateOnly,
  resolveScheduledPaymentDate,
} from '@/utils/tontinePaymentState';
import type { TontineListItem } from '@/types/tontine';

export type FilterChip = 'all' | 'active' | 'draft' | 'pending' | 'completed';

export type SortOrder = 'recent' | 'name_asc' | 'due_soon' | 'amount_desc';

function itemUpdatedTs(item: TontineListItem): number {
  const ext = item as TontineListItem & { updatedAt?: string };
  if (ext.updatedAt) {
    const t = new Date(ext.updatedAt).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
}

function isOverdueUi(item: TontineListItem): boolean {
  return deriveTontinePaymentUiState(item).uiStatus === 'OVERDUE';
}

function matchesChip(item: TontineListItem, chip: FilterChip): boolean {
  switch (chip) {
    case 'all':
      return true;
    case 'active':
      return item.status === 'ACTIVE' || item.status === 'BETWEEN_ROUNDS';
    case 'draft':
      return item.status === 'DRAFT';
    case 'pending':
      return item.membershipStatus === 'PENDING';
    case 'completed':
      return item.status === 'COMPLETED';
    default:
      return true;
  }
}

function matchesSearch(item: TontineListItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return item.name.toLowerCase().includes(q);
}

function dueSoonTs(item: TontineListItem): number | null {
  const iso = resolveScheduledPaymentDate(item);
  if (iso == null || iso === '') return null;
  const ts = parseLocalDateOnly(iso);
  return ts;
}

function sortItems(
  items: TontineListItem[],
  sortOrder: SortOrder
): TontineListItem[] {
  const copy = [...items];

  const byOverdueThen = (
    a: TontineListItem,
    b: TontineListItem,
    cmp: (x: TontineListItem, y: TontineListItem) => number
  ): number => {
    const ao = isOverdueUi(a) ? 0 : 1;
    const bo = isOverdueUi(b) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return cmp(a, b);
  };

  switch (sortOrder) {
    case 'name_asc':
      copy.sort((a, b) =>
        byOverdueThen(a, b, (x, y) => x.name.localeCompare(y.name, 'fr-FR'))
      );
      break;
    case 'amount_desc': {
      copy.sort((a, b) =>
        byOverdueThen(a, b, (x, y) => {
          const ax = (x.amountPerShare ?? 0) * (x.userSharesCount ?? 1);
          const bx = (y.amountPerShare ?? 0) * (y.userSharesCount ?? 1);
          return bx - ax;
        })
      );
      break;
    }
    case 'due_soon': {
      copy.sort((a, b) =>
        byOverdueThen(a, b, (x, y) => {
          const ax = dueSoonTs(x);
          const bx = dueSoonTs(y);
          if (ax == null && bx == null) return 0;
          if (ax == null) return 1;
          if (bx == null) return -1;
          return ax - bx;
        })
      );
      break;
    }
    case 'recent':
    default:
      copy.sort((a, b) =>
        byOverdueThen(a, b, (x, y) => {
          const tx = itemUpdatedTs(x);
          const ty = itemUpdatedTs(y);
          if (tx !== ty) return ty - tx;
          return x.name.localeCompare(y.name, 'fr-FR');
        })
      );
      break;
  }

  return copy;
}

export function filterAndSearch(
  tontines: TontineListItem[],
  query: string,
  chip: FilterChip,
  sortOrder: SortOrder
): TontineListItem[] {
  const filtered = tontines.filter(
    (t) => matchesChip(t, chip) && matchesSearch(t, query)
  );
  return sortItems(filtered, sortOrder);
}

export type SectionKey = 'ACTIVE' | 'DRAFT' | 'COMPLETED';

export function mergePendingSources(
  invitations: TontineListItem[],
  tontines: TontineListItem[]
): TontineListItem[] {
  const map = new Map<string, TontineListItem>();
  for (const t of invitations) {
    map.set(t.uid, t);
  }
  for (const t of tontines) {
    if (t.membershipStatus === 'PENDING') {
      map.set(t.uid, t);
    }
  }
  return Array.from(map.values());
}

export function filterPendingList(
  invitations: TontineListItem[],
  tontines: TontineListItem[],
  query: string,
  sortOrder: SortOrder
): TontineListItem[] {
  const merged = mergePendingSources(invitations, tontines);
  const filtered = merged.filter((t) => matchesSearch(t, query));
  return sortItems(filtered, sortOrder);
}

export function groupByStatusForSections(
  items: TontineListItem[]
): { key: SectionKey; data: TontineListItem[] }[] {
  const active: TontineListItem[] = [];
  const draft: TontineListItem[] = [];
  const completed: TontineListItem[] = [];

  for (const t of items) {
    if (t.status === 'DRAFT') {
      draft.push(t);
    } else if (t.status === 'COMPLETED') {
      completed.push(t);
    } else {
      active.push(t);
    }
  }

  const out: { key: SectionKey; data: TontineListItem[] }[] = [];
  if (active.length > 0) out.push({ key: 'ACTIVE', data: active });
  if (draft.length > 0) out.push({ key: 'DRAFT', data: draft });
  if (completed.length > 0) out.push({ key: 'COMPLETED', data: completed });
  return out;
}

export function chipCounts(
  tontines: TontineListItem[],
  invitations: TontineListItem[]
): Record<FilterChip, number> {
  const mergedPending = mergePendingSources(invitations, tontines);
  const all = tontines.length;
  let active = 0;
  let draft = 0;
  let completed = 0;
  for (const t of tontines) {
    if (t.status === 'ACTIVE' || t.status === 'BETWEEN_ROUNDS') active += 1;
    if (t.status === 'DRAFT') draft += 1;
    if (t.status === 'COMPLETED') completed += 1;
  }
  return {
    all,
    active,
    draft,
    pending: mergedPending.length,
    completed,
  };
}
