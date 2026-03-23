/**
 * Versement cagnotte organisateur — POST /v1/cycles/:cycleUid/payout
 * Complétion — GET /v1/cycles/:cycleUid/completion
 */
import { apiClient } from '@/api/apiClient';
import { ENDPOINTS } from '@/api/endpoints';
import { ApiError } from '@/api/errors/ApiError';
import { ApiErrorCode } from '@/api/errors/errorCodes';
import { parseApiError } from '@/api/errors/errorHandler';
import { logger } from '@/utils/logger';
import type {
  CycleCompletionInfo,
  CyclePayoutResponse,
  InitiateCyclePayoutDto,
} from '@/types/cyclePayout';
import type { PaymentStatus } from '@/types/domain.types';

const MIN_SECURITY_TOKEN_LEN = 32;

function parseStepUpTokenPayload(raw: unknown): string {
  if (raw == null || typeof raw !== 'object') return '';
  const o = raw as Record<string, unknown>;
  const t = o.token ?? o.securityConfirmationToken ?? o.accessToken;
  return typeof t === 'string' ? t : '';
}

/**
 * POST /v1/cycles/:cycleUid/payout/step-up-token — JWT court après validation PIN.
 */
export async function issueCyclePayoutStepUpToken(
  cycleUid: string,
  pin: string
): Promise<string> {
  try {
    const { url } = ENDPOINTS.CYCLES.PAYOUT_STEP_UP_TOKEN(cycleUid);
    const res = await apiClient.post<unknown>(url, { pin });
    const token = parseStepUpTokenPayload(res.data);
    if (token.length < MIN_SECURITY_TOKEN_LEN) {
      logger.error('[cyclePayout] step-up token missing or too short', { cycleUid });
      throw new ApiError(
        ApiErrorCode.SECURITY_CONFIRMATION_INVALID,
        400,
        'Confirmation de sécurité indisponible. Réessayez après avoir saisi votre PIN.'
      );
    }
    return token;
  } catch (err: unknown) {
    if (ApiError.isApiError(err)) throw err;
    logger.error('[cyclePayout] issueCyclePayoutStepUpToken failed', { cycleUid });
    throw parseApiError(err);
  }
}

function parseCompletionPayload(raw: unknown): CycleCompletionInfo {
  if (raw == null || typeof raw !== 'object') {
    return { raw: {} };
  }
  const o = raw as Record<string, unknown>;
  const explicitKeys = [
    'isComplete',
    'collectionComplete',
    'isFullyCollected',
    'allMembersPaid',
  ] as const;
  const hasExplicit = explicitKeys.some((k) => o[k] !== undefined);
  const outstanding = o.outstandingMemberIds ?? o.defaulterIds;
  const base: CycleCompletionInfo = {
    outstandingMemberIds: Array.isArray(outstanding)
      ? outstanding.map((x) => String(x))
      : undefined,
    raw: o,
  };
  if (!hasExplicit) return base;
  const isComplete =
    o.isComplete === true ||
    o.collectionComplete === true ||
    o.isFullyCollected === true ||
    o.allMembersPaid === true;
  return { ...base, isComplete: Boolean(isComplete) };
}

export async function getCycleCompletion(
  cycleUid: string
): Promise<CycleCompletionInfo> {
  try {
    const { url } = ENDPOINTS.CYCLES.COMPLETION(cycleUid);
    const res = await apiClient.get<unknown>(url);
    return parseCompletionPayload(res.data);
  } catch (err: unknown) {
    const apiErr = parseApiError(err);
    logger.error('[cyclePayout] getCycleCompletion failed', { cycleUid });
    throw apiErr;
  }
}

function parsePayoutResponse(raw: unknown): CyclePayoutResponse {
  if (raw == null || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  const uid = o.paymentUid ?? o.paymentId ?? o.uid;
  const status = o.status as PaymentStatus | string | undefined;
  const ext =
    o.externalRef ?? o.txnId ?? o.transactionId ?? o.reference ?? o.operatorRef;
  const out: CyclePayoutResponse = {
    paymentUid: uid != null ? String(uid) : undefined,
    paymentId: o.paymentId != null ? String(o.paymentId) : undefined,
    status,
    externalRef: ext != null ? String(ext) : undefined,
    message: o.message != null ? String(o.message) : undefined,
  };
  return out;
}

export async function postCyclePayout(
  cycleUid: string,
  payload: InitiateCyclePayoutDto
): Promise<CyclePayoutResponse> {
  try {
    const { url } = ENDPOINTS.CYCLES.PAYOUT(cycleUid);
    const res = await apiClient.post<unknown>(url, payload);
    return parsePayoutResponse(res.data);
  } catch (err: unknown) {
    logger.error('[cyclePayout] postCyclePayout failed', { cycleUid });
    throw parseApiError(err);
  }
}
