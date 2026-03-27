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
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import type { RootStackParamList } from '@/navigation/types';
import { selectUserUid } from '@/store/authSlice';
import { useMyBalance, useSavingsPeriods, useSavingsContributions } from '@/hooks/useSavings';
import { formatFCFA, isUnlockReached, isPeriodOpen } from '@/utils/savings.utils';
import { useSavingsDashboard } from '@/hooks/useSavings';
import { SavingsScreenHeader } from '@/components/savings';

type Route = RouteProp<RootStackParamList, 'SavingsBalanceScreen'>;

export const SavingsBalanceScreen: React.FC = () => {
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { tontineUid } = route.params;
  const userUid = useSelector(selectUserUid);
  const [selectedPeriodUid, setSelectedPeriodUid] = useState<string | null>(null);

  const {
    data: balance,
    isLoading: balanceLoading,
    isError: balanceError,
    refetch: refetchBalance,
    isFetching: balanceFetching,
  } = useMyBalance(tontineUid);
  const { data: dashboard } = useSavingsDashboard(tontineUid);
  const { data: periodsRaw } = useSavingsPeriods(tontineUid);
  const periods = Array.isArray(periodsRaw) ? periodsRaw : [];
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

  if (balanceLoading && !balance) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <SavingsScreenHeader
          title={t('savingsBalance.defaultTitle')}
          onBack={() => navigation.goBack()}
          titleNumberOfLines={1}
        />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1A6B3C" />
        </View>
      </SafeAreaView>
    );
  }

  if (balanceError && !balance) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <SavingsScreenHeader
          title={t('savingsBalance.defaultTitle')}
          onBack={() => navigation.goBack()}
          titleNumberOfLines={1}
        />
        <View style={[styles.container, styles.centered]}>
          <Text style={styles.errorTitle}>{t('savingsBalance.loadErrorTitle')}</Text>
          <Text style={styles.errorHint}>{t('savingsBalance.loadErrorHint')}</Text>
          <Pressable style={styles.retryBtn} onPress={() => void refetchBalance()}>
            <Text style={styles.retryBtnText}>{t('savingsBalance.retry')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!balance) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <SavingsScreenHeader
          title={t('savingsBalance.defaultTitle')}
          onBack={() => navigation.goBack()}
          titleNumberOfLines={1}
        />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1A6B3C" />
        </View>
      </SafeAreaView>
    );
  }

  const headerTitle = dashboard?.tontine.name ?? t('savingsBalance.defaultTitle');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <SavingsScreenHeader
        title={headerTitle}
        subtitle={t('savingsBalance.subtitle')}
        onBack={() => navigation.goBack()}
        titleNumberOfLines={2}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={balanceFetching}
            onRefresh={() => void refetchBalance()}
            tintColor="#1A6B3C"
          />
        }
      >
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{t('savingsBalance.mySavings')}</Text>
          <Text style={styles.balanceAmount}>{formatFCFA(balance.personalBalance)}</Text>
          <View style={styles.badgeRow}>
            {balance.isBonusEligible ? (
              <View style={styles.badgeEligible}>
                <Text style={styles.badgeText}>{t('savingsBalance.bonusEligible')}</Text>
              </View>
            ) : (
              <View style={styles.badgeLost}>
                <Text style={styles.badgeText}>{t('savingsBalance.bonusNotEligible')}</Text>
              </View>
            )}
          </View>
          <Text style={styles.unlockText}>
            {unlockReached
              ? t('savingsBalance.available')
              : t('savingsBalance.daysBeforeUnlock', { count: balance.periodsRemaining ?? 0 })}
          </Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{t('savingsBalance.totalContributed')}</Text>
            <Text style={styles.statValue}>{formatFCFA(balance.totalContributed)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{t('savingsBalance.missedPeriods')}</Text>
            <Text style={styles.statValue}>{balance.missedPeriodsCount}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{t('savingsBalance.periodsRemaining')}</Text>
            <Text style={styles.statValue}>{balance.periodsRemaining}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{t('savingsBalance.estimatedAtEnd')}</Text>
            <Text style={styles.statValue}>{formatFCFA(balance.estimatedFinalBalance)}</Text>
          </View>
        </View>

        <Text style={styles.disclaimer}>{t('savingsBalance.disclaimer')}</Text>

        <Text style={styles.sectionTitle}>{t('savingsBalance.historyTitle')}</Text>
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
                  {t('savingsBalance.periodChip', { n: p.periodNumber })}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {contribLoading ? (
          <ActivityIndicator color="#1A6B3C" style={styles.loader} />
        ) : contributions.length === 0 ? (
          <Text style={styles.emptyText}>{t('savingsBalance.emptyPeriod')}</Text>
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
            { bottom: 24 + insets.bottom },
          ]}
          onPress={() => {
            const nav = navigation as { navigate: (a: string, b: object) => void };
            if (unlockReached) {
              const memberUid =
                dashboard?.members.find((m) => m.userUid === userUid)?.uid ?? '';
              if (!memberUid) return;
              nav.navigate('SavingsWithdrawScreen', { uid: tontineUid, memberUid });
            } else if (currentPeriod) {
              const min =
                currentPeriod.minimumAmount ??
                config?.minimumContribution ??
                500;
              nav.navigate('SavingsContributeScreen', {
                uid: tontineUid,
                periodUid: currentPeriod.uid,
                minimumAmount: min,
              });
            }
          }}
        >
          <Text style={styles.fabText}>
            {unlockReached ? t('savingsBalance.fabWithdraw') : t('savingsBalance.fabContribute')}
          </Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E', marginBottom: 8, textAlign: 'center' },
  errorHint: { fontSize: 14, color: '#6B7280', marginBottom: 16, textAlign: 'center' },
  retryBtn: {
    backgroundColor: '#1A6B3C',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20 },
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
  disclaimer: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 18,
  },
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
