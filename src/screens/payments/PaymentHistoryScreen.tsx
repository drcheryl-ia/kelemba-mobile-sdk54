/**
 * Historique paiements — liste paginée (hors onglet).
 */
import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { selectUserUid } from '@/store/authSlice';
import type { RootStackParamList } from '@/navigation/types';
import {
  useContributionHistory,
  type FilterPeriod,
} from '@/hooks/useContributionHistory';
import { paymentHistoryItemToEntry } from '@/screens/payments/paymentEntryMappers';
import { PaymentHistoryItem } from '@/components/payments/PaymentHistoryItem';
import { openPaymentHistoryItemDetail } from '@/screens/payments/paymentHistoryNavigation';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/spacing';
import type { PaymentHistoryItem as ApiPaymentHistoryItem } from '@/types/tontine';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentHistory'>;

export const PaymentHistoryScreen: React.FC<Props> = ({ navigation, route }) => {
  const filterPeriod: FilterPeriod = route.params?.filterPeriod ?? 'all';
  const userUid = useSelector(selectUserUid);
  const {
    items,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useContributionHistory(undefined, {
    filterPeriod,
    sortField: 'date',
    sortOrder: 'desc',
  });

  const onPressEntry = useCallback(
    (row: ApiPaymentHistoryItem) => {
      openPaymentHistoryItemDetail(row, userUid);
    },
    [userUid]
  );

  const renderItem = useCallback(
    ({ item }: { item: ApiPaymentHistoryItem }) => (
      <PaymentHistoryItem
        entry={paymentHistoryItemToEntry(item)}
        onPress={() => onPressEntry(item)}
      />
    ),
    [onPressEntry]
  );

  const refreshing = isFetching && items.length === 0;

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={26} color={COLORS.primary} />
        </Pressable>
        <Text style={styles.title}>Historique des paiements</Text>
        <View style={{ width: 26 }} />
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.uid}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.35}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refetch()}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          !isLoading ? (
            <Text style={styles.empty}>Aucun paiement sur cette période.</Text>
          ) : null
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <Text style={styles.footer}>Chargement…</Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.gray100 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.gray200,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  list: { paddingBottom: SPACING.lg },
  empty: {
    textAlign: 'center',
    marginTop: SPACING.xl,
    color: COLORS.gray500,
    fontSize: 14,
    paddingHorizontal: SPACING.lg,
  },
  footer: {
    textAlign: 'center',
    paddingVertical: 10,
    color: COLORS.gray500,
    fontSize: 12,
  },
});
