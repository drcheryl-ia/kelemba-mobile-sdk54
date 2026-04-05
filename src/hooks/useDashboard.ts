import { useQueries } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { ENDPOINTS } from '@/api/endpoints';
import { parseApiError } from '@/api/errors/errorHandler';
import { logger } from '@/utils/logger';
import type {
  UserProfileDto,
  ScoreResponseDto,
  TontineDto,
  PaymentDto,
  PaginatedResponse,
} from '@/api/types/api.types';

export interface DashboardData {
  profile: { data: UserProfileDto | null; isLoading: boolean; error: unknown };
  scoreData: { data: ScoreResponseDto | null; isLoading: boolean; error: unknown };
  tontines: {
    data: PaginatedResponse<TontineDto> | null;
    isLoading: boolean;
    error: unknown;
  };
  payments: {
    data: PaginatedResponse<PaymentDto> | null;
    isLoading: boolean;
    error: unknown;
  };
  unreadCount: {
    data: { count: number } | null;
    isLoading: boolean;
    error: unknown;
  };
  isAnyLoading: boolean;
  refetchAll: () => Promise<void>;
}

export function useDashboard(): DashboardData {
  const results = useQueries({
    queries: [
      {
        queryKey: ['profile', 'me'],
        queryFn: async (): Promise<UserProfileDto> => {
          try {
            const { data } = await apiClient.get<UserProfileDto>(
              ENDPOINTS.USERS.ME.url
            );
            return data;
          } catch (err: unknown) {
            logger.error('useDashboard: profile fetch failed', {
              url: ENDPOINTS.USERS.ME.url,
            });
            throw parseApiError(err);
          }
        },
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: ['score', 'me'],
        queryFn: async (): Promise<ScoreResponseDto> => {
          try {
            const { data } = await apiClient.get<ScoreResponseDto>(
              ENDPOINTS.SCORE.MY_SCORE.url
            );
            return data;
          } catch (err: unknown) {
            logger.error('useDashboard: score fetch failed', {
              url: ENDPOINTS.SCORE.MY_SCORE.url,
            });
            throw parseApiError(err);
          }
        },
        staleTime: 2 * 60 * 1000,
      },
      {
        queryKey: ['tontines', 'active'],
        queryFn: async (): Promise<PaginatedResponse<TontineDto>> => {
          try {
            const { data } = await apiClient.get<PaginatedResponse<TontineDto>>(
              ENDPOINTS.TONTINES.LIST.url,
              { params: { status: 'ACTIVE', limit: 10, page: 1 } }
            );
            return data;
          } catch (err: unknown) {
            logger.error('useDashboard: tontines fetch failed');
            throw parseApiError(err);
          }
        },
        staleTime: 2 * 60 * 1000,
      },
      {
        queryKey: ['payments', 'pending'],
        queryFn: async (): Promise<PaginatedResponse<PaymentDto>> => {
          try {
            const { data } = await apiClient.get<PaginatedResponse<PaymentDto>>(
              ENDPOINTS.PAYMENTS.MY_HISTORY.url,
              { params: { status: 'PENDING', pageSize: 5, page: 1 } }
            );
            return data;
          } catch (err: unknown) {
            logger.error('useDashboard: payments fetch failed');
            throw parseApiError(err);
          }
        },
        staleTime: 60 * 1000,
      },
      {
        queryKey: ['notifications', 'unread-count'],
        queryFn: async (): Promise<{ count: number }> => {
          try {
            const { data } = await apiClient.get<{ count: number }>(
              ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT.url
            );
            return data;
          } catch (err: unknown) {
            logger.error('useDashboard: notifications fetch failed');
            throw parseApiError(err);
          }
        },
        staleTime: 15_000,
      },
    ],
  });

  const [profile, score, tontines, payments, unreadCount] = results;

  return {
    profile: {
      data: profile.data ?? null,
      isLoading: profile.isLoading,
      error: profile.error,
    },
    scoreData: {
      data: score.data ?? null,
      isLoading: score.isLoading,
      error: score.error,
    },
    tontines: {
      data: tontines.data ?? null,
      isLoading: tontines.isLoading,
      error: tontines.error,
    },
    payments: {
      data: payments.data ?? null,
      isLoading: payments.isLoading,
      error: payments.error,
    },
    unreadCount: {
      data: unreadCount.data ?? null,
      isLoading: unreadCount.isLoading,
      error: unreadCount.error,
    },
    isAnyLoading: results.some((r) => r.isLoading),
    refetchAll: async () => {
      await Promise.all(results.map((r) => r.refetch()));
    },
  };
}
