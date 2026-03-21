/**
 * API paiements espèces — preuve, validation organisateur.
 */
import { apiClient } from '@/api/apiClient';
import { ENDPOINTS } from '@/api/endpoints';
import { parseApiError } from '@/api/errors/errorHandler';
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
  validationRequestUid: string;
  message: string;
}

export interface CashPendingItem {
  uid: string;
  submittedAt: string;
  receiptPhotoUrl: string | null;
  receiverName: string;
  latitude: number | null;
  longitude: number | null;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  payment: { uid: string; amount: number; createdAt: string };
  member: { uid: string; fullName: string; phone: string };
  cycle: { uid: string; cycleNumber: number; expectedDate: string };
}

export async function initiateCashPayment(
  payload: InitiateCashPayload
): Promise<CashInitiateResult> {
  try {
    const res = await apiClient.post<CashInitiateResult>(
      ENDPOINTS.PAYMENTS.CASH_INITIATE.url,
      payload
    );
    return res.data;
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
    logger.warn('[CashPayment] getCashPendingRequests failed', { tontineUid, err });
    return [];
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
