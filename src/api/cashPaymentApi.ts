/**
 * API paiements espèces — preuve, validation organisateur.
 */
import { apiClient } from '@/api/apiClient';
import { ENDPOINTS } from '@/api/endpoints';
import { parseApiError } from '@/api/errors/errorHandler';
import type { PaymentStatus } from '@/types/payment';
import { logger } from '@/utils/logger';

export interface InitiateCashPayload {
  cycleUid: string;
  amount: number;
  idempotencyKey: string;
  receiverName: string;
  receiptPhotoUrl?: string;
  latitude?: number;
  longitude?: number;
}

export interface CashInitiateResult {
  paymentUid: string;
  validationRequestUid: string | null;
  message: string;
  status: PaymentStatus;
}

export interface CashPendingItem {
  uid: string;
  submittedAt: string;
  receiptPhotoUrl: string | null;
  receiverName: string;
  latitude: number | null;
  longitude: number | null;
  status: 'PENDING_REVIEW' | 'PENDING_VALIDATION' | 'APPROVED' | 'REJECTED';
  payment: { uid: string; amount: number; createdAt: string };
  member: { uid: string; fullName: string; phone: string };
  cycle: { uid: string; cycleNumber: number; expectedDate: string };
}

/** GET /payments/cash/pending-actions — corps JSON (contrat plat). */
export type OrganizerCashPendingPaymentMethod =
  | 'CASH'
  | 'ORANGE_MONEY'
  | 'TELECEL_MONEY'
  | 'SYSTEM';

export type OrganizerCashPendingValidationStatus =
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED';

/** Action organisateur — liste agrégée (GET …/pending-actions). */
export interface OrganizerCashPendingAction {
  validationRequestUid: string;
  paymentUid: string;
  tontineUid: string;
  tontineName: string;
  cycleUid: string;
  cycleNumber: number;
  memberUid: string;
  memberName: string;
  memberPhone: string;
  submittedAt: string;
  amount: number;
  /** Part cotisation (hors pénalité), si exposé par l’API. */
  baseAmount?: number;
  penaltyAmount?: number;
  /** Total réel à valider (part + pénalité), si exposé par l’API. */
  totalAmount?: number;
  paymentMethod: OrganizerCashPendingPaymentMethod;
  status: OrganizerCashPendingValidationStatus | string;
  receiptPhotoUrl: string | null;
  receiverName: string;
  latitude: number | null;
  longitude: number | null;
}

function optionalFiniteNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseOrganizerCashPaymentMethod(
  raw: unknown
): OrganizerCashPendingPaymentMethod {
  const s = raw == null ? 'CASH' : String(raw);
  if (
    s === 'ORANGE_MONEY' ||
    s === 'TELECEL_MONEY' ||
    s === 'CASH' ||
    s === 'SYSTEM'
  ) {
    return s;
  }
  return 'CASH';
}

function normalizeOrganizerCashPendingAction(raw: unknown): OrganizerCashPendingAction | null {
  if (raw == null || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const payment = r.payment as Record<string, unknown> | undefined;
  const member = r.member as Record<string, unknown> | undefined;
  const cycle = r.cycle as Record<string, unknown> | undefined;
  const tontine = r.tontine as Record<string, unknown> | undefined;
  const validation = r.validation as Record<string, unknown> | undefined;
  const validationRequest = r.validationRequest as Record<string, unknown> | undefined;

  const paymentUid = String(r.paymentUid ?? payment?.uid ?? '');
  if (paymentUid === '') return null;

  const validationRequestUid = String(
    r.validationRequestUid ?? validationRequest?.uid ?? ''
  );

  const memberUidFlat = r.memberUid != null ? String(r.memberUid) : '';
  const memberUid =
    memberUidFlat !== ''
      ? memberUidFlat
      : member?.uid != null
        ? String(member.uid)
        : '';

  const amount = Number(r.amount ?? payment?.amount ?? 0);
  const baseAmount = optionalFiniteNumber(
    r.baseAmount ?? (payment != null ? (payment as Record<string, unknown>).baseAmount : undefined)
  );
  const penaltyAmount = optionalFiniteNumber(
    r.penaltyAmount ??
      r.penalty ??
      (payment != null ? (payment as Record<string, unknown>).penaltyAmount : undefined)
  );
  const totalAmount = optionalFiniteNumber(
    r.totalAmount ?? (payment != null ? (payment as Record<string, unknown>).totalAmount : undefined)
  );
  const cycleNumber = Number(r.cycleNumber ?? cycle?.cycleNumber ?? 0);
  const cycleUid = String(r.cycleUid ?? cycle?.uid ?? '');

  const memberName = String(r.memberName ?? member?.fullName ?? '');
  const memberPhone = String(r.memberPhone ?? member?.phone ?? '');

  const statusRaw =
    r.status != null
      ? String(r.status)
      : r.validationStatus != null
        ? String(r.validationStatus)
        : validation?.status != null
          ? String(validation.status)
          : validationRequest?.status != null
            ? String(validationRequest.status)
            : 'PENDING_REVIEW';

  const receiverFromPayment =
    payment != null && 'receiverName' in payment
      ? (payment as { receiverName?: string }).receiverName
      : undefined;

  const row: OrganizerCashPendingAction = {
    validationRequestUid,
    paymentUid,
    tontineUid: String(r.tontineUid ?? tontine?.uid ?? ''),
    tontineName: String(r.tontineName ?? tontine?.name ?? ''),
    cycleUid,
    cycleNumber,
    memberUid,
    memberName,
    memberPhone,
    submittedAt: String(r.submittedAt ?? payment?.createdAt ?? ''),
    amount,
    paymentMethod: parseOrganizerCashPaymentMethod(
      r.paymentMethod ?? (payment != null ? (payment as { method?: unknown }).method : undefined)
    ),
    status: statusRaw,
    receiptPhotoUrl:
      r.receiptPhotoUrl != null
        ? String(r.receiptPhotoUrl)
        : payment?.receiptPhotoUrl != null
          ? String(payment.receiptPhotoUrl)
          : null,
    receiverName: String(r.receiverName ?? receiverFromPayment ?? ''),
    latitude: optionalFiniteNumber(r.latitude ?? payment?.latitude),
    longitude: optionalFiniteNumber(r.longitude ?? payment?.longitude),
  };
  if (baseAmount != null) row.baseAmount = baseAmount;
  if (penaltyAmount != null) row.penaltyAmount = penaltyAmount;
  if (totalAmount != null) row.totalAmount = totalAmount;
  return row;
}

/** Extrait le tableau d’actions depuis la réponse GET pending-actions (rétrocompat). */
function extractOrganizerPendingActionsList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw == null || typeof raw !== 'object') return [];
  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.items)) return o.items;
  if (Array.isArray(o.data)) return o.data;
  return [];
}

export async function initiateCashPayment(
  payload: InitiateCashPayload
): Promise<CashInitiateResult> {
  try {
    const res = await apiClient.post<{
      paymentUid: string;
      validationRequestUid?: string | null;
      message?: string;
      status?: PaymentStatus;
    }>(
      ENDPOINTS.PAYMENTS.CASH_INITIATE.url,
      payload
    );
    return {
      paymentUid: res.data.paymentUid,
      validationRequestUid: res.data.validationRequestUid ?? null,
      message: res.data.message ?? '',
      status: res.data.status ?? 'PENDING',
    };
  } catch (err: unknown) {
    logger.error('[CashPayment] initiate failed', { err });
    throw parseApiError(err);
  }
}

type RNUploadFile = { uri: string; type: string; name: string };

export async function uploadReceiptPhoto(
  fileUri: string,
  mimeType: string
): Promise<{ url: string }> {
  const formData = new FormData();
  const file: RNUploadFile = {
    uri: fileUri,
    type: mimeType,
    name: 'receipt.jpg',
  };
  formData.append('file', file as unknown as Blob);
  try {
    const res = await apiClient.post<{ url: string }>(
      ENDPOINTS.PAYMENTS.CASH_UPLOAD_RECEIPT.url,
      formData
    );
    return res.data;
  } catch (err: unknown) {
    logger.error('[CashPayment] upload receipt failed', { err });
    throw parseApiError(err);
  }
}

export async function submitCashProof(
  paymentUid: string,
  payload: {
    receiptPhotoUrl: string;
    receiverName: string;
    latitude?: number;
    longitude?: number;
  }
): Promise<{ message: string }> {
  try {
    const ep = ENDPOINTS.PAYMENTS.CASH_SUBMIT_PROOF(paymentUid);
    const res = await apiClient.patch<{ message: string }>(ep.url, payload);
    return res.data;
  } catch (err: unknown) {
    logger.error('[CashPayment] submit proof failed', { paymentUid, err });
    throw parseApiError(err);
  }
}

export async function getCashPendingRequests(tontineUid: string): Promise<CashPendingItem[]> {
  try {
    const ep = ENDPOINTS.PAYMENTS.CASH_PENDING(tontineUid);
    const res = await apiClient.get<CashPendingItem[]>(ep.url);
    return Array.isArray(res.data) ? res.data : [];
  } catch (err: unknown) {
    const apiErr = parseApiError(err);
    if (apiErr.httpStatus === 404) return [];
    logger.warn('[CashPayment] getCashPendingRequests failed', { tontineUid });
    return [];
  }
}

/**
 * Validations espèces en attente pour l’organisateur connecté (toutes tontines).
 */
export async function getOrganizerCashPendingActions(): Promise<OrganizerCashPendingAction[]> {
  try {
    const { url } = ENDPOINTS.PAYMENTS.CASH_PENDING_ACTIONS;
    const res = await apiClient.get<unknown>(url);
    const list = extractOrganizerPendingActionsList(res.data);
    const out: OrganizerCashPendingAction[] = [];
    for (const item of list) {
      const n = normalizeOrganizerCashPendingAction(item);
      if (n != null) out.push(n);
    }
    return out;
  } catch (err: unknown) {
    const apiErr = parseApiError(err);
    if (apiErr.httpStatus === 404) return [];
    logger.warn('[CashPayment] getOrganizerCashPendingActions failed');
    throw apiErr;
  }
}

/**
 * Nombre de validations espèces en attente (organisateur).
 */
export async function getOrganizerCashPendingCount(): Promise<number> {
  try {
    const { url } = ENDPOINTS.PAYMENTS.CASH_PENDING_COUNT;
    const res = await apiClient.get<unknown>(url);
    const d = res.data;
    if (typeof d === 'number' && Number.isFinite(d)) return Math.max(0, Math.floor(d));
    if (d != null && typeof d === 'object' && 'count' in d) {
      const c = Number((d as { count: unknown }).count);
      return Number.isFinite(c) ? Math.max(0, Math.floor(c)) : 0;
    }
    return 0;
  } catch (err: unknown) {
    const apiErr = parseApiError(err);
    if (apiErr.httpStatus === 404) return 0;
    logger.warn('[CashPayment] getOrganizerCashPendingCount failed');
    throw apiErr;
  }
}

export async function validateCashPayment(
  paymentUid: string,
  action: 'APPROVE' | 'REJECT',
  rejectionReason?: string
): Promise<{ status: string; message: string }> {
  try {
    const ep = ENDPOINTS.PAYMENTS.CASH_VALIDATE(paymentUid);
    const res = await apiClient.post<{ status: string; message: string }>(ep.url, {
      action,
      rejectionReason,
    });
    return res.data;
  } catch (err: unknown) {
    logger.error('[CashPayment] validate failed', { paymentUid, action, err });
    throw parseApiError(err);
  }
}
