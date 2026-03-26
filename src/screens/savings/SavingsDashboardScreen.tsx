/**
 * Vue collective — qui a versé, qui n'a pas versé, solde bonus.
 */
import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/navigation/types';
import { useSavingsDashboard } from '@/hooks/useSavings';
import { formatFCFA, daysUntil } from '@/utils/savings.utils';
import { SavingsProgressBar, SavingsMemberRow, SavingsScreenHeader } from '@/components/savings';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';
import { selectUserUid } from '@/store/authSlice';

type Route = RouteProp<RootStackParamList, 'SavingsDashboardScreen'>;

export const SavingsDashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { tontineUid } = route.params;
  const currentUserUid = useSelector(selectUserUid) ?? '';

  const { data: dashboard, isLoading, refetch, isFetching } = useSavingsDashboard(tontineUid);

  if (isLoading || !dashboard) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <SavingsScreenHeader
          title="…"
          onBack={() => navigation.goBack()}
          titleNumberOfLines={1}
        />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1A6B3C" />
        </View>
      </SafeAreaView>
    );
  }

  const config = dashboard.savingsConfig;
  const currentPeriod = dashboard.currentPeriod;
  const targetGlobal = config?.targetAmountGlobal;
  const currentAmount =
    targetGlobal != null && dashboard.globalProgressPercent != null
      ? (dashboard.globalProgressPercent / 100) * targetGlobal
      : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <SavingsScreenHeader
        title={dashboard.tontine.name}
        subtitle="Vue collective"
        onBack={() => navigation.goBack()}
        titleNumberOfLines={2}
      />
      <FlatList
        style={styles.list}
        data={dashboard.members ?? []}
        keyExtractor={(m) => m.uid}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor="#1A6B3C" />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            {targetGlobal != null && (
              <View style={styles.progressSection}>
                <SavingsProgressBar
                  current={currentAmount}
                  target={targetGlobal}
                  showLabel
                />
                <Text style={styles.progressLabel}>
                  {formatFCFA(Math.round(currentAmount))} / {formatFCFA(targetGlobal)} collectés
                </Text>
              </View>
            )}
            <View style={styles.bonusBadge}>
              <Text style={styles.bonusText}>
                Cagnotte commune : {formatFCFA(dashboard.bonusPoolBalance)}
              </Text>
            </View>
            {currentPeriod && (
              <Text style={styles.periodText}>
                Période {currentPeriod.periodNumber} — du{' '}
                {new Date(currentPeriod.openDate).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                })}{' '}
                au{' '}
                {new Date(currentPeriod.closeDate).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                })}{' '}
                · {daysUntil(currentPeriod.closeDate)} jours restants
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <SavingsMemberRow
            member={item}
            isPrivate={config?.isPrivate ?? false}
            currentUserUid={currentUserUid}
            periodStatus={currentPeriod?.status}
          />
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },
  list: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 20 },
  progressSection: { marginBottom: 12 },
  progressLabel: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  bonusBadge: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  bonusText: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  periodText: { fontSize: 13, color: '#6B7280' },
});
