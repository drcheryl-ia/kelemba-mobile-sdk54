/**
 * Hook — historique paginé des paiements (useInfiniteQuery).
 */
import { useInfiniteQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { getPaymentHistory } from '@/api/paymentApi';
import { selectUserUid } from '@/store/authSlice';
import type { RootState } from '@/store/store';
import type { PaymentHistoryItem } from '@/types/tontine';

const PAGE_SIZE = 20;
const GC_TIME = 24 * 60 * 60 * 1000;

export type PaymentFilter = 'all' | 'success' | 'inProgress' | 'failed';

function mapFilterToStatus(filter: PaymentFilter): string | undefined {
  if (filter === 'all') return undefined;
  if (filter === 'success') return 'COMPLETED';
  if (filter === 'inProgress') return 'PENDING'; // ou PROCESSING — l'API peut accepter un seul
  if (filter === 'failed') return 'FAILED'; // ou REFUNDED
  return undefined;
}

export interface UsePaymentHistoryReturn {
  payments: PaymentHistoryItem[];
  total: number;
  page: number;
  hasNextPage: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  refetch: () => void;
}

export function usePaymentHistory(
  tontineUid: string,
  filter: PaymentFilter = 'all'
): UsePaymentHistoryReturn {
  const userUid = useSelector((state: RootState) => selectUserUid(state));
  const statusParam = mapFilterToStatus(filter);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['payments', 'history', userUid, filter],
    queryFn: async ({ pageParam }) => {
      const res = await getPaymentHistory(pageParam, PAGE_SIZE, statusParam);
      return res;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.total / PAGE_SIZE);
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
    enabled: userUid !== null,
    staleTime: 5 * 60_000,
    gcTime: GC_TIME,
    networkMode: 'offlineFirst',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  });

  const allPages = data?.pages ?? [];
  const allItems = allPages.flatMap((p) => p.data);
  const filtered: PaymentHistoryItem[] = tontineUid
    ? allItems.filter((p) => p.tontineUid === tontineUid)
    : allItems;

  const total = data?.pages?.[0]?.total ?? 0;
  const page = data?.pages?.length ?? 0;

  return {
    payments: filtered,
    total,
    page,
    hasNextPage: hasNextPage ?? false,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  };
}
