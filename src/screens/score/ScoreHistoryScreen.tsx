import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '@/navigation/types';
import { useKelembaScore } from '@/hooks/useKelembaScore';
import {
  ScoreLineChart,
  ScoreEventItem,
  ScoreFilterBar,
  ScoreStatsSummary,
} from '@/components/score';
import type {
  ScoreEventCategory,
  PeriodFilter,
} from '@/utils/scoreUtils';
import type { ScoreEventDto } from '@/types/user.types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ScoreHistory'>;

function filterHistory(
  history: ScoreEventDto[],
  categoryFilter: ScoreEventCategory,
  periodFilter: PeriodFilter
): ScoreEventDto[] {
  let result = [...history];

  if (categoryFilter === 'POSITIVE') {
    result = result.filter((e) => e.delta > 0);
  } else if (categoryFilter === 'NEGATIVE') {
    result = result.filter((e) => e.delta < 0);
  }

  if (periodFilter !== 'ALL') {
    const months =
      periodFilter === '1M' ? 1 : periodFilter === '3M' ? 3 : 6;
    const cutoff = Date.now() - months * 30 * 86_400_000;
    result = result.filter((e) => Date.parse(e.createdAt) >= cutoff);
  }

  return result;
}

export const ScoreHistoryScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const {
    score,
    scoreHistory,
    stats,
    isLoading,
    isError,
    refetch,
  } = useKelembaScore();

  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('ALL');
  const [categoryFilter, setCategoryFilter] =
    useState<ScoreEventCategory>('ALL');

  const filteredHistory = useMemo(
    () => filterHistory(scoreHistory, categoryFilter, periodFilter),
    [scoreHistory, categoryFilter, periodFilter]
  );

  const ListHeader = useMemo(
    () => (
      <View style={styles.headerContent}>
        <ScoreLineChart history={scoreHistory} currentScore={score} />
        <ScoreFilterBar
          periodFilter={periodFilter}
          categoryFilter={categoryFilter}
          onPeriodChange={setPeriodFilter}
          onCategoryChange={setCategoryFilter}
        />
        {stats && (
          <ScoreStatsSummary
            totalEvents={stats.totalEvents}
            positiveEvents={stats.positiveEvents}
            negativeEvents={stats.negativeEvents}
          />
        )}
        <Text style={styles.sectionTitle}>{t('score.eventsTitle')}</Text>
      </View>
    ),
    [
      scoreHistory,
      score,
      periodFilter,
      categoryFilter,
      stats,
      t,
    ]
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
          </Pressable>
          <Text style={styles.headerTitle}>{t('profile.improveScore')}</Text>
        </View>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#1A6B3C" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
          </Pressable>
          <Text style={styles.headerTitle}>{t('profile.improveScore')}</Text>
        </View>
        <View style={styles.loading}>
          <Text style={styles.errorText}>{t('common.error')}</Text>
          <Pressable style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryText}>{t('notifications.retry')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
        </Pressable>
        <Text style={styles.headerTitle}>{t('profile.improveScore')}</Text>
      </View>

      <FlatList
        data={filteredHistory}
        keyExtractor={(item) => item.uid}
        ListHeaderComponent={ListHeader}
        renderItem={({ item }) => <ScoreEventItem event={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t('score.emptyEvents')}</Text>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  headerContent: {
    paddingBottom: 16,
  },
  listContent: {
    paddingBottom: 40,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 16,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#1A6B3C',
    borderRadius: 8,
  },
  retryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 24,
  },
});
