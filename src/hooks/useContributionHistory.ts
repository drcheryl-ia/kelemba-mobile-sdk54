/**
 * Hook — historique paginé des cotisations (useInfiniteQuery).
 * GET /api/v1/payments/my-history
 */
import { useInfiniteQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
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

export interface UseContributionHistoryReturn {
  items: PaymentHistoryItem[];
  total: number;
  hasNextPage: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  refetch: () => void;
}

export function useContributionHistory(
  statusFilter: StatusFilter = undefined
): UseContributionHistoryReturn {
  const userUid = useSelector((state: RootState) => selectUserUid(state));

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['payments', 'history', statusFilter],
    queryFn: async ({ pageParam }) => {
      return getPaymentHistory(pageParam, PAGE_SIZE, statusFilter);
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
  });

  const allPages = data?.pages ?? [];
  const items = allPages.flatMap((p) => p.data);
  const total = data?.pages?.[0]?.total ?? 0;

  return {
    items,
    total,
    hasNextPage: hasNextPage ?? false,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  };
}
