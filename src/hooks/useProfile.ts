import { useQueries } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { ENDPOINTS } from '@/api/endpoints';
import type { UserProfileDto } from '@/api/types/api.types';
import type {
  UserProfileResponseDto,
  ScoreResponseDto,
  ScoreStatsDto,
} from '@/types/user.types';
import type { TontineDto } from '@/api/types/api.types';

interface TontinesPage {
  items?: TontineDto[];
  data?: TontineDto[];
  total: number;
  page: number;
  pageSize?: number;
  totalPages?: number;
}

function normalizeProfile(
  dto: UserProfileDto
): UserProfileResponseDto {
  return {
    uid: dto.uid,
    phone: dto.phone,
    fullName: dto.fullName ?? '',
    role: dto.role,
    status: dto.status,
    kycStatus: dto.kycStatus,
    kelembScore: dto.kelembScore ?? 0,
    accountType: dto.accountType,
    lastLoginAt: dto.lastLoginAt ?? null,
    createdAt: dto.createdAt ?? new Date().toISOString(),
    tontinesCount: dto.tontinesCount ?? 0,
    activeAsMember: dto.activeAsMember ?? false,
  };
}

function normalizeScoreStats(
  stats: { totalPositive?: number; totalNegative?: number; totalEvents?: number; positiveEvents?: number; negativeEvents?: number; netDelta?: number }
): ScoreStatsDto {
  const totalPositive = stats.totalPositive ?? stats.positiveEvents ?? 0;
  const totalNegative = stats.totalNegative ?? stats.negativeEvents ?? 0;
  return {
    totalEvents: stats.totalEvents ?? totalPositive + totalNegative,
    positiveEvents: stats.positiveEvents ?? totalPositive,
    negativeEvents: stats.negativeEvents ?? totalNegative,
    netDelta: stats.netDelta ?? totalPositive - totalNegative,
  };
}

export interface ProfileData {
  userProfile: {
    data: UserProfileResponseDto | null;
    isLoading: boolean;
    error: unknown;
  };
  scoreData: {
    data: ScoreResponseDto | null;
    isLoading: boolean;
    error: unknown;
  };
  tontinesActive: {
    data: TontineDto[] | null;
    total: number;
    isLoading: boolean;
    error: unknown;
  };
  tontinesCompleted: {
    data: TontineDto[] | null;
    total: number;
    isLoading: boolean;
    error: unknown;
  };
  isAnyLoading: boolean;
  refetchAll: () => Promise<void>;
}

export function useProfile(): ProfileData {
  const results = useQueries({
    queries: [
      {
        queryKey: ['profile', 'me'],
        queryFn: async (): Promise<UserProfileResponseDto> => {
          const { data } = await apiClient.get<UserProfileDto>(
            ENDPOINTS.USERS.ME.url
          );
          return normalizeProfile(data);
        },
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: ['score', 'me'],
        queryFn: async (): Promise<ScoreResponseDto> => {
          const { data } = await apiClient.get<{
            uid: string;
            currentScore: number;
            scoreLabel: string;
            history: unknown[];
            stats: Record<string, number>;
          }>(ENDPOINTS.SCORE.MY_SCORE.url);
          return {
            uid: data.uid,
            currentScore: data.currentScore,
            scoreLabel: data.scoreLabel as ScoreResponseDto['scoreLabel'],
            history: data.history as ScoreResponseDto['history'],
            stats: normalizeScoreStats(data.stats ?? {}),
          };
        },
        staleTime: 2 * 60 * 1000,
      },
      {
        queryKey: ['tontines', 'active'],
        queryFn: async (): Promise<{ items: TontineDto[]; total: number }> => {
          const { data } = await apiClient.get<TontinesPage>(
            ENDPOINTS.TONTINES.LIST.url,
            { params: { status: 'ACTIVE', limit: 50, page: 1 } }
          );
          const items = data.items ?? data.data ?? [];
          return { items, total: data.total ?? items.length };
        },
        staleTime: 2 * 60 * 1000,
      },
      {
        queryKey: ['tontines', 'completed'],
        queryFn: async (): Promise<{ items: TontineDto[]; total: number }> => {
          const { data } = await apiClient.get<TontinesPage>(
            ENDPOINTS.TONTINES.LIST.url,
            { params: { status: 'COMPLETED', limit: 50, page: 1 } }
          );
          const items = data.items ?? data.data ?? [];
          return { items, total: data.total ?? items.length };
        },
        staleTime: 2 * 60 * 1000,
      },
    ],
  });

  const [profile, score, tontinesActive, tontinesCompleted] = results;

  const tontinesActiveData = tontinesActive.data as
    | { items: TontineDto[]; total: number }
    | undefined;
  const tontinesCompletedData = tontinesCompleted.data as
    | { items: TontineDto[]; total: number }
    | undefined;

  return {
    userProfile: {
      data: profile.data ?? null,
      isLoading: profile.isLoading,
      error: profile.error,
    },
    scoreData: {
      data: score.data ?? null,
      isLoading: score.isLoading,
      error: score.error,
    },
    tontinesActive: {
      data: tontinesActiveData?.items ?? null,
      total: tontinesActiveData?.total ?? 0,
      isLoading: tontinesActive.isLoading,
      error: tontinesActive.error,
    },
    tontinesCompleted: {
      data: tontinesCompletedData?.items ?? null,
      total: tontinesCompletedData?.total ?? 0,
      isLoading: tontinesCompleted.isLoading,
      error: tontinesCompleted.error,
    },
    isAnyLoading: results.some((r) => r.isLoading),
    refetchAll: async () => {
      await Promise.all(results.map((r) => r.refetch()));
    },
  };
}
