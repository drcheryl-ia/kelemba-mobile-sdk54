/**
 * Hook — recherche utilisateur par téléphone (lookup).
 */
import { useQuery } from '@tanstack/react-query';
import { lookupUser } from '@/api/usersApi';
import type { UserLookupResult } from '@/types/invite';

export interface UseUserLookupReturn {
  user: UserLookupResult | undefined;
  isLoading: boolean;
  isError: boolean;
  isNotFound: boolean;
  error: Error | null;
  refetch: () => void;
  reset: () => void;
}

export function useUserLookup(phone: string): UseUserLookupReturn {
  const isValidPhone = !!phone && /^\+236\d{8}$/.test(phone);
  const {
    data: user,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['userLookup', phone],
    queryFn: () => lookupUser(phone),
    enabled: isValidPhone,
    staleTime: 60_000,
    retry: false,
  });

  const isNotFound =
    isError &&
    error instanceof Error &&
    'httpStatus' in error &&
    (error as { httpStatus?: number }).httpStatus === 404;

  return {
    user,
    isLoading: isLoading || isFetching,
    isError,
    isNotFound: !!isNotFound,
    error: error instanceof Error ? error : null,
    refetch,
    reset: () => {},
  };
}
