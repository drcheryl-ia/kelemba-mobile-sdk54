import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { apiClient } from '@/api/apiClient';
import { ENDPOINTS } from '@/api/endpoints';
import { logger } from '@/utils/logger';
import { decrementUnread } from '@/store/slices/notificationsSlice';
import type {
  Notification,
  NotificationsPage,
  UnreadCountResponse,
} from '@/types/notification.types';

const PAGE_SIZE = 20;

export function useNotifications() {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isError,
    refetch,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn: async ({ pageParam = 1 }): Promise<NotificationsPage> => {
      try {
        const { data: res } = await apiClient.get<NotificationsPage>(
          ENDPOINTS.NOTIFICATIONS.LIST.url,
          {
            params: { page: pageParam, pageSize: PAGE_SIZE },
          }
        );

        if (!res || !Array.isArray(res.items)) {
          logger.error('useNotifications: réponse API invalide', res);
          return {
            items: [],
            total: 0,
            page: pageParam as number,
            pageSize: PAGE_SIZE,
            totalPages: 0,
          };
        }

        return res;
      } catch (err: unknown) {
        logger.error('useNotifications: fetch failed', err);
        throw err;
      }
    },
    getNextPageParam: (last) =>
      last && last.page < (last.totalPages ?? 0) ? last.page + 1 : undefined,
    initialPageParam: 1,
    staleTime: 30_000,
  });

  const allNotifications: Notification[] =
    data?.pages
      .flatMap((p) => p.items ?? [])
      .filter(
        (n): n is Notification =>
          n != null && typeof n.createdAt === 'string'
      ) ?? [];

  const markAsReadMutation = useMutation({
    mutationFn: (uid: string) =>
      apiClient.patch(ENDPOINTS.NOTIFICATIONS.MARK_READ(uid).url),
    onMutate: async (uid) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const snapshot = queryClient.getQueryData<{
        pages: NotificationsPage[];
        pageParams: unknown[];
      }>(['notifications']);
      if (snapshot) {
        queryClient.setQueryData(['notifications'], {
          ...snapshot,
          pages: snapshot.pages.map((page) => ({
            ...page,
            items: (page.items ?? []).filter((n) => n != null && n.uid !== uid),
          })),
        });
      }
      dispatch(decrementUnread());
      return { snapshot };
    },
    onError: (_err, _uid, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(['notifications'], context.snapshot);
      }
      logger.error('markAsRead failed');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async (): Promise<UnreadCountResponse> => {
      const { data: res } = await apiClient.get<UnreadCountResponse>(
        ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT.url
      );
      return res;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return {
    allNotifications,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isError,
    refetch,
    isFetchingNextPage,
    markAsReadMutation,
    unreadData,
  };
}
