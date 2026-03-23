/**
 * Hook — historique paginé des cotisations (useInfiniteQuery).
 * GET /api/v1/payments/my-history
 */
import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { shouldRetryApiQuery } from '@/api/errors/queryRetry';
import { getPaymentHistory } from '@/api/paymentApi';
import { selectUserUid } from '@/store/authSlice';
import type { RootState } from '@/store/store';
import type { PaymentHistoryItem } from '@/types/tontine';

const PAGE_SIZE = 20;
const STALE_TIME = 60_000;
const GC_TIME = 24 * 60 * 60 * 1000;

export type StatusFilter =
  | undefined
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REFUNDED';

export type PeriodPreset = 'all' | '7d' | '30d' | 'custom';

export type MethodFilterOption = 'all' | 'ORANGE_MONEY' | 'TELECEL_MONEY' | 'CASH';

/** Tri par date : appliqué côté API via `sortOrder`. Tri par montant : uniquement client sur les pages déjà chargées. */
export type HistorySortField = 'date' | 'amount';

export interface ContributionHistoryOptions {
  periodPreset?: PeriodPreset;
  /** Requis si `periodPreset === 'custom'` (YYYY-MM-DD) */
  customFrom?: string;
  customTo?: string;
  methodFilter?: MethodFilterOption;
  /** Utilisé pour le tri par date (API) et pour le sens du tri par montant (client). */
  sortOrder?: 'asc' | 'desc';
  sortField?: HistorySortField;
}

function periodToRange(
  preset: PeriodPreset | undefined,
  customFrom?: string,
  customTo?: string
): { from?: string; to?: string } {
  if (preset === 'custom' && customFrom && customTo) {
    return { from: customFrom, to: customTo };
  }
  if (preset == null || preset === 'all' || preset === 'custom') return {};
  const to = new Date();
  const from = new Date();
  if (preset === '7d') from.setDate(from.getDate() - 7);
  if (preset === '30d') from.setDate(from.getDate() - 30);
  const toDay = to.toISOString().split('T')[0] ?? '';
  const fromDay = from.toISOString().split('T')[0] ?? '';
  return { from: fromDay, to: toDay };
}

export interface UseContributionHistoryReturn {
  items: PaymentHistoryItem[];
  total: number;
  hasNextPage: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  fetchNextPage: () => void;
}

export function useContributionHistory(
  statusFilter: StatusFilter = undefined,
  options?: ContributionHistoryOptions
): UseContributionHistoryReturn {
  const userUid = useSelector((state: RootState) => selectUserUid(state));

  const sortField = options?.sortField ?? 'date';
  const sortOrder = options?.sortOrder ?? 'desc';

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isError,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: [
      'payments',
      'history',
      userUid,
      statusFilter,
      options?.periodPreset ?? 'all',
      options?.customFrom ?? '',
      options?.customTo ?? '',
      options?.methodFilter ?? 'all',
      sortOrder,
      sortField,
    ],
    queryFn: async ({ pageParam }) => {
      const range = periodToRange(
        options?.periodPreset,
        options?.customFrom,
        options?.customTo
      );
      const method =
        options?.methodFilter != null && options.methodFilter !== 'all'
          ? options.methodFilter
          : undefined;
      /** Tri date côté serveur ; pour tri montant on charge en desc puis on réordonne en client. */
      const apiSortOrder = sortField === 'amount' ? 'desc' : sortOrder;
      return getPaymentHistory(pageParam, PAGE_SIZE, statusFilter, {
        ...range,
        method,
        sortOrder: apiSortOrder,
      });
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.total / lastPage.limit);
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
    enabled: userUid !== null,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    networkMode: 'offlineFirst',
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: shouldRetryApiQuery,
  });

  const total = data?.pages?.[0]?.total ?? 0;

  const rawItems = useMemo(
    () => (data?.pages ?? []).flatMap((p) => p.data),
    [data]
  );

  const items = useMemo(() => {
    if (sortField !== 'amount') return rawItems;
    const copy = [...rawItems];
    copy.sort((a, b) => {
      const cmp = a.amount - b.amount;
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rawItems, sortField, sortOrder]);

  return {
    items,
    total,
    hasNextPage: hasNextPage ?? false,
    isFetching,
    isFetchingNextPage,
    isError,
    error: error instanceof Error ? error : null,
    refetch,
    fetchNextPage,
  };
}
