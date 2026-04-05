/**
 * Carousel héro accueil — pages ordonnées + états optimistes post-paiement.
 */
import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { useTontines } from '@/hooks/useTontines';
import { useNextPayment } from '@/hooks/useNextPayment';
import { useContributionHistory } from '@/hooks/useContributionHistory';
import { useOrganizerCashPendingCount } from '@/hooks/useOrganizerCashPending';
import { useHasOrganizerRoleInTontines } from '@/hooks/useHasOrganizerRoleInTontines';
import { withNextPaymentPenaltyWaivedForPendingCashValidation } from '@/utils/nextPaymentPenaltyWaive';
import { deriveTontinePaymentUiState } from '@/utils/tontinePaymentState';
import { selectUserUid } from '@/store/authSlice';
import type { RootState } from '@/store/store';
import type { HeroCardPage } from '@/types/dashboard.types';
import type { NextPaymentData } from '@/types/payment';
import type { TontineFrequency } from '@/api/types/api.types';
import { ORIGIN_JOIN_REQUEST } from '@/types/tontine';
import type { TontineListItem } from '@/types/tontine';

const MS_PER_DAY = 86_400_000;

export type PendingPaymentEntry = {
  cycleLabel: string;
  amount: number;
  ref?: string;
};

function buildCycleLabelNp(
  np: NextPaymentData,
  frequency: TontineFrequency | null | undefined
): string {
  const freqStr: Record<TontineFrequency, string> = {
    DAILY: 'Quotidienne',
    WEEKLY: 'Hebdo',
    BIWEEKLY: 'Bimensuelle',
    MONTHLY: 'Mensuelle',
  };
  const cycleNum = np.cycleNumber;
  const f = frequency != null ? freqStr[frequency] : undefined;
  return f != null ? `Cycle ${cycleNum} · ${f}` : `Cycle ${cycleNum}`;
}

function buildCycleLabelFromUid(
  tontineUid: string,
  tontines: TontineListItem[],
  nextPayment: NextPaymentData | null,
  cycleUid: string
): string {
  const t = tontines.find((x) => x.uid === tontineUid);
  if (
    nextPayment != null &&
    nextPayment.tontineUid === tontineUid &&
    nextPayment.cycleUid === cycleUid
  ) {
    const freq = t?.frequency;
    return buildCycleLabelNp(nextPayment, freq ?? null);
  }
  if (t != null) {
    const n = t.currentCycleNumber ?? t.currentCycle ?? 0;
    const freqStr: Record<TontineFrequency, string> = {
      DAILY: 'Quotidienne',
      WEEKLY: 'Hebdo',
      BIWEEKLY: 'Bimensuelle',
      MONTHLY: 'Mensuelle',
    };
    const f = t.frequency != null ? freqStr[t.frequency] : undefined;
    return f != null ? `Cycle ${n} · ${f}` : `Cycle ${n}`;
  }
  return 'Cycle';
}

function getAmountFromUid(
  tontineUid: string,
  nextPayment: NextPaymentData | null,
  tontines: TontineListItem[]
): number {
  if (nextPayment?.tontineUid === tontineUid) {
    const total = nextPayment.totalAmountDue ?? nextPayment.totalDue;
    if (Number.isFinite(total)) return Math.round(total ?? 0);
  }
  const t = tontines.find((x) => x.uid === tontineUid);
  if (t == null) return 0;
  const shares = t.userSharesCount ?? 1;
  return Math.round(t.amountPerShare * shares);
}

function netPayoutFor(t: TontineListItem): number {
  const n = t.beneficiaryNetAmount ?? t.payoutNetAmount;
  return n != null && Number.isFinite(n) ? Math.round(n) : 0;
}

function pendingInvitationsList(
  tontines: TontineListItem[],
  invitations: TontineListItem[]
): TontineListItem[] {
  if (invitations.length > 0) return invitations;
  return tontines.filter((t) => t.membershipStatus === 'PENDING');
}

function isOverdueCycle(t: TontineListItem): boolean {
  const s = String(t.currentCyclePaymentStatus ?? '');
  if (s === 'OVERDUE' || s === 'PENALIZED') return true;
  return deriveTontinePaymentUiState(t).uiStatus === 'OVERDUE';
}

function isDueCycleNotOverdue(t: TontineListItem): boolean {
  if (isOverdueCycle(t)) return false;
  const s = String(t.currentCyclePaymentStatus ?? '');
  if (s === 'DUE') return true;
  const ui = deriveTontinePaymentUiState(t).uiStatus;
  return ui === 'DUE_TODAY' || ui === 'DUE_SOON';
}

function daysRemainingFromExpected(iso: string | null | undefined): number {
  if (iso == null || iso === '') return 0;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(
    0,
    Math.ceil((d.getTime() - Date.now()) / MS_PER_DAY)
  );
}

function cycleLabelForTontine(
  t: TontineListItem,
  np: NextPaymentData | null
): string {
  if (np?.tontineUid === t.uid) {
    return buildCycleLabelNp(np, t.frequency);
  }
  const n = t.currentCycleNumber ?? t.currentCycle ?? 0;
  const freqStr: Record<TontineFrequency, string> = {
    DAILY: 'Quotidienne',
    WEEKLY: 'Hebdo',
    BIWEEKLY: 'Bimensuelle',
    MONTHLY: 'Mensuelle',
  };
  const f = t.frequency != null ? freqStr[t.frequency] : undefined;
  return f != null ? `Cycle ${n} · ${f}` : `Cycle ${n}`;
}

export function useHomeHeroState(): {
  pages: HeroCardPage[];
  isLoading: boolean;
  refetch: () => Promise<void>;
  markPaymentPending: (
    tontineUid: string,
    cycleUid: string,
    opts?: { cycleLabel?: string; amount?: number }
  ) => void;
  clearPaymentPending: (tontineUid: string) => void;
  clearAllPaymentPending: () => void;
} {
  const queryClient = useQueryClient();
  const userUid = useSelector((s: RootState) => selectUserUid(s));
  const hasOrg = useHasOrganizerRoleInTontines();

  const {
    tontines,
    invitations,
    isLoading: tontinesLoading,
  } = useTontines({ includeInvitations: true });
  const { nextPayment, isLoading: nextPaymentLoading } = useNextPayment();
  const { items: cashHistoryItems } = useContributionHistory(undefined, {
    methodFilter: 'CASH',
    sortField: 'date',
    sortOrder: 'desc',
  });
  const cashCountQuery = useOrganizerCashPendingCount();

  const nextPaymentAdjusted = useMemo(
    () =>
      withNextPaymentPenaltyWaivedForPendingCashValidation(
        nextPayment,
        cashHistoryItems
      ),
    [nextPayment, cashHistoryItems]
  );

  const [pendingPayments, setPendingPayments] = useState<
    Record<string, PendingPaymentEntry>
  >({});

  const isLoading =
    tontinesLoading ||
    nextPaymentLoading ||
    (hasOrg && cashCountQuery.isLoading);

  const refetch = useCallback(async () => {
    if (userUid == null) return;
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['tontines', userUid] }),
      queryClient.refetchQueries({ queryKey: ['invitationsReceived', userUid] }),
      queryClient.refetchQueries({ queryKey: ['nextPayment', userUid] }),
      queryClient.refetchQueries({
        queryKey: ['payments', 'cash', 'organizer', 'pending-count', userUid],
      }),
      queryClient.refetchQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'payments' &&
          q.queryKey[1] === 'history' &&
          q.queryKey[2] === userUid,
      }),
    ]);
  }, [queryClient, userUid]);

  const markPaymentPending = useCallback(
    (
      tontineUid: string,
      cycleUid: string,
      opts?: { cycleLabel?: string; amount?: number }
    ) => {
      setPendingPayments((prev) => ({
        ...prev,
        [tontineUid]: {
          cycleLabel:
            opts?.cycleLabel ??
            buildCycleLabelFromUid(
              tontineUid,
              tontines,
              nextPaymentAdjusted,
              cycleUid
            ),
          amount:
            opts?.amount ??
            getAmountFromUid(tontineUid, nextPaymentAdjusted, tontines),
        },
      }));
    },
    [nextPaymentAdjusted, tontines]
  );

  const clearPaymentPending = useCallback((tontineUid: string) => {
    setPendingPayments((prev) => {
      const next = { ...prev };
      delete next[tontineUid];
      return next;
    });
  }, []);

  const clearAllPaymentPending = useCallback(() => {
    setPendingPayments({});
  }, []);

  const pages = useMemo<HeroCardPage[]>(() => {
    const np = nextPaymentAdjusted;
    const cashCount = cashCountQuery.data ?? 0;
    const result: HeroCardPage[] = [];

    const activeMemberTontines = tontines.filter(
      (t) => t.membershipStatus !== 'PENDING' && t.status === 'ACTIVE'
    );

    activeMemberTontines
      .filter((t) => t.currentCycleStatus === 'PAYOUT_IN_PROGRESS')
      .forEach((t) => {
        result.push({
          pageKey: `PAYOUT_IN_PROGRESS-${t.uid}`,
          variant: 'PAYOUT_IN_PROGRESS',
          payoutTontineName: t.name,
          payoutBeneficiaryName: t.beneficiaryName ?? null,
          payoutAmount: netPayoutFor(t) || undefined,
          payoutCycleUid: t.currentCycleUid ?? undefined,
          payoutTontineUid: t.uid,
        });
      });

    activeMemberTontines
      .filter((t) => t.canTriggerPayout === true)
      .forEach((t) => {
        result.push({
          pageKey: `PAYOUT_READY-${t.uid}`,
          variant: 'PAYOUT_READY',
          payoutTontineName: t.name,
          payoutBeneficiaryName: t.beneficiaryName ?? null,
          payoutAmount: netPayoutFor(t) || undefined,
          payoutCycleUid: t.currentCycleUid ?? undefined,
          payoutTontineUid: t.uid,
        });
      });

    const overdueTontines = activeMemberTontines.filter((t) =>
      isOverdueCycle(t)
    );

    overdueTontines.forEach((t) => {
      const pend = pendingPayments[t.uid];
      if (pend != null) {
        result.push({
          pageKey: `PAYMENT_PENDING-${t.uid}`,
          variant: 'PAYMENT_PENDING_VALIDATION',
          paymentPendingTontineName: t.name,
          paymentPendingCycleLabel: pend.cycleLabel,
          paymentPendingAmount: pend.amount,
          tontineUid: t.uid,
          isCreator: t.isCreator === true,
        });
        return;
      }
      const isCurrent = np?.tontineUid === t.uid;
      const shares = t.userSharesCount ?? 1;
      const baseFallback = Math.round(t.amountPerShare * shares);
      result.push({
        pageKey: `OVERDUE-${t.uid}`,
        variant: 'OVERDUE',
        tontineName: t.name,
        cycleLabel: cycleLabelForTontine(t, np),
        amountDue: isCurrent
          ? Math.round(
              np?.totalAmountDue ?? np?.totalDue ?? baseFallback
            )
          : baseFallback,
        daysLate: isCurrent
          ? Math.max(0, np?.daysLate ?? t.daysOverdue ?? 0)
          : Math.max(0, t.daysOverdue ?? 0),
        cycleUid: t.currentCycleUid ?? undefined,
        tontineUid: t.uid,
        isCreator: t.isCreator === true,
        hasPenaltyIncluded:
          isCurrent && (np?.penaltyAmount ?? 0) > 0
            ? true
            : (t.penaltyAmount ?? 0) > 0,
        penaltyAmount: isCurrent
          ? Math.round(np?.penaltyAmount ?? 0)
          : Math.round(t.penaltyAmount ?? 0),
        cycleNumber: isCurrent
          ? np?.cycleNumber
          : (t.currentCycleNumber ?? t.currentCycle ?? undefined) ?? undefined,
        paymentBaseAmount: isCurrent
          ? Math.round(np?.amountDue ?? 0)
          : Math.round(t.amountPerShare * shares),
      });
    });

    const dueTontines = activeMemberTontines.filter((t) =>
      isDueCycleNotOverdue(t)
    );

    dueTontines.forEach((t) => {
      const pend = pendingPayments[t.uid];
      if (pend != null) {
        result.push({
          pageKey: `PAYMENT_PENDING-${t.uid}`,
          variant: 'PAYMENT_PENDING_VALIDATION',
          paymentPendingTontineName: t.name,
          paymentPendingCycleLabel: pend.cycleLabel,
          paymentPendingAmount: pend.amount,
          tontineUid: t.uid,
          isCreator: t.isCreator === true,
        });
        return;
      }
      const isCurrent = np?.tontineUid === t.uid;
      const shares = t.userSharesCount ?? 1;
      const baseFallback = Math.round(t.amountPerShare * shares);
      const daysRemaining = daysRemainingFromExpected(
        t.currentCycleExpectedDate ?? undefined
      );
      result.push({
        pageKey: `DUE-${t.uid}`,
        variant: 'DUE',
        tontineName: t.name,
        cycleLabel: cycleLabelForTontine(t, np),
        amountDue: isCurrent
          ? Math.round(
              np?.totalAmountDue ?? np?.totalDue ?? baseFallback
            )
          : baseFallback,
        daysLate: -daysRemaining,
        cycleUid: t.currentCycleUid ?? undefined,
        tontineUid: t.uid,
        isCreator: t.isCreator === true,
        penaltyAmount: isCurrent
          ? Math.round(np?.penaltyAmount ?? 0)
          : 0,
        cycleNumber: isCurrent
          ? np?.cycleNumber
          : (t.currentCycleNumber ?? t.currentCycle ?? undefined) ?? undefined,
        paymentBaseAmount: isCurrent
          ? Math.round(np?.amountDue ?? 0)
          : Math.round(t.amountPerShare * shares),
      });
    });

    if (cashCount > 0) {
      const creatorTontineNames = tontines
        .filter((t) => t.isCreator === true && t.status === 'ACTIVE')
        .map((t) => t.name)
        .slice(0, 2)
        .join(' · ');
      result.push({
        pageKey: 'CASH_PENDING',
        variant: 'CASH_PENDING',
        cashPendingCount: cashCount,
        cashTontineNamesHint: creatorTontineNames || undefined,
        tontineName: creatorTontineNames || undefined,
      });
    }

    const pending = pendingInvitationsList(tontines, invitations);
    pending.forEach((t) => {
      result.push({
        pageKey: `INVITATION-${t.uid}`,
        variant: 'INVITATION_PENDING',
        invitationCount: 1,
        firstInvitationName: t.name,
        firstInvitationAmount: t.amountPerShare,
        firstInvitationMemberCount: t.activeMemberCount ?? 0,
        firstInvitationTontineUid: t.uid,
        firstInvitationMode:
          t.invitationOrigin === ORIGIN_JOIN_REQUEST
            ? 'JOIN_REQUEST'
            : 'INVITE_ACCEPT',
      });
    });

    if (result.length === 0) {
      result.push({
        pageKey: 'NEUTRAL',
        variant: 'NEUTRAL',
      });
    }

    return result;
  }, [
    tontines,
    invitations,
    nextPaymentAdjusted,
    cashCountQuery.data,
    pendingPayments,
  ]);

  return {
    pages,
    isLoading,
    refetch,
    markPaymentPending,
    clearPaymentPending,
    clearAllPaymentPending,
  };
}
