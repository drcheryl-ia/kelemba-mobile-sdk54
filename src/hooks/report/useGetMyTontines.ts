/**
 * Liste des tontines du membre — alias typé pour l’écran Rapport.
 */
import { useTontines } from '@/hooks/useTontines';

export function useGetMyTontines() {
  const { tontines, isLoading, isFetching, isError, refetch } = useTontines({
    includeInvitations: false,
  });
  return {
    data: { tontines },
    isLoading,
    isFetching,
    isError,
    refetch,
  };
}
