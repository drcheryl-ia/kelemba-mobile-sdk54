/**
 * Hooks React Query — Tontines Épargne.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { savingsApi } from '@/api/savings.api';
import type {
  CreateSavingsTontinePayload,
  ContributeSavingsPayload,
  RequestWithdrawalPayload,
} from '@/types/savings.types';

// ─── Query keys ───────────────────────────────────────────────────

export const savingsKeys = {
  all: ['savings'] as const,
  dashboard: (uid: string) => ['savings', uid, 'dashboard'] as const,
  balance: (uid: string) => ['savings', uid, 'balance'] as const,
  periods: (uid: string) => ['savings', uid, 'periods'] as const,
  contributions: (uid: string, periodUid: string) =>
    ['savings', uid, 'periods', periodUid, 'contributions'] as const,
};

// ─── Queries ──────────────────────────────────────────────────────

export const useSavingsDashboard = (tontineUid: string) =>
  useQuery({
    queryKey: savingsKeys.dashboard(tontineUid),
    queryFn: () => savingsApi.getDashboard(tontineUid),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled: !!tontineUid,
    networkMode: 'offlineFirst',
  });

export const useMyBalance = (tontineUid: string) =>
  useQuery({
    queryKey: savingsKeys.balance(tontineUid),
    queryFn: () => savingsApi.getMyBalance(tontineUid),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    enabled: !!tontineUid,
    networkMode: 'offlineFirst',
  });

export const useSavingsPeriods = (tontineUid: string) =>
  useQuery({
    queryKey: savingsKeys.periods(tontineUid),
    queryFn: () => savingsApi.getPeriods(tontineUid),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    enabled: !!tontineUid,
    networkMode: 'offlineFirst',
  });

export const useSavingsContributions = (
  tontineUid: string,
  periodUid: string
) =>
  useQuery({
    queryKey: savingsKeys.contributions(tontineUid, periodUid),
    queryFn: () => savingsApi.getContributions(tontineUid, periodUid),
    staleTime: 60_000,
    enabled: !!tontineUid && !!periodUid,
    networkMode: 'offlineFirst',
  });

// ─── Mutations ────────────────────────────────────────────────────

export const useCreateSavingsTontine = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSavingsTontinePayload) =>
      savingsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tontines'] });
    },
  });
};

export const useJoinSavingsTontine = (tontineUid: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => savingsApi.join(tontineUid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: savingsKeys.dashboard(tontineUid) });
      qc.invalidateQueries({ queryKey: ['tontines'] });
    },
  });
};

export const useContributeSavings = (tontineUid: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ContributeSavingsPayload) =>
      savingsApi.contribute(tontineUid, payload),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: savingsKeys.balance(tontineUid) });
      qc.invalidateQueries({ queryKey: savingsKeys.dashboard(tontineUid) });
      qc.invalidateQueries({
        queryKey: savingsKeys.contributions(tontineUid, variables.periodUid),
      });
    },
  });
};

export const useRequestWithdrawal = (tontineUid: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RequestWithdrawalPayload) =>
      savingsApi.requestWithdrawal(tontineUid, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: savingsKeys.balance(tontineUid) });
    },
  });
};

export const useRequestEarlyExit = (tontineUid: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RequestWithdrawalPayload) =>
      savingsApi.requestEarlyExit(tontineUid, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: savingsKeys.balance(tontineUid) });
      qc.invalidateQueries({ queryKey: ['tontines'] });
    },
  });
};
