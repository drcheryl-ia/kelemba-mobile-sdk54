/**
 * Onglet validations espèces (organisatrices).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Alert,
  Pressable,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { selectUserUid } from '@/store/authSlice';
import { validateCashPayment } from '@/api/cashPaymentApi';
import {
  useOrganizerCashPendingActions,
  useOrganizerCashPendingCount,
  filterOrganizerCashPendingForTontineScope,
  getOrganizerTontineUids,
} from '@/hooks/useOrganizerCashPending';
import { useTontines } from '@/hooks/useTontines';
import { CashValidationCard } from '@/components/payments/CashValidationCard';
import { CashValidationSkeleton } from '@/components/payments/CashValidationSkeleton';
import { CashValidationEmptyState } from '@/components/payments/CashValidationEmptyState';
import { organizerActionToCashValidationItem } from '@/screens/payments/cashValidationMapper';
import { logger } from '@/utils/logger';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/spacing';
import type { CashValidationItem } from '@/types/payments.types';

export interface ValidationsMetrics {
  pendingCount: number;
  approvedThisMonth: number;
  rejectedThisMonth: number;
}

export interface ValidationsTabProps {
  onMetricsChange: (m: ValidationsMetrics) => void;
}

type Chip = 'pending' | 'approved' | 'rejected';

function isInCurrentMonth(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  );
}

export const ValidationsTab: React.FC<ValidationsTabProps> = ({
  onMetricsChange,
}) => {
  const queryClient = useQueryClient();
  const userUid = useSelector(selectUserUid);
  const [chip, setChip] = useState<Chip>('pending');
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'APPROVE' | 'REJECT' | null>(
    null
  );

  const { tontines } = useTontines({ includeInvitations: false });
  const organizerUids = useMemo(
    () => getOrganizerTontineUids(tontines),
    [tontines]
  );

  const {
    data: pendingRaw = [],
    isLoading: actionsLoading,
    isRefetching: cashRefetching,
    refetch: refetchCashActions,
  } = useOrganizerCashPendingActions({ active: true });

  const { data: pendingCountFromApi } = useOrganizerCashPendingCount();

  const itemsScoped = useMemo(() => {
    if (userUid == null) return [];
    return filterOrganizerCashPendingForTontineScope(
      pendingRaw,
      userUid,
      organizerUids
    );
  }, [pendingRaw, userUid, organizerUids]);

  const mapped = useMemo(
    () => itemsScoped.map(organizerActionToCashValidationItem),
    [itemsScoped]
  );

  const sortedAsc = useMemo(() => {
    return [...mapped].sort(
      (a, b) =>
        new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
    );
  }, [mapped]);

  const filtered = useMemo(() => {
    if (chip === 'pending')
      return sortedAsc.filter((i) => i.status === 'PENDING_REVIEW');
    if (chip === 'approved')
      return sortedAsc.filter((i) => i.status === 'APPROVED');
    return sortedAsc.filter((i) => i.status === 'REJECTED');
  }, [sortedAsc, chip]);

  const badgeCount = useMemo(
    () =>
      sortedAsc.filter((i) => i.status === 'PENDING_REVIEW').length,
    [sortedAsc]
  );

  useEffect(() => {
    const approvedThisMonth = sortedAsc.filter(
      (i) =>
        i.status === 'APPROVED' &&
        isInCurrentMonth(i.submittedAt)
    ).length;
    const rejectedThisMonth = sortedAsc.filter(
      (i) =>
        i.status === 'REJECTED' &&
        isInCurrentMonth(i.submittedAt)
    ).length;
    onMetricsChange({
      pendingCount:
        typeof pendingCountFromApi === 'number'
          ? pendingCountFromApi
          : badgeCount,
      approvedThisMonth,
      rejectedThisMonth,
    });
  }, [sortedAsc, pendingCountFromApi, badgeCount, onMetricsChange]);

  const invalidateCash = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ['payments', 'cash', 'organizer', 'pending-actions'],
    });
    void queryClient.invalidateQueries({
      queryKey: ['payments', 'cash', 'organizer', 'pending-count'],
    });
  }, [queryClient]);

  const validateMutation = useMutation({
    mutationFn: (vars: {
      paymentUid: string;
      action: 'APPROVE' | 'REJECT';
      rejectionReason?: string;
    }) =>
      validateCashPayment(
        vars.paymentUid,
        vars.action,
        vars.rejectionReason
      ),
    onMutate: (vars) => {
      setBusyUid(vars.paymentUid);
      setBusyAction(vars.action);
    },
    onSettled: () => {
      setBusyUid(null);
      setBusyAction(null);
    },
    onSuccess: () => {
      invalidateCash();
      void queryClient.invalidateQueries({ queryKey: ['payments', 'history'] });
      void queryClient.invalidateQueries({ queryKey: ['nextPayment'] });
    },
    onError: (
      err: unknown,
      vars: {
        paymentUid: string;
        action: 'APPROVE' | 'REJECT';
        rejectionReason?: string;
      }
    ) => {
      logger.error('CashValidation mutation error', err);
      Alert.alert(
        'Erreur',
        vars.action === 'REJECT'
          ? "Le refus n'a pas pu être enregistré. Réessayez."
          : 'La validation a échoué. Réessayez.'
      );
    },
  });

  const handleApprove = useCallback(
    (paymentUid: string) => {
      validateMutation.mutate({ paymentUid, action: 'APPROVE' });
    },
    [validateMutation]
  );

  const handleReject = useCallback(
    (paymentUid: string, reason?: string) => {
      validateMutation.mutate({
        paymentUid,
        action: 'REJECT',
        rejectionReason: reason,
      });
    },
    [validateMutation]
  );

  const chipRow = (
    <View style={{ height: 64 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        <ChipBtn
          label={`En attente (${badgeCount})`}
          selected={chip === 'pending'}
          onPress={() => setChip('pending')}
        />
        <ChipBtn
          label="Validés"
          selected={chip === 'approved'}
          onPress={() => setChip('approved')}
        />
        <ChipBtn
          label="Refusés"
          selected={chip === 'rejected'}
          onPress={() => setChip('rejected')}
        />
      </ScrollView>
    </View>
  );

  const renderItem = useCallback(
    ({ item }: { item: CashValidationItem }) => (
      <View style={styles.cardPad}>
        <CashValidationCard
          item={item}
          onApprove={handleApprove}
          onReject={handleReject}
          isApproving={
            busyUid === item.paymentUid && busyAction === 'APPROVE'
          }
          isRejecting={
            busyUid === item.paymentUid && busyAction === 'REJECT'
          }
        />
      </View>
    ),
    [busyAction, busyUid, handleApprove, handleReject]
  );

  if (actionsLoading && mapped.length === 0) {
    return (
      <View style={styles.pad}>
        {chipRow}
        <CashValidationSkeleton />
        <CashValidationSkeleton />
      </View>
    );
  }

  return (
    <FlatList
      data={filtered}
      keyExtractor={(i) => i.paymentUid}
      renderItem={renderItem}
      ListHeaderComponent={<>{chipRow}</>}
      contentContainerStyle={styles.listContent}
        refreshControl={
        <RefreshControl
          refreshing={cashRefetching}
          onRefresh={() => void refetchCashActions()}
          tintColor={COLORS.primary}
          colors={[COLORS.primary]}
        />
      }
      ListEmptyComponent={
        <CashValidationEmptyState filter={chip} />
      }
    />
  );
};

function ChipBtn(props: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.chip,
        props.selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: props.selected }}
    >
      <Text
        style={[styles.chipText, props.selected && styles.chipTextSelected]}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pad: { flex: 1, paddingTop: 8 },
  listContent: { paddingBottom: SPACING.xl },
  cardPad: { paddingHorizontal: SPACING.lg },
  chipsRow: {
    marginTop: SPACING.sm,
    paddingHorizontal: 16,
    gap: 6,
    alignItems: 'center',
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
  },
  chipSelected: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 12,
    color: COLORS.gray700,
  },
  chipTextSelected: {
    color: COLORS.primaryDark,
    fontWeight: '500',
  },
  pressed: { opacity: 0.88 },
});
