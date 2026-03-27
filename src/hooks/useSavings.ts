/**
 * Hooks React Query — Tontines Épargne (barrel + compat).
 */
export { savingsKeys } from '@/hooks/savings/keys';
export {
  useSavingsList,
  useSavingsDetail,
  useSavingsMyBalance,
  useSavingsWithdrawalPreview,
  useSavingsProjection,
  useSavingsBonusPool,
  useSavingsPeriods,
  useCreateSavings,
  useContributeSavings,
  useWithdrawSavings,
  useRequestEarlyExit,
  useJoinSavingsTontine,
} from '@/hooks/savings';

export { useSavingsMyBalance as useMyBalance } from '@/hooks/savings/useSavingsMyBalance';
export { useCreateSavings as useCreateSavingsTontine } from '@/hooks/savings/useSavingsMutations';
export { useWithdrawSavings as useRequestWithdrawal } from '@/hooks/savings/useSavingsMutations';

import { useQuery } from '@tanstack/react-query';
import { savingsApi } from '@/api/savings.api';
import { savingsKeys } from '@/hooks/savings/keys';

export const useSavingsDashboard = (tontineUid: string) =>
  useQuery({
    queryKey: savingsKeys.dashboard(tontineUid),
    queryFn: () => savingsApi.dashboard(tontineUid),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled: !!tontineUid,
    networkMode: 'offlineFirst',
  });

export const useSavingsContributions = (
  tontineUid: string,
  periodUid: string
) =>
  useQuery({
    queryKey: savingsKeys.contributions(tontineUid, periodUid),
    queryFn: () => savingsApi.periodContributions(tontineUid, periodUid),
    staleTime: 60_000,
    enabled: !!tontineUid && !!periodUid,
    networkMode: 'offlineFirst',
  });
