/**
 * Hooks — actions rotation : tirage au sort, réordonnancement, demandes d'échange.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  shuffleRotation,
  reorderRotation,
  getSwapRequests,
  decideSwapRequest,
  createSwapRequest,
} from '@/api/tontinesApi';
import type {
  ReorderRotationPayload,
  DecideSwapRequestPayload,
  CreateSwapRequestPayload,
} from '@/types/tontine';

export const tontineKeys = {
  swapRequests: (uid: string) => ['tontines', uid, 'swap-requests'] as const,
};

export const useSwapRequests = (tontineUid: string) =>
  useQuery({
    queryKey: tontineKeys.swapRequests(tontineUid),
    queryFn: () => getSwapRequests(tontineUid),
    staleTime: 30_000,
    networkMode: 'offlineFirst',
    enabled: !!tontineUid,
  });

export const useShuffleRotation = (tontineUid: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => shuffleRotation(tontineUid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tontines', tontineUid] });
      qc.invalidateQueries({ queryKey: ['tontine', tontineUid] });
      qc.invalidateQueries({ queryKey: ['members', tontineUid] });
      qc.invalidateQueries({ queryKey: ['rotation', tontineUid] });
    },
  });
};

export const useReorderRotation = (tontineUid: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReorderRotationPayload) =>
      reorderRotation(tontineUid, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tontines', tontineUid] });
      qc.invalidateQueries({ queryKey: ['tontine', tontineUid] });
      qc.invalidateQueries({ queryKey: ['members', tontineUid] });
      qc.invalidateQueries({ queryKey: ['rotation', tontineUid] });
    },
  });
};

export const useDecideSwapRequest = (tontineUid: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestUid,
      payload,
    }: {
      requestUid: string;
      payload: DecideSwapRequestPayload;
    }) => decideSwapRequest(tontineUid, requestUid, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tontineKeys.swapRequests(tontineUid) });
      qc.invalidateQueries({ queryKey: ['members', tontineUid] });
      qc.invalidateQueries({ queryKey: ['tontine', tontineUid] });
    },
  });
};

export const useCreateSwapRequest = (tontineUid: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSwapRequestPayload) =>
      createSwapRequest(tontineUid, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tontineKeys.swapRequests(tontineUid) });
    },
  });
};
