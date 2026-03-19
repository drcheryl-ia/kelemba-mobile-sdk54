/**
 * API Tontines Épargne — création, dashboard, versements, retraits.
 */
import { apiClient } from '@/api/apiClient';
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

const BASE = '/v1/savings';

export const savingsApi = {
  create: (payload: CreateSavingsTontinePayload) =>
    apiClient.post(`${BASE}`, payload).then((r) => r.data),

  join: (tontineUid: string) =>
    apiClient.post(`${BASE}/${tontineUid}/join`).then((r) => r.data),

  getDashboard: (tontineUid: string): Promise<SavingsDashboard> =>
    apiClient.get(`${BASE}/${tontineUid}/dashboard`).then((r) => r.data),

  getMyBalance: (tontineUid: string): Promise<MyBalanceResponse> =>
    apiClient.get(`${BASE}/${tontineUid}/my-balance`).then((r) => r.data),

  getPeriods: (tontineUid: string): Promise<SavingsPeriod[]> =>
    apiClient.get(`${BASE}/${tontineUid}/periods`).then((r) => r.data),

  getContributions: (
    tontineUid: string,
    periodUid: string
  ): Promise<SavingsContribution[]> =>
    apiClient
      .get(`${BASE}/${tontineUid}/periods/${periodUid}/contributions`)
      .then((r) => r.data),

  contribute: (tontineUid: string, payload: ContributeSavingsPayload) =>
    apiClient
      .post(`${BASE}/${tontineUid}/contribute`, payload)
      .then((r) => r.data),

  getWithdrawalPreview: (
    tontineUid: string
  ): Promise<SavingsWithdrawalPreview> =>
    apiClient.get(`${BASE}/${tontineUid}/withdraw/preview`).then((r) => r.data),

  requestWithdrawal: (
    tontineUid: string,
    payload: RequestWithdrawalPayload
  ) =>
    apiClient.post(`${BASE}/${tontineUid}/withdraw`, payload).then((r) => r.data),

  requestEarlyExit: (
    tontineUid: string,
    payload: RequestWithdrawalPayload
  ) =>
    apiClient
      .post(`${BASE}/${tontineUid}/members/early-exit`, payload)
      .then((r) => r.data),
};
