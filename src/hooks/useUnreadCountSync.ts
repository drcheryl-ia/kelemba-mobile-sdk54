import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { apiClient } from '@/api/apiClient';
import { ENDPOINTS } from '@/api/endpoints';
import { setUnreadCount } from '@/store/slices/notificationsSlice';
import type { UnreadCountResponse } from '@/types/notification.types';

/**
 * Sync le compteur de notifications non lues vers Redux.
 * À utiliser dans MainTabs pour mettre à jour le badge.
 */
export function useUnreadCountSync(): void {
  const dispatch = useDispatch();

  const { data } = useQuery({
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

  useEffect(() => {
    if (data !== undefined) {
      dispatch(setUnreadCount(data.count));
    }
  }, [data, dispatch]);
}
