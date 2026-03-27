/**
 * Mutations épargne — invalidations alignées sur les clés ['savings', …].
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { savingsApi } from '@/api/savings.api';
import { savingsKeys } from '@/hooks/savings/keys';
import type {
  CreateSavingsTontinePayload,
  ContributeSavingsPayload,
  WithdrawSavingsPayload,
} from '@/types/savings.types';

export function useCreateSavings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSavingsTontinePayload) => savingsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: savingsKeys.list() });
      qc.invalidateQueries({ queryKey: ['tontines'] });
    },
  });
}

export function useContributeSavings(uid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ContributeSavingsPayload) =>
      savingsApi.contribute(uid, payload),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: savingsKeys.myBalance(uid) });
      qc.invalidateQueries({ queryKey: savingsKeys.periods(uid) });
      qc.invalidateQueries({
        queryKey: savingsKeys.contributions(uid, variables.periodUid),
      });
      qc.invalidateQueries({ queryKey: savingsKeys.dashboard(uid) });
      qc.invalidateQueries({ queryKey: ['tontines'] });
    },
  });
}

export function useWithdrawSavings(uid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: WithdrawSavingsPayload) =>
      savingsApi.withdraw(uid, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: savingsKeys.myBalance(uid) });
      qc.invalidateQueries({ queryKey: savingsKeys.dashboard(uid) });
      qc.invalidateQueries({ queryKey: savingsKeys.periods(uid) });
      qc.invalidateQueries({ queryKey: ['tontines'] });
    },
  });
}

export function useRequestEarlyExit(uid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberUid: string) =>
      savingsApi.requestEarlyExit(uid, memberUid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: savingsKeys.detail(uid) });
      qc.invalidateQueries({ queryKey: savingsKeys.dashboard(uid) });
      qc.invalidateQueries({ queryKey: savingsKeys.myBalance(uid) });
      qc.invalidateQueries({ queryKey: ['tontines'] });
    },
  });
}

export function useJoinSavingsTontine(uid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => savingsApi.join(uid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: savingsKeys.list() });
      qc.invalidateQueries({ queryKey: savingsKeys.detail(uid) });
      qc.invalidateQueries({ queryKey: savingsKeys.dashboard(uid) });
      qc.invalidateQueries({ queryKey: ['tontines'] });
    },
  });
}
