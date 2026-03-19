/**
 * Hook — polling du statut d'un paiement.
 * GET /api/v1/payments/:id/status toutes les 3s, max 40 tentatives (2 min).
 */
import { useState, useEffect, useRef } from 'react';
import { getPaymentStatus } from '@/api/paymentApi';
import { logger } from '@/utils/logger';
import type { PaymentStatusDto } from '@/types/payment';
import type { PaymentStatus } from '@/types/domain.types';

const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_ATTEMPTS = 40;
const TERMINAL_STATUSES: PaymentStatus[] = ['COMPLETED', 'FAILED', 'REFUNDED'];

export interface UsePaymentPollingResult {
  status: PaymentStatus | 'TIMEOUT';
  data: PaymentStatusDto | null;
  isTimeout: boolean;
  attempts: number;
  maxAttempts: number;
}

export function usePaymentPolling(paymentUid: string): UsePaymentPollingResult {
  const [status, setStatus] = useState<PaymentStatus | 'TIMEOUT'>('PENDING');
  const [data, setData] = useState<PaymentStatusDto | null>(null);
  const [attempts, setAttempts] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const statusRef = useRef<PaymentStatus | 'TIMEOUT'>('PENDING');
  const attemptsRef = useRef(0);

  statusRef.current = status;
  attemptsRef.current = attempts;

  useEffect(() => {
    mountedRef.current = true;

    const poll = async () => {
      if (!mountedRef.current) return;
      const currentAttempts = attemptsRef.current;
      if (currentAttempts >= MAX_POLL_ATTEMPTS) return;
      if (TERMINAL_STATUSES.includes(statusRef.current as PaymentStatus) || statusRef.current === 'TIMEOUT') {
        return;
      }

      try {
        const result = await getPaymentStatus(paymentUid);
        if (!mountedRef.current) return;

        setData(result);
        setStatus(result.status);

        if (TERMINAL_STATUSES.includes(result.status)) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return;
        }
      } catch (err: unknown) {
        logger.error('[Kelemba] usePaymentPolling request failed', {
          paymentUid,
          attempts: attemptsRef.current,
        });
      }

      if (!mountedRef.current) return;
      setAttempts((a) => {
        const next = a + 1;
        if (next >= MAX_POLL_ATTEMPTS) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setStatus('TIMEOUT');
        }
        return next;
      });
    };

    void poll();

    intervalRef.current = setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [paymentUid]);

  return {
    status,
    data,
    isTimeout: status === 'TIMEOUT',
    attempts,
    maxAttempts: MAX_POLL_ATTEMPTS,
  };
}
