/**
 * Onglet Paiements — historique filtré sur la tontine + espèces organisateur.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { validateCashPayment } from '@/api/cashPaymentApi';
import { useTontineDetails } from '@/hooks/useTontineDetails';
import { usePaymentHistory } from '@/hooks/usePaymentHistory';
import { useOrganizerCashPendingForTontine } from '@/hooks/useOrganizerCashPendingForTontine';
import { CashValidationCard } from '@/components/payments/CashValidationCard';
import { COLORS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/spacing';
import { formatFcfaAmount } from '@/utils/formatters';
import type { RootStackParamList } from '@/navigation/types';
import type { PaymentHistoryItem } from '@/types/tontine';
import { logger } from '@/utils/logger';

const FILTERS = ['all', 'success', 'inProgress', 'failed'] as const;

export interface PaymentsTabProps {
  uid: string;
  isCreator: boolean;
}

export const PaymentsTab: React.FC<PaymentsTabProps> = ({ uid, isCreator }) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const [filter, setFilter] =
    useState<(typeof FILTERS)[number]>('all');
  const { tontine } = useTontineDetails(uid);
  const {
    payments,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
    isFetching,
  } = usePaymentHistory(uid, filter);

  const { items: cashItems, refetch: refetchCash } =
    useOrganizerCashPendingForTontine(uid, isCreator);

  const [busyUid, setBusyUid] = useState<string | null>(null);

  const cashMutation = useMutation({
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
    onMutate: (v) => setBusyUid(v.paymentUid),
    onSettled: () => setBusyUid(null),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['payments', 'cash', 'organizer', 'pending-actions'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['payments', 'cash', 'organizer', 'pending-count'],
      });
      void refetchCash();
    },
    onError: (err: unknown) => {
      logger.error('[PaymentsTab] cash', err);
      Alert.alert('Erreur', "L'action n'a pas pu être enregistrée.");
    },
  });

  const onRefresh = useCallback(() => {
    void refetch();
    void refetchCash();
  }, [refetch, refetchCash]);

  const renderPayment = useCallback(
    ({ item }: { item: PaymentHistoryItem }) => (
      <Pressable
        style={styles.payCard}
        onPress={() => {
          const method =
            item.method === 'ORANGE_MONEY' ||
            item.method === 'TELECEL_MONEY' ||
            item.method === 'CASH'
              ? item.method
              : 'CASH';
          navigation.navigate('PaymentStatusScreen', {
            paymentUid: item.uid,
            tontineUid: uid,
            tontineName: item.tontineName,
            amount: item.totalPaid,
            method,
            initialStatus: item.status as
              | 'PENDING'
              | 'PROCESSING'
              | 'COMPLETED'
              | 'FAILED'
              | 'REFUNDED',
          });
        }}
      >
        <View style={styles.payHeader}>
          <Text style={styles.cycleLbl}>Cycle {item.cycleNumber}</Text>
          <Text style={styles.statusLbl}>{item.status}</Text>
        </View>
        <Text style={styles.amt}>{formatFcfaAmount(item.amount)} FCFA</Text>
        {item.penalty > 0 ? (
          <Text style={styles.pen}>+ pénalité {formatFcfaAmount(item.penalty)}</Text>
        ) : null}
      </Pressable>
    ),
    [navigation, uid]
  );

  const refreshing = isFetching && payments.length === 0;

  return (
    <View style={styles.flex}>
      {isCreator && cashItems.length > 0 ? (
        <View style={styles.cashSection}>
          <Text style={styles.sectionTitle}>Espèces en attente</Text>
          {cashItems.map((item) => (
            <CashValidationCard
              key={item.paymentUid}
              item={item}
              onApprove={(paymentUid) =>
                cashMutation.mutate({ paymentUid, action: 'APPROVE' })
              }
              onReject={(paymentUid, reason) =>
                cashMutation.mutate({
                  paymentUid,
                  action: 'REJECT',
                  rejectionReason: reason,
                })
              }
              isApproving={busyUid === item.paymentUid && cashMutation.isPending}
              isRejecting={busyUid === item.paymentUid && cashMutation.isPending}
            />
          ))}
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>
        Mon historique — {tontine?.name ?? '…'}
      </Text>
      <View style={styles.filterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((f) => (
            <Pressable
              key={f}
              style={[styles.chip, filter === f && styles.chipOn]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.chipTxt, filter === f && styles.chipTxtOn]}>
                {f === 'all'
                  ? 'Tous'
                  : f === 'success'
                    ? 'Réussis'
                    : f === 'inProgress'
                      ? 'En cours'
                      : 'Échoués'}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={payments}
        keyExtractor={(i) => i.uid}
        renderItem={renderPayment}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.3}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>Aucun paiement pour cette tontine.</Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  cashSection: { paddingHorizontal: 16, paddingTop: 12 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray500,
    paddingHorizontal: 16,
    marginBottom: 8,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  filterWrap: { height: 48, marginBottom: 4 },
  filterRow: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  chipOn: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  chipTxt: { fontSize: 13, color: COLORS.gray500 },
  chipTxtOn: { color: COLORS.primary, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  payCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
  },
  payHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cycleLbl: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  statusLbl: { fontSize: 11, color: COLORS.gray500 },
  amt: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  pen: { fontSize: 11, color: COLORS.secondaryText, marginTop: 2 },
  empty: { textAlign: 'center', color: COLORS.gray500, marginTop: 24 },
});
