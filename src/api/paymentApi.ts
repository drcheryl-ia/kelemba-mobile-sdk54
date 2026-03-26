/**
 * API paiements — prochain paiement dû, historique, initiation Mobile Money.
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
import { parseNextPaymentPayload } from '@/utils/nextPaymentUi';

export interface PaymentHistoryResponse {
  data: PaymentHistoryItem[];
  total: number;
  page: number;
  limit: number;
}

/** Réponse brute API (Nest) — peut exposer `payments` ou `data` pour la liste. */
type PaymentHistoryApiPayload = PaymentHistoryResponse & {
  payments?: unknown[];
  pageSize?: number;
};

/**
 * Récupère le prochain paiement dû de l'utilisateur connecté.
 * @returns NextPaymentData si HTTP 200, null si HTTP 204 (aucun paiement en attente)
 * @throws Erreurs 401/403/404/5xx — non interceptées, remontées pour React Query
 */
export async function getNextPayment(): Promise<NextPaymentData | null> {
  const { url } = ENDPOINTS.USERS.NEXT_PAYMENT;
  try {
    const response = await apiClient.get<unknown>(url);
    if (response.status === 204) {
      return null;
    }
    return parseNextPaymentPayload(response.data);
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

/** Filtres optionnels historique — alignés sur le contrat backend (champs ignorés si non supportés). */
export interface PaymentHistoryFilters {
  /** ISO date (début de période) */
  from?: string;
  /** ISO date (fin de période) */
  to?: string;
  method?: string;
  /** Tri par date côté serveur ; défaut décroissant */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Historique paginé des paiements de l'utilisateur connecté.
 * GET /api/v1/payments/my-history?page=1&pageSize=20&status=...&from=&to=&method=&sortOrder=
 */
export async function getPaymentHistory(
  page: number,
  pageSize: number,
  status?: string,
  filters?: PaymentHistoryFilters
): Promise<PaymentHistoryResponse> {
  const { url } = ENDPOINTS.PAYMENTS.MY_HISTORY;
  try {
    const params: Record<string, number | string> = {
      page,
      pageSize,
      sortOrder: filters?.sortOrder ?? 'desc',
    };
    if (status != null && status !== '') {
      params.status = status;
    }
    if (filters?.from != null && filters.from !== '') {
      params.from = filters.from;
    }
    if (filters?.to != null && filters.to !== '') {
      params.to = filters.to;
    }
    if (filters?.method != null && filters.method !== '') {
      params.method = filters.method;
    }
    const response = await apiClient.get<PaymentHistoryApiPayload>(url, {
      params,
    });
    const data = response.data;
    const rawItems = Array.isArray(data?.payments)
      ? data.payments
      : Array.isArray(data?.data)
        ? data.data
        : [];
    const items: PaymentHistoryItem[] = rawItems.map((item: unknown) => {
      const r = item as Record<string, unknown>;
      const memberUserUidRaw =
        r.memberUserUid ?? r.memberUid ?? r.payerUserUid ?? r.userUid;
      const memberUserUid =
        memberUserUidRaw != null && String(memberUserUidRaw) !== ''
          ? String(memberUserUidRaw)
          : undefined;
      const cashAutoValidated =
        r.cashAutoValidated === true ||
        r.autoValidated === true ||
        r.validationSource === 'SYSTEM' ||
        r.validationSource === 'AUTO';
      const part = Number(r.amount ?? 0);
      const pen = Number(r.penalty ?? 0);
      const totalPaidRaw = r.totalPaid;
      const totalPaid =
        totalPaidRaw != null && String(totalPaidRaw) !== ''
          ? Number(totalPaidRaw)
          : part + pen;
      return {
        uid: String(r.uid ?? r.id ?? ''),
        cycleUid: r.cycleUid != null ? String(r.cycleUid) : undefined,
        amount: part,
        penalty: pen,
        totalPaid,
        method: (r.method as PaymentHistoryItem['method']) ?? 'SYSTEM',
        status: (r.status as PaymentHistoryItem['status']) ?? 'PENDING',
        paidAt: (r.paidAt as string | null) ?? null,
        createdAt: r.createdAt != null ? String(r.createdAt) : undefined,
        cycleNumber: Number(r.cycleNumber ?? 0),
        tontineUid: String(r.tontineUid ?? r.tontineId ?? ''),
        tontineName: String(r.tontineName ?? ''),
        memberUserUid,
        cashAutoValidated,
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
 * Initier un paiement Mobile Money (cotisation).
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
