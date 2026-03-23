/**
 * Hook — rotation complète d'une tontine avec dérivations displayStatus.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTontineRotation } from '@/api/tontinesApi';
import type {
  RotationCycle,
  CycleDisplayStatus,
  TontineRotationResponse,
} from '@/types/rotation';

function computeDisplayStatus(
  cycle: TontineRotationResponse['cycles'][0],
  currentCycleNumber: number
): CycleDisplayStatus {
  // Source de vérité n°1 : le backend calcule déjà
  // displayStatus correctement — l'utiliser directement
  // si présent et valide.
  const backendStatus = cycle.displayStatus as CycleDisplayStatus | undefined;
  const VALID: CycleDisplayStatus[] = [
    'VERSÉ',
    'EN_COURS',
    'PROCHAIN',
    'À_VENIR',
    'RETARDÉ',
  ];
  if (backendStatus && VALID.includes(backendStatus)) {
    return backendStatus;
  }

  // Fallback client (si le backend ne renvoie pas displayStatus)
  // Règle : vérifier les statuts terminaux EN PREMIER
  // pour éviter qu'un ancien delayedByMemberUids ne prenne le dessus.

  if (cycle.status === 'COMPLETED' || cycle.status === 'PAYOUT_COMPLETED') {
    return 'VERSÉ';
  }

  if (cycle.status === 'SKIPPED') {
    return 'À_VENIR';
  }

  // hasDelay uniquement pour les cycles encore en cours
  const delayed = cycle.delayedByMemberUids ?? [];
  const hasActiveDelay =
    delayed.length > 0 &&
    (cycle.status === 'ACTIVE' ||
      cycle.status === 'PAYOUT_IN_PROGRESS' ||
      cycle.status === 'PENDING');
  if (hasActiveDelay) return 'RETARDÉ';

  if (cycle.status === 'ACTIVE' || cycle.status === 'PAYOUT_IN_PROGRESS') {
    return 'EN_COURS';
  }

  if (cycle.status === 'PENDING') {
    if (cycle.cycleNumber === currentCycleNumber + 1) return 'PROCHAIN';
    return 'À_VENIR';
  }

  return 'À_VENIR';
}

function computeCollectionProgress(collected: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, collected / total));
}

function mapToRotationCycle(
  raw: TontineRotationResponse['cycles'][0],
  currentCycleNumber: number
): RotationCycle {
  const displayStatus = computeDisplayStatus(raw, currentCycleNumber);
  const collectionProgress = computeCollectionProgress(
    raw.collectedAmount,
    raw.totalExpected
  );
  return {
    uid: raw.uid,
    cycleNumber: raw.cycleNumber,
    rotationRound: raw.rotationRound ?? 1,
    beneficiaryUid: raw.beneficiaryUid,
    beneficiaryName: raw.beneficiaryName,
    expectedDate: raw.expectedDate,
    actualPayoutDate: raw.actualPayoutDate,
    collectedAmount: raw.collectedAmount,
    totalExpected: raw.totalExpected,
    beneficiaryNetAmount: raw.beneficiaryNetAmount,
    status: raw.status,
    displayStatus,
    collectionProgress,
    delayedByMemberUids: raw.delayedByMemberUids ?? [],
    isCurrentUserBeneficiary: raw.isCurrentUserBeneficiary,
  };
}

export interface UseTontineRotationReturn {
  rotationList: RotationCycle[];
  currentCycle: RotationCycle | null;
  nextCycle: RotationCycle | null;
  currentBeneficiary: string | null;
  totalAmount: number;
  memberCount: number;
  tontineName: string;
  currentCycleNumber: number;
  totalCycles: number;
  /** rotationRound du cycle courant (1 par défaut) */
  currentRotationRound: number;
  /** Max des rotationRound sur la timeline */
  maxRotationRound: number;
  pendingReason: string | null;
  isDelayedByOthers: boolean;
  isCurrentUserBeneficiary: boolean;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

const GC_TIME = 24 * 60 * 60 * 1000;

export function useTontineRotation(tontineUid: string): UseTontineRotationReturn {
  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['tontineRotation', tontineUid],
    queryFn: () => getTontineRotation(tontineUid),
    enabled: !!tontineUid,
    staleTime: 5 * 60_000,
    gcTime: GC_TIME,
    networkMode: 'offlineFirst',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  });

  const result = useMemo(() => {
    if (!data) {
      return {
        rotationList: [],
        currentCycle: null,
        nextCycle: null,
        currentBeneficiary: null,
        totalAmount: 0,
        memberCount: 0,
        tontineName: '',
        currentCycleNumber: 0,
        totalCycles: 0,
        pendingReason: null,
        isDelayedByOthers: false,
        isCurrentUserBeneficiary: false,
        currentRotationRound: 1,
        maxRotationRound: 1,
      };
    }

    const currentCycleNumber = data.currentCycleNumber;
    const rotationList = data.cycles.map((c) =>
      mapToRotationCycle(c, currentCycleNumber)
    );

    const currentCycle =
      rotationList.find(
        (c) => c.status === 'ACTIVE' || c.status === 'PAYOUT_IN_PROGRESS'
      ) ?? null;

    const nextCycle =
      rotationList.find((c) => c.displayStatus === 'PROCHAIN') ?? null;

    const currentBeneficiary = currentCycle?.beneficiaryName ?? null;

    const isDelayedByOthers =
      currentCycle != null && currentCycle.delayedByMemberUids.length > 0;

    const delayedCount = currentCycle?.delayedByMemberUids.length ?? 0;
    const pendingReason = isDelayedByOthers
      ? `Le versement est retardé par ${delayedCount} membre(s) en attente de paiement.`
      : null;

    const isCurrentUserBeneficiary = currentCycle?.isCurrentUserBeneficiary ?? false;

    const totalCycles =
      data.rotationPlanLength ?? data.totalParts ?? data.totalCycles;

    const currentRotationRound = currentCycle?.rotationRound ?? 1;
    const maxRotationRound =
      rotationList.length === 0
        ? 1
        : Math.max(...rotationList.map((c) => c.rotationRound), 1);

    return {
      rotationList,
      currentCycle,
      nextCycle,
      currentBeneficiary,
      totalAmount: data.totalAmount,
      memberCount: data.memberCount,
      tontineName: data.tontineName,
      currentCycleNumber: data.currentCycleNumber,
      totalCycles,
      currentRotationRound,
      maxRotationRound,
      pendingReason,
      isDelayedByOthers,
      isCurrentUserBeneficiary,
    };
  }, [data]);

  return {
    ...result,
    isLoading,
    isFetching,
    isError,
    error: error instanceof Error ? error : null,
    refetch,
  };
}
