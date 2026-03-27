/**
 * Liste des périodes de cotisation — useSavingsPeriods.
 */
import React from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useSavingsPeriods } from '@/hooks/useSavings';
import { formatFcfa, formatDateLong } from '@/utils/formatters';
import { SavingsScreenHeader } from '@/components/savings';
import type { SavingsPeriod } from '@/types/savings.types';

type Route = RouteProp<RootStackParamList, 'SavingsPeriodsScreen'>;

function periodStatusStyle(
  status: SavingsPeriod['status']
): { bg: string; label: string } {
  if (status === 'OPEN') return { bg: '#1A6B3C', label: 'OPEN' };
  if (status === 'PENDING') return { bg: '#9E9E9E', label: 'PENDING' };
  return { bg: '#374151', label: 'CLOSED' };
}

export const SavingsPeriodsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Route>();
  const { uid } = route.params;

  const { data, isLoading, isError, refetch, isFetching } = useSavingsPeriods(uid);
  const periods = Array.isArray(data) ? data : [];

  const renderItem = ({ item }: { item: SavingsPeriod }) => {
    const st = periodStatusStyle(item.status);
    const openD = item.openDate.split('T')[0];
    const closeD = item.closeDate.split('T')[0];
    return (
      <View style={styles.row}>
        <View style={styles.rowHeader}>
          <Text style={styles.periodTitle}>Période {item.periodNumber}</Text>
          <View style={[styles.badge, { backgroundColor: st.bg }]}>
            <Text style={styles.badgeText}>{st.label}</Text>
          </View>
        </View>
        <Text style={styles.meta}>
          {formatDateLong(openD)} → {formatDateLong(closeD)}
        </Text>
        <Text style={styles.meta}>Minimum : {formatFcfa(item.minimumAmount)}</Text>
        {item.status === 'OPEN' ? (
          <Pressable
            style={styles.cta}
            onPress={() =>
              navigation.navigate('SavingsContributeScreen', {
                uid,
                periodUid: item.uid,
                minimumAmount: item.minimumAmount,
              })
            }
          >
            <Text style={styles.ctaText}>Verser maintenant</Text>
          </Pressable>
        ) : item.status === 'CLOSED' ? (
          <Text style={styles.doneLabel}>Terminée</Text>
        ) : null}
      </View>
    );
  };

  if (isLoading && !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <SavingsScreenHeader
          title="Périodes"
          onBack={() => navigation.goBack()}
          backAccessibilityLabel="Retour"
        />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1A6B3C" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <SavingsScreenHeader
          title="Périodes"
          onBack={() => navigation.goBack()}
          backAccessibilityLabel="Retour"
        />
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Impossible de charger les périodes.</Text>
          <Pressable style={styles.retryBtn} onPress={() => void refetch()}>
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <SavingsScreenHeader
        title="Périodes de cotisation"
        onBack={() => navigation.goBack()}
        backAccessibilityLabel="Retour"
        titleNumberOfLines={2}
      />
      <FlatList
        data={periods}
        keyExtractor={(p) => p.uid}
        renderItem={renderItem}
        contentContainerStyle={periods.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Aucune période disponible pour le moment
          </Text>
        }
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => void refetch()}
            tintColor="#1A6B3C"
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingBottom: 40 },
  emptyList: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  row: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  periodTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  meta: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  cta: {
    marginTop: 12,
    height: 48,
    backgroundColor: '#F5A623',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  doneLabel: { marginTop: 8, fontSize: 14, color: '#6B7280', fontWeight: '600' },
  emptyText: { textAlign: 'center', fontSize: 15, color: '#6B7280' },
  errorBox: { padding: 24 },
  errorText: { fontSize: 15, color: '#4B5563', marginBottom: 16 },
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#1A6B3C',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700' },
});