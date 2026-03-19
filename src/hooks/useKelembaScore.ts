import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { apiClient } from '@/api/apiClient';
import { ENDPOINTS } from '@/api/endpoints';
import { logger } from '@/utils/logger';
import { getScoreLevel, SCORE_COLOR } from '@/utils/scoreUtils';
import type { RootState } from '@/store/store';
import type { ScoreEventDto, ScoreStatsDto } from '@/types/user.types';
import type { ScoreLevel } from '@/utils/scoreUtils';

function normalizeStats(
  raw: Record<string, unknown> | undefined
): ScoreStatsDto | undefined {
  if (!raw) return undefined;
  const totalPositive =
    (raw.totalPositive as number) ?? (raw.positiveEvents as number) ?? 0;
  const totalNegative =
    (raw.totalNegative as number) ?? (raw.negativeEvents as number) ?? 0;
  return {
    totalEvents: (raw.totalEvents as number) ?? totalPositive + totalNegative,
    positiveEvents: (raw.positiveEvents as number) ?? totalPositive,
    negativeEvents: (raw.negativeEvents as number) ?? totalNegative,
    netDelta: (raw.netDelta as number) ?? totalPositive - totalNegative,
  };
}

export interface UseKelembaScoreReturn {
  score: number;
  scoreLabel: string;
  level: ScoreLevel;
  scoreColor: string;
  scoreHistory: ScoreEventDto[];
  stats: ScoreStatsDto | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

export function useKelembaScore(): UseKelembaScoreReturn {
  const navigation = useNavigation();
  const isBanned = useSelector(
    (s: RootState) => s.auth.currentUser?.status === 'BANNED'
  );

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['score', 'me'],
    queryFn: async () => {
      try {
        const { data: res } = await apiClient.get<{
          uid: string;
          currentScore: number;
          scoreLabel: string;
          history: ScoreEventDto[];
          stats: Record<string, unknown>;
        }>(ENDPOINTS.SCORE.MY_SCORE.url);

        if (!res || typeof res.currentScore !== 'number') {
          throw new Error('Score API: réponse invalide');
        }
        return res;
      } catch (err: unknown) {
        logger.error('useKelembaScore: fetch failed', err);
        throw err;
      }
    },
    staleTime: 600_000,
    enabled: !isBanned,
  });

  const score = data?.currentScore ?? 0;
  const level = getScoreLevel(score, isBanned);
  const scoreColor = SCORE_COLOR[level];
  const stats = normalizeStats(data?.stats as Record<string, unknown> | undefined);

  useEffect(() => {
    if (isBanned) {
      navigation.navigate('BannedScreen' as never);
    }
  }, [isBanned, navigation]);

  return {
    score,
    scoreLabel: (data?.scoreLabel as string) ?? 'CRITIQUE',
    level,
    scoreColor,
    scoreHistory: (data?.history as ScoreEventDto[]) ?? [],
    stats,
    isLoading,
    isError,
    error,
    refetch,
  };
}
