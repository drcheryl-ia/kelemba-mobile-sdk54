/**
 * API Tontines Épargne — création, dashboard, versements, retraits.
 */
import { apiClient } from '@/api/apiClient';
import { ENDPOINTS } from '@/api/endpoints';
import type {
  CreateSavingsTontinePayload,
  ContributeSavingsPayload,
  WithdrawSavingsPayload,
  SavingsListItem,
  SavingsDetail,
  SavingsPeriod,
  MyBalanceResponse,
  SavingsWithdrawalPreview,
  SavingsProjection,
  SavingsBonusPool,
  SavingsDashboard,
  SavingsContribution,
} from '@/types/savings.types';

function parseSavingsListPayload(data: unknown): { tontines: SavingsListItem[] } {
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.tontines)) {
      return { tontines: o.tontines as SavingsListItem[] };
    }
    const nested = o.savings ?? o.data ?? o.items ?? o.results;
    if (Array.isArray(nested)) {
      return { tontines: nested as SavingsListItem[] };
    }
  }
  if (Array.isArray(data)) {
    return { tontines: data as SavingsListItem[] };
  }
  return { tontines: [] };
}

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
  list: () =>
    apiClient.get(ENDPOINTS.SAVINGS.LIST.url).then((r) => parseSavingsListPayload(r.data)),

  create: (payload: CreateSavingsTontinePayload) =>
    apiClient
      .post<SavingsDetail>(ENDPOINTS.SAVINGS.CREATE.url, payload)
      .then((r) => r.data),

  detail: (uid: string) =>
    apiClient
      .get<SavingsDetail>(ENDPOINTS.SAVINGS.DETAIL(uid).url)
      .then((r) => r.data),

  join: (uid: string) =>
    apiClient.post(ENDPOINTS.SAVINGS.JOIN(uid).url).then((r) => r.data),

  myBalance: (uid: string): Promise<MyBalanceResponse> =>
    apiClient
      .get<MyBalanceResponse>(ENDPOINTS.SAVINGS.MY_BALANCE(uid).url)
      .then((r) => r.data),

  dashboard: (uid: string): Promise<SavingsDashboard> =>
    apiClient
      .get<SavingsDashboard>(ENDPOINTS.SAVINGS.DASHBOARD(uid).url)
      .then((r) => r.data),

  withdrawalPreview: (uid: string): Promise<SavingsWithdrawalPreview> =>
    apiClient
      .get<SavingsWithdrawalPreview>(ENDPOINTS.SAVINGS.WITHDRAWAL_PREVIEW(uid).url)
      .then((r) => r.data),

  projection: (uid: string): Promise<SavingsProjection> =>
    apiClient
      .get<SavingsProjection>(ENDPOINTS.SAVINGS.PROJECTION(uid).url)
      .then((r) => r.data),

  bonusPool: (uid: string): Promise<SavingsBonusPool> =>
    apiClient
      .get<SavingsBonusPool>(ENDPOINTS.SAVINGS.BONUS_POOL(uid).url)
      .then((r) => r.data),

  contribute: (uid: string, payload: ContributeSavingsPayload) =>
    apiClient
      .post(ENDPOINTS.SAVINGS.CONTRIBUTE(uid).url, payload)
      .then((r) => r.data),

  periods: (uid: string): Promise<SavingsPeriod[]> =>
    apiClient
      .get(ENDPOINTS.SAVINGS.PERIODS(uid).url)
      .then((r) => parseSavingsPeriodsPayload(r.data)),

  periodContributions: (
    uid: string,
    periodUid: string
  ): Promise<SavingsContribution[]> =>
    apiClient
      .get(ENDPOINTS.SAVINGS.PERIOD_CONTRIBUTIONS(uid, periodUid).url)
      .then((r) => parseSavingsContributionsPayload(r.data)),

  withdraw: (uid: string, payload: WithdrawSavingsPayload) =>
    apiClient
      .post(ENDPOINTS.SAVINGS.WITHDRAW(uid).url, payload)
      .then((r) => r.data),

  /** POST sans corps — idempotence éventuelle via en-têtes côté gateway / backend. */
  requestEarlyExit: (uid: string, memberUid: string) =>
    apiClient
      .post(ENDPOINTS.SAVINGS.MEMBER_EARLY_EXIT(uid, memberUid).url)
      .then((r) => r.data),

  memberSuspend: (uid: string, memberUid: string) =>
    apiClient
      .post(ENDPOINTS.SAVINGS.MEMBER_SUSPEND(uid, memberUid).url)
      .then((r) => r.data),

  memberReinstate: (uid: string, memberUid: string) =>
    apiClient
      .post(ENDPOINTS.SAVINGS.MEMBER_REINSTATE(uid, memberUid).url)
      .then((r) => r.data),
};
