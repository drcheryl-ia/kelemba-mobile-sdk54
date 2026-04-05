/**
 * Score Kelemba courant — GET /api/v1/score/me
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { ENDPOINTS } from '@/api/endpoints';
import { parseApiError } from '@/api/errors/errorHandler';
import type { ScoreResponseDto } from '@/types/user.types';
import { logger } from '@/utils/logger';

export function useGetScore() {
  return useQuery({
    queryKey: ['score', 'me'],
    queryFn: async (): Promise<ScoreResponseDto> => {
      try {
        const { data } = await apiClient.get<ScoreResponseDto>(ENDPOINTS.SCORE.MY_SCORE.url);
        return data;
      } catch (err: unknown) {
        logger.error('[useGetScore] fetch failed', {
          message: err instanceof Error ? err.message : String(err),
        });
        throw parseApiError(err);
      }
    },
    staleTime: 60_000,
  });
}
