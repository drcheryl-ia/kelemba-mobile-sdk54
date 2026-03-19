/**
 * Écran — Historique des cotisations (tab Paiements).
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '@/navigation/types';
import { useContributionHistory, type StatusFilter } from '@/hooks/useContributionHistory';
import { formatFcfa } from '@/utils/formatters';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import type { PaymentHistoryItem } from '@/types/tontine';

type Props = BottomTabScreenProps<MainTabParamList, 'Payments'>;

const STATUS_CONFIG: Record<
  PaymentHistoryItem['status'],
  { label: string; bg: string; text: string }
> = {
  PENDING: { label: 'En attente', bg: '#F5A623', text: '#FFFFFF' },
  PROCESSING: { label: 'En cours', bg: '#0055A5', text: '#FFFFFF' },
  COMPLETED: { label: 'Payé', bg: '#1A6B3C', text: '#FFFFFF' },
  FAILED: { label: 'Échoué', bg: '#D0021B', text: '#FFFFFF' },
  REFUNDED: { label: 'Remboursé', bg: '#8E8E93', text: '#FFFFFF' },
};

const FILTER_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: undefined, label: 'Tous' },
  { id: 'PENDING', label: 'En attente' },
  { id: 'PROCESSING', label: 'En cours' },
  { id: 'COMPLETED', label: 'Payé' },
  { id: 'FAILED', label: 'Échoué' },
  { id: 'REFUNDED', label: 'Remboursé' },
];

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const datePart = dateStr.split('T')[0];
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return '—';
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

export const ContributionHistoryScreen: React.FC<Props> = ({ navigation }) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(undefined);

  const {
    items,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useContributionHistory(statusFilter);

  const summary = useMemo(() => {
    const completed = items.filter((i) => i.status === 'COMPLETED');
    const totalVersé = completed.reduce((s, i) => s + i.amount, 0);
    const totalPénalités = completed.reduce((s, i) => s + i.penalty, 0);
    const sansPénalité = completed.filter((i) => i.penalty === 0).length;
    const taux =
      completed.length > 0
        ? Math.round((sansPénalité / completed.length) * 100)
        : 100;
    return { totalVersé, totalPénalités, taux };
  }, [items]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage) fetchNextPage();
  }, [hasNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: PaymentHistoryItem }) => {
      const config = STATUS_CONFIG[item.status];
      const dateStr = item.paidAt ?? item.createdAt ?? null;
      return (
        <View style={styles.paymentCard}>
          <View style={styles.cardRow1}>
            <Text style={styles.tontineName} numberOfLines={1}>
              {item.tontineName}
            </Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: config?.bg ?? '#8E8E93' },
              ]}
            >
              <Text style={styles.statusText}>
                {config?.label ?? item.status}
              </Text>
            </View>
          </View>
          <Text style={styles.cycleDate}>
            Cycle {item.cycleNumber} · {formatDate(dateStr)}
          </Text>
          <Text style={styles.amount}>{formatFcfa(item.amount)}</Text>
          {item.penalty > 0 && (
            <Text style={styles.penaltyText}>
              dont {formatFcfa(item.penalty)} de pénalité
            </Text>
          )}
          <View style={styles.methodRow}>
            {item.method === 'ORANGE_MONEY' && (
              <Ionicons name="phone-portrait" size={16} color="#F5A623" />
            )}
            {item.method === 'TELECEL_MONEY' && (
              <Ionicons name="phone-portrait" size={16} color="#0055A5" />
            )}
            {item.method === 'SYSTEM' && (
              <Ionicons name="server" size={16} color="#6B7280" />
            )}
            <Text style={styles.methodText}>
              {item.method === 'ORANGE_MONEY'
                ? 'Orange Money'
                : item.method === 'TELECEL_MONEY'
                  ? 'Telecel Money'
                  : item.method}
            </Text>
          </View>
        </View>
      );
    },
    []
  );

  const ListEmptyComponent = useCallback(
    () => (
      <View style={styles.emptyState}>
        <Ionicons name="receipt-outline" size={64} color="#8E8E93" />
        <Text style={styles.emptyText}>Aucune cotisation</Text>
      </View>
    ),
    []
  );

  const ListFooterComponent = useCallback(
    () =>
      isFetchingNextPage ? (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color="#1A6B3C" />
        </View>
      ) : null,
    [isFetchingNextPage]
  );

  if (isFetching && items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Retour"
          >
            <Ionicons name="arrow-back" size={24} color="#1A6B3C" />
          </Pressable>
          <Text style={styles.headerTitle}>Historique des cotisations</Text>
        </View>
        <View style={styles.skeleton}>
          <SkeletonBlock width="100%" height={100} borderRadius={16} />
          <SkeletonBlock width="100%" height={80} borderRadius={16} />
          <SkeletonBlock width="100%" height={80} borderRadius={16} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <Ionicons name="arrow-back" size={24} color="#1A6B3C" />
        </Pressable>
        <Text style={styles.headerTitle}>Historique des cotisations</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total versé</Text>
            <Text style={styles.summaryValue}>
              {formatFcfa(summary.totalVersé)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Pénalités</Text>
            <Text style={styles.summaryValue}>
              {formatFcfa(summary.totalPénalités)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Ponctualité</Text>
            <Text style={styles.summaryValue}>{summary.taux} %</Text>
          </View>
        </View>
      </View>

      <View style={styles.filterScrollView}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTER_OPTIONS.map((opt) => (
            <Pressable
              key={opt.id ?? 'all'}
              style={[
                styles.filterChip,
                statusFilter === opt.id && styles.filterChipActive,
              ]}
              onPress={() => setStatusFilter(opt.id)}
            >
              <Text
                style={[
                  styles.filterText,
                  statusFilter === opt.id && styles.filterTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.uid}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && items.length > 0}
            onRefresh={refetch}
            tintColor="#1A6B3C"
          />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  filterScrollView: {
    height: 52,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#1A6B3C',
    borderColor: '#1A6B3C',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 20,
    paddingBottom: 100, // 64 tab height + 20 margin + 16 safe area
    flexGrow: 1,
  },
  paymentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tontineName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cycleDate: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  penaltyText: {
    fontSize: 13,
    color: '#D0021B',
    marginBottom: 4,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  methodText: {
    fontSize: 12,
    color: '#6B7280',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
  },
  footerLoader: {
    padding: 16,
    alignItems: 'center',
  },
  skeleton: {
    padding: 20,
    gap: 12,
  },
});
