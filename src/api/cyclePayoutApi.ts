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
  CyclePayoutOrganizerState,
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

function parseFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function parseNextDueDateIso(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const o = value as Record<string, unknown>;
    const d = o.date ?? o.isoDate ?? o.iso ?? o.value;
    if (typeof d === 'string') return d;
  }
  return undefined;
}

function parsePayoutOrganizerStatePayload(raw: unknown): CyclePayoutOrganizerState {
  if (raw == null || typeof raw !== 'object') {
    throw new ApiError(
      ApiErrorCode.SERVER_ERROR,
      500,
      'Réponse payout-organizer-state invalide.'
    );
  }
  const o = raw as Record<string, unknown>;
  const cycleUid = o.cycleUid;
  if (typeof cycleUid !== 'string' || cycleUid.length === 0) {
    throw new ApiError(
      ApiErrorCode.SERVER_ERROR,
      500,
      'Réponse payout-organizer-state invalide (cycleUid).'
    );
  }
  const isCollectionComplete = o.isCollectionComplete === true;
  const completionPercent = parseFiniteNumber(o.completionPercent);
  const canOrganizerTriggerPayout = o.canOrganizerTriggerPayout === true;
  const netPayoutAmount = parseFiniteNumber(o.netPayoutAmount);
  const grossCollectedAmount = parseFiniteNumber(o.grossCollectedAmount);
  if (completionPercent === undefined) {
    throw new ApiError(
      ApiErrorCode.SERVER_ERROR,
      500,
      'Réponse payout-organizer-state invalide (completionPercent).'
    );
  }
  if (netPayoutAmount === undefined || grossCollectedAmount === undefined) {
    throw new ApiError(
      ApiErrorCode.SERVER_ERROR,
      500,
      'Réponse payout-organizer-state invalide (montants).'
    );
  }
  const beneficiaryPayoutStatus =
    o.beneficiaryPayoutStatus != null ? String(o.beneficiaryPayoutStatus) : undefined;
  const payoutOutboxUid =
    o.payoutOutboxUid != null ? String(o.payoutOutboxUid) : undefined;
  const nextDue = parseNextDueDateIso(o.nextDueDate);
  const rawBn = o.beneficiaryName;
  let beneficiaryName: string | null | undefined;
  if (rawBn === null) beneficiaryName = null;
  else if (typeof rawBn === 'string') {
    const t = rawBn.trim();
    beneficiaryName = t === '' ? null : t;
  }
  const out: CyclePayoutOrganizerState = {
    cycleUid,
    isCollectionComplete,
    completionPercent,
    canOrganizerTriggerPayout,
    netPayoutAmount,
    grossCollectedAmount,
  };
  if (beneficiaryPayoutStatus !== undefined) out.beneficiaryPayoutStatus = beneficiaryPayoutStatus;
  if (payoutOutboxUid !== undefined) out.payoutOutboxUid = payoutOutboxUid;
  if (nextDue !== undefined) out.nextDueDate = nextDue;
  if (beneficiaryName !== undefined) out.beneficiaryName = beneficiaryName;
  return out;
}

/**
 * GET /v1/cycles/:cycleUid/payout-organizer-state — montant net et éligibilité réels pour le versement organisateur.
 */
export async function getPayoutOrganizerState(
  cycleUid: string
): Promise<CyclePayoutOrganizerState> {
  try {
    const { url } = ENDPOINTS.CYCLES.PAYOUT_ORGANIZER_STATE(cycleUid);
    const res = await apiClient.get<unknown>(url);
    return parsePayoutOrganizerStatePayload(res.data);
  } catch (err: unknown) {
    if (ApiError.isApiError(err)) throw err;
    logger.error('[cyclePayout] getPayoutOrganizerState failed', { cycleUid });
    throw parseApiError(err);
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
