/**
 * API paiements — prochain paiement dû, historique, initiation.
 */
import { apiClient } from '@/api/apiClient';
import { ENDPOINTS } from '@/api/endpoints';
import { ApiErrorCode } from '@/api/errors/errorCodes';
import { parseApiError } from '@/api/errors/errorHandler';
import { logger } from '@/utils/logger';
import type {
  NextPaymentData,
  InitiatePaymentPayload,
  InitiatePaymentResponse,
  PaymentStatusDto,
} from '@/types/payment';
import type { PaymentHistoryItem } from '@/types/tontine';

export interface PaymentHistoryResponse {
  data: PaymentHistoryItem[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Récupère le prochain paiement dû de l'utilisateur connecté.
 * @returns NextPaymentData si HTTP 200, null si HTTP 204 (aucun paiement en attente)
 * @throws Erreurs 401/403/404/5xx — non interceptées, remontées pour React Query
 */
export async function getNextPayment(): Promise<NextPaymentData | null> {
  const { url } = ENDPOINTS.USERS.NEXT_PAYMENT;
  try {
    const response = await apiClient.get<NextPaymentData>(url);
    if (response.status === 204) {
      return null;
    }
    return response.data;
  } catch (err: unknown) {
    const apiErr = parseApiError(err);

    // 403 KYC_NOT_VERIFIED — état métier normal pour un utilisateur
    // dont le KYC n'est pas encore vérifié. Retourner null silencieusement.
    if (
      apiErr.httpStatus === 403 &&
      apiErr.code === ApiErrorCode.KYC_NOT_VERIFIED
    ) {
      return null;
    }

    // Toute autre erreur — logger et relancer
    logger.error('[Kelemba] useNextPayment: échec de récupération', {
      error: apiErr.message,
    });
    throw err;
  }
}

/**
 * Historique paginé des paiements de l'utilisateur connecté.
 * GET /api/v1/payments/my-history?page=1&pageSize=20&status=...
 */
export async function getPaymentHistory(
  page: number,
  pageSize: number,
  status?: string
): Promise<PaymentHistoryResponse> {
  const { url } = ENDPOINTS.PAYMENTS.MY_HISTORY;
  try {
    const params: Record<string, number | string> = { page, pageSize };
    if (status != null && status !== '') {
      params.status = status;
    }
    const response = await apiClient.get<PaymentHistoryResponse>(url, {
      params,
    });
    const data = response.data as PaymentHistoryResponse & { pageSize?: number };
    const rawItems = Array.isArray(data?.data) ? data.data : [];
    const items: PaymentHistoryItem[] = rawItems.map((item: unknown) => {
      const r = item as Record<string, unknown>;
      return {
        uid: String(r.uid ?? r.id ?? ''),
        cycleUid: r.cycleUid != null ? String(r.cycleUid) : undefined,
        amount: Number(r.amount ?? 0),
        penalty: Number(r.penalty ?? 0),
        totalPaid: Number(r.totalPaid ?? r.amount ?? 0),
        method: (r.method as PaymentHistoryItem['method']) ?? 'SYSTEM',
        status: (r.status as PaymentHistoryItem['status']) ?? 'PENDING',
        paidAt: (r.paidAt as string | null) ?? null,
        createdAt: r.createdAt != null ? String(r.createdAt) : undefined,
        cycleNumber: Number(r.cycleNumber ?? 0),
        tontineUid: String(r.tontineUid ?? r.tontineId ?? ''),
        tontineName: String(r.tontineName ?? ''),
      };
    });
    return {
      data: items,
      total: data?.total ?? 0,
      page: data?.page ?? page,
      limit: data?.limit ?? data?.pageSize ?? pageSize,
    };
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    logger.error('getPaymentHistory failed', { page, pageSize });
    throw apiError;
  }
}

/**
 * Initier un paiement (cotisation).
 * POST /api/v1/payments/initiate
 * @returns InitiatePaymentResponse avec uid du paiement créé
 */
export async function initiatePayment(
  payload: InitiatePaymentPayload
): Promise<InitiatePaymentResponse> {
  const { url } = ENDPOINTS.PAYMENTS.INITIATE;
  try {
    const res = await apiClient.post<InitiatePaymentResponse>(url, payload);
    return res.data;
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    if (apiError.httpStatus === 409) {
      throw err;
    }
    logger.error('[Kelemba] initiatePayment failed', {
      cycleUid: payload.cycleUid,
      code: apiError.code,
    });
    throw err;
  }
}

/**
 * Récupère le statut d'un paiement.
 * GET /api/v1/payments/:id/status
 */
export async function getPaymentStatus(paymentUid: string): Promise<PaymentStatusDto> {
  const { url } = ENDPOINTS.PAYMENTS.STATUS(paymentUid);
  try {
    const res = await apiClient.get<PaymentStatusDto>(url);
    return res.data;
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    logger.error('[Kelemba] getPaymentStatus failed', {
      paymentUid,
      code: apiError.code,
    });
    throw err;
  }
}
