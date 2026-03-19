/**
 * Hook — prochain paiement dû de l'utilisateur connecté.
 * Alimente le widget "Prochain paiement" du Dashboard.
 */
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { getNextPayment } from '@/api/paymentApi';
import { parseApiError } from '@/api/errors/errorHandler';
import { ApiErrorCode } from '@/api/errors/errorCodes';
import { selectUserUid } from '@/store/authSlice';
import type { RootState } from '@/store/store';
import type { NextPaymentData, UrgencyLevel } from '@/types/payment';

const MS_PER_DAY = 86_400_000;

function computeJoursRestants(dueDate: string): number {
  const parts = dueDate.split('-').map(Number);
  if (parts.length !== 3) return 0;
  const [y, m, d] = parts;
  const dueLocal = new Date(y, m - 1, d);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor(
    (dueLocal.getTime() - todayStart.getTime()) / MS_PER_DAY
  );
}

function deriveUrgencyLevel(joursRestants: number): UrgencyLevel {
  if (joursRestants > 5) return 'NORMAL';
  if (joursRestants >= 3) return 'BIENTÔT';
  if (joursRestants >= 0) return 'URGENT';
  return 'EN_RETARD';
}

export interface UseNextPaymentReturn {
  nextPayment: NextPaymentData | null;
  joursRestants: number | null;
  urgencyLevel: UrgencyLevel | null;
  isProcessing: boolean;
  hasPenalty: boolean;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useNextPayment(): UseNextPaymentReturn {
  const userUid = useSelector((state: RootState) => selectUserUid(state));

  const {
    data: nextPayment,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['nextPayment', userUid],
    queryFn: getNextPayment,
    enabled: userUid !== null,
    staleTime: 60_000,
    gcTime: 24 * 60 * 60 * 1000,
    networkMode: 'offlineFirst',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: (failureCount, err: unknown) => {
      const apiErr = parseApiError(err);
      if (apiErr.code === ApiErrorCode.KYC_NOT_VERIFIED) return false;
      return failureCount < 2;
    },
  });

  if (userUid === null) {
    return {
      nextPayment: null,
      joursRestants: null,
      urgencyLevel: null,
      isProcessing: false,
      hasPenalty: false,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch,
    };
  }

  const joursRestants =
    nextPayment?.dueDate != null
      ? computeJoursRestants(nextPayment.dueDate)
      : null;
  const urgencyLevel =
    joursRestants !== null ? deriveUrgencyLevel(joursRestants) : null;
  const isProcessing = nextPayment?.paymentStatus === 'PROCESSING' ?? false;
  const hasPenalty = (nextPayment?.penaltyAmount ?? 0) > 0;

  return {
    nextPayment: nextPayment ?? null,
    joursRestants,
    urgencyLevel,
    isProcessing,
    hasPenalty,
    isLoading,
    isFetching,
    isError,
    error: error instanceof Error ? error : null,
    refetch,
  };
}
