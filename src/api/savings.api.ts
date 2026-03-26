/**
 * API Tontines Épargne — création, dashboard, versements, retraits.
 */
import { apiClient } from '@/api/apiClient';
import { ENDPOINTS } from '@/api/endpoints';
import type {
  CreateSavingsTontinePayload,
  ContributeSavingsPayload,
  RequestWithdrawalPayload,
  SavingsDashboard,
  MyBalanceResponse,
  SavingsPeriod,
  SavingsContribution,
  SavingsWithdrawalPreview,
} from '@/types/savings.types';

/** Réponse GET périodes : tableau brut ou enveloppe { periods, data, items }. */
function parseSavingsPeriodsPayload(data: unknown): SavingsPeriod[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    const nested = o.periods ?? o.data ?? o.items ?? o.results;
    if (Array.isArray(nested)) return nested as SavingsPeriod[];
  }
  return [];
}

function parseSavingsContributionsPayload(data: unknown): SavingsContribution[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    const nested = o.contributions ?? o.data ?? o.items ?? o.results;
    if (Array.isArray(nested)) return nested as SavingsContribution[];
  }
  return [];
}

export const savingsApi = {
  listMy: () => apiClient.get(ENDPOINTS.SAVINGS.LIST.url).then((r) => r.data),

  create: (payload: CreateSavingsTontinePayload) =>
    apiClient.post(ENDPOINTS.SAVINGS.CREATE.url, payload).then((r) => r.data),

  join: (tontineUid: string) =>
    apiClient.post(ENDPOINTS.SAVINGS.JOIN(tontineUid).url).then((r) => r.data),

  getDashboard: (tontineUid: string): Promise<SavingsDashboard> =>
    apiClient.get(ENDPOINTS.SAVINGS.DASHBOARD(tontineUid).url).then((r) => r.data),

  getMyBalance: (tontineUid: string): Promise<MyBalanceResponse> =>
    apiClient.get(ENDPOINTS.SAVINGS.MY_BALANCE(tontineUid).url).then((r) => r.data),

  getPeriods: (tontineUid: string): Promise<SavingsPeriod[]> =>
    apiClient
      .get(ENDPOINTS.SAVINGS.PERIODS(tontineUid).url)
      .then((r) => parseSavingsPeriodsPayload(r.data)),

  getContributions: (
    tontineUid: string,
    periodUid: string
  ): Promise<SavingsContribution[]> =>
    apiClient
      .get(ENDPOINTS.SAVINGS.CONTRIBUTIONS(tontineUid, periodUid).url)
      .then((r) => parseSavingsContributionsPayload(r.data)),

  contribute: (tontineUid: string, payload: ContributeSavingsPayload) =>
    apiClient
      .post(ENDPOINTS.SAVINGS.CONTRIBUTE(tontineUid).url, payload)
      .then((r) => r.data),

  getWithdrawalPreview: (
    tontineUid: string
  ): Promise<SavingsWithdrawalPreview> =>
    apiClient
      .get(ENDPOINTS.SAVINGS.WITHDRAW_PREVIEW(tontineUid).url)
      .then((r) => r.data),

  requestWithdrawal: (
    tontineUid: string,
    payload: RequestWithdrawalPayload
  ) =>
    apiClient
      .post(ENDPOINTS.SAVINGS.WITHDRAW(tontineUid).url, payload)
      .then((r) => r.data),

  requestEarlyExit: (
    tontineUid: string,
    memberUid: string,
    payload: RequestWithdrawalPayload
  ) =>
    apiClient
      .post(ENDPOINTS.SAVINGS.EARLY_EXIT(tontineUid, memberUid).url, payload)
      .then((r) => r.data),
};
