/**
 * Persistent offline queue for payments, compatible with Expo Go.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { ENDPOINTS } from '@/api/endpoints';
import { apiClient } from '@/api/apiClient';
import { parseApiError } from '@/api/errors/errorHandler';
import { logger } from '@/utils/logger';
import type { InitiatePaymentPayload } from '@/types/payment';

export interface QueuedPayment {
  id: string;
  payload: InitiatePaymentPayload;
  tontineName: string;
  cycleNumber: number;
  enqueuedAt: number;
  expiresAt: number;
  attempts: number;
}

export interface ProcessQueueResult {
  processed: number;
  failed: number;
  expired: number;
  skipped: number;
}

const QUEUE_KEY = 'kelemba_offline_payment_queue';
const ENTRY_TTL_MS = 86_400_000;
const MAX_ATTEMPTS = 3;
const PROCESS_DELAY_MS = 1_500;

async function readQueue(): Promise<QueuedPayment[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as QueuedPayment[];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedPayment[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function addToQueue(
  payload: InitiatePaymentPayload,
  tontineName: string,
  cycleNumber: number
): Promise<void> {
  const now = Date.now();
  const entry: QueuedPayment = {
    id: crypto.randomUUID(),
    payload,
    tontineName,
    cycleNumber,
    enqueuedAt: now,
    expiresAt: now + ENTRY_TTL_MS,
    attempts: 0,
  };

  const queue = await readQueue();
  queue.push(entry);
  await writeQueue(queue);

  logger.error('[OfflineQueue] Paiement mis en file', {
    id: entry.id,
    cycleUid: payload.cycleUid,
    amount: payload.amount,
    expiresAt: new Date(entry.expiresAt).toISOString(),
  });
}

export async function processQueue(): Promise<ProcessQueueResult> {
  const result: ProcessQueueResult = {
    processed: 0,
    failed: 0,
    expired: 0,
    skipped: 0,
  };

  const now = Date.now();
  let queue = await readQueue();

  const expired = queue.filter((entry) => entry.expiresAt <= now);
  result.expired = expired.length;
  queue = queue.filter((entry) => entry.expiresAt > now);

  const tooManyAttempts = queue.filter((entry) => entry.attempts >= MAX_ATTEMPTS);
  result.skipped = tooManyAttempts.length;
  queue = queue.filter((entry) => entry.attempts < MAX_ATTEMPTS);

  if (queue.length === 0) {
    await writeQueue([]);
    return result;
  }

  const remaining: QueuedPayment[] = [];

  for (const entry of queue) {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      remaining.push(entry);
      continue;
    }

    entry.attempts += 1;

    try {
      await apiClient.post(ENDPOINTS.PAYMENTS.INITIATE.url, entry.payload);
      result.processed += 1;
      logger.error('[OfflineQueue] Paiement traite', {
        id: entry.id,
        tontineName: entry.tontineName,
        cycleNumber: entry.cycleNumber,
        amount: entry.payload.amount,
      });
    } catch (err: unknown) {
      const apiErr = parseApiError(err);

      if (apiErr.httpStatus === 409) {
        result.processed += 1;
      } else if (
        apiErr.httpStatus === 400 ||
        apiErr.httpStatus === 403 ||
        apiErr.httpStatus === 404
      ) {
        result.failed += 1;
        logger.error('[OfflineQueue] Paiement echoue non recuperable', {
          id: entry.id,
          code: apiErr.code,
        });
      } else {
        remaining.push(entry);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, PROCESS_DELAY_MS));
  }

  await writeQueue(remaining);
  return result;
}

export async function getQueueLength(): Promise<number> {
  const now = Date.now();
  return (await readQueue()).filter((entry) => entry.expiresAt > now).length;
}

export async function clearQueue(): Promise<void> {
  await writeQueue([]);
}

export async function getQueueEntries(): Promise<QueuedPayment[]> {
  const now = Date.now();
  return (await readQueue()).filter((entry) => entry.expiresAt > now);
}

export function startOfflineQueueListener(): () => void {
  const unsubscribe = NetInfo.addEventListener(async (state) => {
    const queueLength = await getQueueLength();
    if (state.isConnected && queueLength > 0) {
      logger.error('[OfflineQueue] Reconnexion detectee - traitement de la file', {
        queueLength,
      });
      const result = await processQueue();
      logger.error('[OfflineQueue] Traitement termine', result);
    }
  });

  return unsubscribe;
}
