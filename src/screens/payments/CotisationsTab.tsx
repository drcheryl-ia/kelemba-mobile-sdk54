/**
 * Onglet « Mes cotisations » — obligations + historique paginé.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Share,
  FlatList,
  Pressable,
} from 'react-native';
import { useSelector } from 'react-redux';
import { selectUserUid } from '@/store/authSlice';
import { navigationRef } from '@/navigation/navigationRef';
import { useTontines } from '@/hooks/useTontines';
import { useNextPayment } from '@/hooks/useNextPayment';
import {
  useContributionHistory,
  type FilterPeriod,
} from '@/hooks/useContributionHistory';
import { PaymentDueCard } from '@/components/payments/PaymentDueCard';
import { OverduePaymentBanner } from '@/components/payments/OverduePaymentBanner';
import { PaymentHistoryList } from '@/components/payments/PaymentHistoryList';
import { PaymentDueSkeleton } from '@/components/payments/PaymentDueSkeleton';
import { SkeletonPulse } from '@/components/common/SkeletonPulse';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/spacing';
import type { PaymentObligation } from '@/types/payments.types';
import type { TontineListItem } from '@/types/tontine';
import {
  buildPaymentObligations,
  isPendingPipelineTontine,
  sortPayObligations,
  sumPaidThisMonth,
  sumPenaltiesThisMonth,
  sumPendingDueAmount,
} from '@/screens/payments/cotisationsObligations';
import { paymentHistoryItemToEntry } from '@/screens/payments/paymentEntryMappers';
import { openPaymentHistoryItemDetail } from '@/screens/payments/paymentHistoryNavigation';

export interface CotisationsMetrics {
  paidThisMonth: number;
  pendingTotal: number;
  penaltiesThisMonth: number;
}

export interface CotisationsTabProps {
  filterPeriod: FilterPeriod;
  onMetricsChange: (m: CotisationsMetrics) => void;
}

type ChipFilter = 'all' | 'due' | 'paid' | 'late' | 'pending';

function payableSection(obligations: PaymentObligation[]): PaymentObligation[] {
  return obligations.filter(
    (o) =>
      o.obligationStatus !== 'PAID' && o.obligationStatus !== 'UPCOMING'
  );
}

function filterObligations(
  obligations: PaymentObligation[],
  chip: ChipFilter,
  tontineByUid: Map<string, TontineListItem>
): PaymentObligation[] {
  switch (chip) {
    case 'all':
      return obligations;
    case 'due':
      return obligations.filter((o) =>
        ['OVERDUE', 'DUE_TODAY', 'DUE_SOON'].includes(o.obligationStatus)
      );
    case 'paid':
      return obligations.filter((o) => o.obligationStatus === 'PAID');
    case 'late':
      return obligations.filter((o) => o.obligationStatus === 'OVERDUE');
    case 'pending': {
      return obligations.filter((o) => {
        const t = tontineByUid.get(o.tontineUid);
        return t != null ? isPendingPipelineTontine(t) : false;
      });
    }
    default:
      return obligations;
  }
}

export const CotisationsTab: React.FC<CotisationsTabProps> = ({
  filterPeriod,
  onMetricsChange,
}) => {
  const userUid = useSelector(selectUserUid);
  const [chip, setChip] = useState<ChipFilter>('all');

  const { tontines, isLoading: tontinesLoading, refetch: refetchTontines } =
    useTontines({ includeInvitations: false });

  const { nextPayment, isLoading: nextLoading, refetch: refetchNextPayment } =
    useNextPayment();

  const { items: cashHistoryForWaive } = useContributionHistory(undefined, {
    methodFilter: 'CASH',
    sortField: 'date',
    sortOrder: 'desc',
  });

  const { items: itemsMonthMetrics, refetch: refetchMonthMetrics } =
    useContributionHistory(undefined, {
      filterPeriod: 'current_month',
      sortField: 'date',
      sortOrder: 'desc',
    });

  const {
    items: historyItems,
    isLoading: historyLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch: refetchHistory,
  } = useContributionHistory(undefined, {
    filterPeriod,
    sortField: 'date',
    sortOrder: 'desc',
  });

  const tontineByUid = useMemo(() => {
    const m = new Map<string, TontineListItem>();
    for (const t of tontines) m.set(t.uid, t);
    return m;
  }, [tontines]);

  const obligations = useMemo(
    () => buildPaymentObligations(tontines, nextPayment, cashHistoryForWaive),
    [tontines, nextPayment, cashHistoryForWaive]
  );

  const payNowBase = useMemo(
    () => sortPayObligations(payableSection(obligations)),
    [obligations]
  );

  const filteredPay = useMemo(
    () => sortPayObligations(filterObligations(obligations, chip, tontineByUid)),
    [obligations, chip, tontineByUid]
  );

  const dueCount = useMemo(
    () =>
      obligations.filter((o) =>
        ['OVERDUE', 'DUE_TODAY', 'DUE_SOON'].includes(o.obligationStatus)
      ).length,
    [obligations]
  );

  const pendingPipelineCount = useMemo(
    () =>
      obligations.filter((o) => {
        const t = tontineByUid.get(o.tontineUid);
        return t != null ? isPendingPipelineTontine(t) : false;
      }).length,
    [obligations, tontineByUid]
  );

  useEffect(() => {
    onMetricsChange({
      paidThisMonth: sumPaidThisMonth(itemsMonthMetrics),
      pendingTotal: sumPendingDueAmount(obligations),
      penaltiesThisMonth: sumPenaltiesThisMonth(itemsMonthMetrics),
    });
  }, [itemsMonthMetrics, obligations, onMetricsChange]);

  const navigateTontine = useCallback((o: PaymentObligation) => {
    if (!navigationRef.isReady()) return;
    navigationRef.navigate('TontineDetails', {
      tontineUid: o.tontineUid,
      isCreator: o.isCreator,
    });
  }, []);

  const onShare = useCallback(async (o: PaymentObligation) => {
    try {
      await Share.share({
        message: `${o.tontineName} — cotisation Kelemba — ${Math.round(o.totalAmountDue)} FCFA`,
      });
    } catch {
      /* annulation */
    }
  }, []);

  const openHistoryFull = useCallback(() => {
    if (!navigationRef.isReady()) return;
    navigationRef.navigate('PaymentHistory', { filterPeriod });
  }, [filterPeriod]);

  const onHistoryEntryPress = useCallback(
    (uid: string) => {
      const raw = historyItems.find((i) => i.uid === uid);
      if (raw) openPaymentHistoryItemDetail(raw, userUid);
    },
    [historyItems, userUid]
  );

  const historyEntriesPreview = useMemo(
    () => historyItems.slice(0, 5).map(paymentHistoryItemToEntry),
    [historyItems]
  );

  const firstOverdue = useMemo(
    () => payNowBase.find((o) => o.obligationStatus === 'OVERDUE'),
    [payNowBase]
  );

  const listToRender = useMemo(() => {
    if (chip === 'all') return payNowBase;
    return filteredPay;
  }, [chip, payNowBase, filteredPay]);

  const bannerOverdue = useMemo(
    () => listToRender.find((o) => o.obligationStatus === 'OVERDUE'),
    [listToRender]
  );

  const refreshing =
    tontinesLoading ||
    nextLoading ||
    (historyLoading && historyItems.length === 0);

  const onRefresh = useCallback(async () => {
    await Promise.all([
      refetchTontines(),
      refetchNextPayment(),
      refetchHistory(),
      refetchMonthMetrics(),
    ]);
  }, [
    refetchHistory,
    refetchMonthMetrics,
    refetchNextPayment,
    refetchTontines,
  ]);

  const showSkeleton =
    (tontinesLoading || nextLoading) && obligations.length === 0;

  const renderPayCard = useCallback(
    (o: PaymentObligation) => (
      <PaymentDueCard
        obligation={o}
        onPayPress={() => navigateTontine(o)}
        onViewRotation={() => navigateTontine(o)}
        onShare={() => void onShare(o)}
        onReceiptPress={undefined}
      />
    ),
    [navigateTontine, onShare]
  );

  const chipRow = useMemo(
    () => (
      <View style={{ height: 64 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          <Chip
            label="Toutes"
            selected={chip === 'all'}
            onPress={() => setChip('all')}
          />
          <Chip
            label={`À payer (${dueCount})`}
            selected={chip === 'due'}
            onPress={() => setChip('due')}
          />
          <Chip
            label="Payées"
            selected={chip === 'paid'}
            onPress={() => setChip('paid')}
          />
          <Chip
            label="En retard"
            selected={chip === 'late'}
            onPress={() => setChip('late')}
          />
          <Chip
            label={`En attente (${pendingPipelineCount})`}
            selected={chip === 'pending'}
            onPress={() => setChip('pending')}
          />
        </ScrollView>
      </View>
    ),
    [chip, dueCount, pendingPipelineCount]
  );

  if (chip !== 'all') {
    return (
      <FlatList
        data={listToRender}
        keyExtractor={(o) => o.tontineUid}
        renderItem={({ item }) => (
          <View style={styles.cardPad}>{renderPayCard(item)}</View>
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        ListHeaderComponent={
          <>
            {bannerOverdue != null ? (
              <OverduePaymentBanner
                tontineName={bannerOverdue.tontineName}
                daysLate={bannerOverdue.daysLate}
                onPayPress={() => navigateTontine(bannerOverdue)}
              />
            ) : null}
            {chipRow}
          </>
        }
        ListEmptyComponent={
          <Text style={styles.emptyMuted}>
            Aucune cotisation ne correspond à ce filtre.
          </Text>
        }
      />
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void onRefresh()}
          tintColor={COLORS.primary}
          colors={[COLORS.primary]}
        />
      }
    >
      {firstOverdue != null ? (
        <OverduePaymentBanner
          tontineName={firstOverdue.tontineName}
          daysLate={firstOverdue.daysLate}
          onPayPress={() => navigateTontine(firstOverdue)}
        />
      ) : null}

      {chipRow}

      {showSkeleton ? (
        <>
          <PaymentDueSkeleton />
          <PaymentDueSkeleton />
          <View style={styles.histSkel}>
            <SkeletonPulse width="60%" height={12} borderRadius={4} />
            <SkeletonPulse width="100%" height={48} borderRadius={8} />
          </View>
        </>
      ) : (
        <>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>À payer maintenant</Text>
          </View>
          <View style={styles.cardPad}>
            {payNowBase.length === 0 ? (
              <Text style={styles.emptyMuted}>
                Toutes vos cotisations sont à jour
              </Text>
            ) : (
              payNowBase.map((o) => (
                <View key={o.tontineUid}>{renderPayCard(o)}</View>
              ))
            )}
          </View>

          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Historique</Text>
          </View>
          {historyItems.length === 0 && !historyLoading ? (
            <Text style={styles.emptyMuted}>
              Aucun historique sur cette période.
            </Text>
          ) : (
            <PaymentHistoryList
              entries={historyEntriesPreview}
              onSeeAll={openHistoryFull}
              onItemPress={(e) => onHistoryEntryPress(e.uid)}
            />
          )}
          {hasNextPage ? (
            <Pressable
              onPress={() => fetchNextPage()}
              style={({ pressed }) => [
                styles.loadMore,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.loadMoreText}>
                {isFetchingNextPage ? 'Chargement…' : 'Charger plus'}
              </Text>
            </Pressable>
          ) : null}
        </>
      )}
    </ScrollView>
  );
};

function Chip(props: {
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
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: SPACING.xl },
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
  sectionHead: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 12,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  emptyMuted: {
    padding: 16,
    fontSize: 13,
    color: COLORS.gray500,
    textAlign: 'center',
  },
  histSkel: {
    paddingHorizontal: SPACING.lg,
    gap: 8,
    marginTop: 12,
  },
  loadMore: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.primary,
  },
  pressed: { opacity: 0.88 },
});
