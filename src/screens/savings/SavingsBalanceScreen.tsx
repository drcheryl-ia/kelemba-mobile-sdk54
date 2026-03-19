/**
 * Vue personnelle — solde, historique, projection.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/navigation/types';
import { useMyBalance, useSavingsPeriods, useSavingsContributions } from '@/hooks/useSavings';
import { formatFCFA, isUnlockReached, isPeriodOpen } from '@/utils/savings.utils';
import { useSavingsDashboard } from '@/hooks/useSavings';

type Route = RouteProp<RootStackParamList, 'SavingsBalanceScreen'>;

export const SavingsBalanceScreen: React.FC = () => {
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const { tontineUid } = route.params;
  const [selectedPeriodUid, setSelectedPeriodUid] = useState<string | null>(null);

  const { data: balance, isLoading: balanceLoading } = useMyBalance(tontineUid);
  const { data: dashboard } = useSavingsDashboard(tontineUid);
  const { data: periods = [] } = useSavingsPeriods(tontineUid);
  const currentPeriod = balance?.currentPeriod ?? dashboard?.currentPeriod;
  const periodForQuery = selectedPeriodUid ?? currentPeriod?.uid ?? periods[0]?.uid ?? '';
  const { data: contributions = [], isLoading: contribLoading } = useSavingsContributions(
    tontineUid,
    periodForQuery
  );
  const config = dashboard?.savingsConfig;
  const periodOpen = isPeriodOpen(currentPeriod ?? null);
  const unlockReached = config ? isUnlockReached(config.unlockDate) : false;
  const hasContributed = balance?.contributionThisPeriod != null;

  const effectivePeriodUid = selectedPeriodUid ?? currentPeriod?.uid ?? periods[0]?.uid ?? null;

  useEffect(() => {
    if (!selectedPeriodUid && (currentPeriod?.uid ?? periods[0]?.uid)) {
      setSelectedPeriodUid(currentPeriod?.uid ?? periods[0]?.uid ?? null);
    }
  }, [currentPeriod?.uid, periods, selectedPeriodUid]);

  if (balanceLoading || !balance) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1A6B3C" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Mon épargne</Text>
          <Text style={styles.balanceAmount}>{formatFCFA(balance.personalBalance)}</Text>
          <View style={styles.badgeRow}>
            {balance.isBonusEligible ? (
              <View style={styles.badgeEligible}>
                <Text style={styles.badgeText}>🏆 Bonus éligible</Text>
              </View>
            ) : (
              <View style={styles.badgeLost}>
                <Text style={styles.badgeText}>⚠️ Bonus perdu</Text>
              </View>
            )}
          </View>
          <Text style={styles.unlockText}>
            {unlockReached ? 'Disponible' : `Jours avant déblocage : ${balance.periodsRemaining ?? 0}`}
          </Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total versé brut</Text>
            <Text style={styles.statValue}>{formatFCFA(balance.totalContributed)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Périodes manquées</Text>
            <Text style={styles.statValue}>{balance.missedPeriodsCount}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Périodes restantes</Text>
            <Text style={styles.statValue}>{balance.periodsRemaining}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Solde estimé à l'échéance</Text>
            <Text style={styles.statValue}>{formatFCFA(balance.estimatedFinalBalance)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Historique des versements</Text>
        <View style={styles.periodSelector}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.periodRow}
          >
            {periods.map((p) => (
              <Pressable
                key={p.uid}
                style={[
                  styles.periodPill,
                  effectivePeriodUid === p.uid && styles.periodPillActive,
                ]}
                onPress={() => setSelectedPeriodUid(p.uid)}
              >
                <Text
                  style={[
                    styles.periodPillText,
                    effectivePeriodUid === p.uid && styles.periodPillTextActive,
                  ]}
                >
                  Période {p.periodNumber}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {contribLoading ? (
          <ActivityIndicator color="#1A6B3C" style={styles.loader} />
        ) : contributions.length === 0 ? (
          <Text style={styles.emptyText}>Aucun versement sur cette période</Text>
        ) : (
          contributions.map((c) => (
            <View key={c.uid} style={styles.contributionRow}>
              <Text style={styles.contribDate}>
                {c.paidAt ? new Date(c.paidAt).toLocaleDateString('fr-FR') : '—'}
              </Text>
              <Text style={styles.contribAmount}>{formatFCFA(c.netAmount)}</Text>
              <View style={[styles.contribBadge, c.status === 'COMPLETED' ? styles.badgeOk : styles.badgePending]}>
                <Text style={styles.contribBadgeText}>{c.status}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {((periodOpen && !hasContributed) || unlockReached) ? (
        <Pressable
          style={[
            styles.fab,
            unlockReached ? styles.fabGreen : styles.fabOrange,
          ]}
          onPress={() => {
            const nav = navigation as { navigate: (a: string, b: object) => void };
            if (unlockReached) {
              nav.navigate('SavingsWithdrawScreen', { tontineUid });
            } else if (currentPeriod) {
              nav.navigate('SavingsContributeScreen', {
                tontineUid,
                periodUid: currentPeriod.uid,
              });
            }
          }}
        >
          <Text style={styles.fabText}>
            {unlockReached ? 'Retirer mes fonds' : 'Verser maintenant'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  balanceCard: {
    backgroundColor: '#1A6B3C',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginBottom: 4 },
  balanceAmount: { fontSize: 32, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  badgeRow: { marginBottom: 8 },
  badgeEligible: { backgroundColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  badgeLost: { backgroundColor: '#D0021B', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  unlockText: { fontSize: 13, color: 'rgba(255,255,255,0.9)' },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  statValue: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E', marginBottom: 12 },
  periodSelector: { height: 44, marginBottom: 16 },
  periodRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  periodPill: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F7F8FA',
    justifyContent: 'center',
  },
  periodPillActive: { backgroundColor: '#1A6B3C' },
  periodPillText: { fontSize: 13, fontWeight: '600', color: '#666' },
  periodPillTextActive: { color: '#FFFFFF' },
  loader: { marginVertical: 20 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginVertical: 20 },
  contributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  contribDate: { flex: 1, fontSize: 14, color: '#1C1C1E' },
  contribAmount: { fontSize: 14, fontWeight: '600', color: '#1A6B3C', marginRight: 12 },
  contribBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  contribBadgeText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  badgeOk: { backgroundColor: '#1A6B3C' },
  badgePending: { backgroundColor: '#F5A623' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    height: 52,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  fabOrange: { backgroundColor: '#F5A623' },
  fabGreen: { backgroundColor: '#1A6B3C' },
  fabText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
