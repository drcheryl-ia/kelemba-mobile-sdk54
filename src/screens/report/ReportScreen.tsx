/**
 * Rapport — bilan, tontines, score, exports (données React Query).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  StyleSheet,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { ScoreGauge } from '@/components/dashboard/ScoreGauge';
import {
  ReportSummaryGrid,
  BilanTab,
  TontinesReportTab,
  ScoreTab,
  ExportsTab,
  ReportSkeleton,
} from '@/components/report';
import { ENDPOINTS } from '@/api/endpoints';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';
import { selectUserUid } from '@/store/authSlice';
import { navigationRef } from '@/navigation/navigationRef';
import type { MainTabParamList } from '@/navigation/types';
import type { ReportPeriod, ReportMetrics } from '@/types/report.types';
import { getPeriodStartDate } from '@/utils/reportPeriod';
import { buildTontineReportItems } from '@/utils/reportMetricsBuilder';
import { toScoreEventDisplays } from '@/utils/reportReasonLabels';
import { openAuthenticatedReportUrl } from '@/utils/reportOpenUrl';
import { useGetMyTontines } from '@/hooks/report/useGetMyTontines';
import { useGetMyPaymentHistory } from '@/hooks/report/useGetMyPaymentHistory';
import { useGetScore } from '@/hooks/score/useGetScore';

type ReportTab = 'bilan' | 'tontines' | 'score' | 'exports';

function getPeriodLabelText(period: ReportPeriod): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (period === 'all') return "Tout l'historique · Résumé personnel";
  if (period === 'year') return `Année ${y} · Résumé personnel`;
  if (period === 'quarter') {
    const q = Math.ceil((m + 1) / 3);
    return `Trimestre ${q} ${y} · Résumé personnel`;
  }
  const month = new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
  }).format(now);
  const cap = month.charAt(0).toUpperCase() + month.slice(1);
  return `${cap} · Résumé personnel`;
}

export default function ReportScreen() {
  const queryClient = useQueryClient();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList, 'Report'>>();
  const userUid = useSelector(selectUserUid) ?? '';

  const [activePeriod, setActivePeriod] = useState<ReportPeriod>('current_month');
  const periodRef = useRef(activePeriod);

  useEffect(() => {
    if (periodRef.current !== activePeriod) {
      periodRef.current = activePeriod;
      void queryClient.invalidateQueries({ queryKey: ['payments', 'my-history', 'report'] });
    }
  }, [activePeriod, queryClient]);

  const [activeTab, setActiveTab] = useState<ReportTab>('bilan');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const tontinesQuery = useGetMyTontines();
  const paymentHistoryQuery = useGetMyPaymentHistory({ period: activePeriod });
  const scoreQuery = useGetScore();

  const isLoadingGlobal = tontinesQuery.isLoading || scoreQuery.isLoading;
  const paymentsLoading = paymentHistoryQuery.isLoading || paymentHistoryQuery.isFetching;

  const metrics = useMemo((): ReportMetrics => {
    const tontines = tontinesQuery.data?.tontines ?? [];
    const payments = paymentHistoryQuery.data?.items ?? [];
    const scoreData = scoreQuery.data;

    const fromDate = getPeriodStartDate(activePeriod);
    const filtered = fromDate
      ? payments.filter((p) => {
          if (p.paidAt == null || p.paidAt === '') return false;
          return new Date(p.paidAt).getTime() >= fromDate.getTime();
        })
      : payments;

    const completedPayments = filtered.filter((p) => p.status === 'COMPLETED');
    const allCompleted = payments.filter((p) => p.status === 'COMPLETED');

    const totalPaidAllTime = Math.round(
      allCompleted.reduce((s, p) => s + p.amount, 0)
    );
    const paidThisPeriod = Math.round(
      completedPayments.reduce((s, p) => s + p.amount, 0)
    );
    const penaltiesPaid = Math.round(
      completedPayments.reduce((s, p) => s + (p.penalty ?? 0), 0)
    );

    const contributionsExcludingPenalty = paidThisPeriod;

    const cyclesTotal = scoreData?.stats?.totalEvents ?? 0;
    const cyclesOnTime = scoreData?.stats?.positiveEvents ?? 0;
    const punctualityRate =
      cyclesTotal > 0 ? Math.round((cyclesOnTime / cyclesTotal) * 100) : 100;

    const activeTontines = tontines.filter(
      (t) =>
        t.membershipStatus === 'ACTIVE' &&
        (t.status === 'ACTIVE' ||
          t.status === 'BETWEEN_ROUNDS' ||
          t.status === 'PAUSED')
    );
    const completedTontines = tontines.filter((t) => t.status === 'COMPLETED');

    const nextPayout = [...activeTontines]
      .filter((t) => t.myPayoutCycleNumber != null && !t.isMyTurnNow)
      .sort(
        (a, b) =>
          (a.myPayoutCycleNumber! - (a.currentCycleNumber ?? 0)) -
          (b.myPayoutCycleNumber! - (b.currentCycleNumber ?? 0))
      )[0];

    const lateCyclesCount = Math.max(
      0,
      completedPayments.length -
        completedPayments.filter((p) => p.penalty === 0).length
    );
    const lateDaysSum = lateCyclesCount * 5;

    let nextAmt: number | null = null;
    if (nextPayout != null) {
      const raw =
        nextPayout.payoutNetAmount ??
        nextPayout.beneficiaryNetAmount ??
        nextPayout.amountPerShare * (nextPayout.userSharesCount ?? 1);
      nextAmt = Math.round(raw);
      if (nextAmt <= 0) nextAmt = null;
    }

    return {
      totalPaidAllTime,
      paidThisPeriod,
      penaltiesPaid,
      punctualityRate,
      cyclesOnTime,
      cyclesTotal,
      completedTontinesCount: completedTontines.length,
      activeTontinesCount: activeTontines.length,
      nextPayoutAmount: nextAmt,
      nextPayoutTontineName: nextPayout?.name ?? null,
      nextPayoutCycleNumber: nextPayout?.myPayoutCycleNumber ?? null,
      contributionsExcludingPenalty,
      totalReceivedAsBeneficiaryPeriod: 0,
      lateCyclesCount,
      lateDaysSum,
    };
  }, [
    tontinesQuery.data,
    paymentHistoryQuery.data,
    scoreQuery.data,
    activePeriod,
  ]);

  const tontineReportItems = useMemo(() => {
    const tontines = tontinesQuery.data?.tontines ?? [];
    const payments = paymentHistoryQuery.data?.items ?? [];
    const list = tontines.filter((t) =>
      ['ACTIVE', 'COMPLETED', 'BETWEEN_ROUNDS', 'PAUSED'].includes(t.status)
    );
    return buildTontineReportItems(list, payments);
  }, [tontinesQuery.data, paymentHistoryQuery.data]);

  const scoreDisplays = useMemo(
    () => toScoreEventDisplays(scoreQuery.data?.history ?? []),
    [scoreQuery.data?.history]
  );

  const currentScore = Math.round(scoreQuery.data?.currentScore ?? 0);

  const handleExportGlobalPdf = useCallback(() => {
    if (userUid === '') return;
    void openAuthenticatedReportUrl(ENDPOINTS.REPORTS.USER_CERTIFICATE(userUid).url);
  }, [userUid]);

  const showPeriodPicker = useCallback(() => {
    Alert.alert("Période d'analyse", undefined, [
      { text: 'Ce mois', onPress: () => setActivePeriod('current_month') },
      { text: 'Trimestre en cours', onPress: () => setActivePeriod('quarter') },
      { text: 'Cette année', onPress: () => setActivePeriod('year') },
      { text: "Tout l'historique", onPress: () => setActivePeriod('all') },
      { text: 'Annuler', style: 'cancel' },
    ]);
  }, []);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        tontinesQuery.refetch(),
        paymentHistoryQuery.refetch(),
        scoreQuery.refetch(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [tontinesQuery, paymentHistoryQuery, scoreQuery]);

  const onTontinePress = useCallback((uid: string) => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('TontineDetails', { tontineUid: uid });
    }
  }, []);

  const onCompletedPress = useCallback(() => {
    navigation.navigate('Tontines', { initialTab: 'mine' });
  }, [navigation]);

  const paddingTop =
    Platform.OS === 'android'
      ? (StatusBar.currentHeight ?? 0) + 12
      : 52;

  const tabDefs: { id: ReportTab; label: string }[] = [
    { id: 'bilan', label: 'Bilan' },
    { id: 'tontines', label: 'Tontines' },
    { id: 'score', label: 'Score' },
    { id: 'exports', label: 'Exports' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.headerBlock]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Rapport</Text>
          <View style={styles.headerBtns}>
            <Pressable
              onPress={showPeriodPicker}
              style={styles.iconBtn}
              accessibilityLabel="Choisir la période d’analyse"
              accessibilityRole="button"
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Rect x={3} y={4} width={18} height={18} rx={2} stroke="#FFFFFF" strokeWidth={2} />
                <Path d="M16 2v4M8 2v4M3 10h18" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </Pressable>
            <Pressable
              onPress={handleExportGlobalPdf}
              style={styles.iconBtn}
              accessibilityLabel="Exporter le rapport PDF global"
              accessibilityRole="button"
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"
                  stroke="#FFFFFF"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </Svg>
            </Pressable>
          </View>
        </View>

        <Text style={styles.periodHint}>{getPeriodLabelText(activePeriod)}</Text>

        <ReportSummaryGrid
          metrics={metrics}
          period={activePeriod}
          isLoading={isLoadingGlobal || paymentsLoading}
        />

        <ScoreGauge
          score={scoreQuery.data?.currentScore ?? 0}
          onPress={() => setActiveTab('score')}
        />

        <View style={styles.tabBar}>
          {tabDefs.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setActiveTab(t.id)}
              style={[styles.tabBtn, activeTab === t.id && styles.tabBtnOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === t.id }}
            >
              <Text style={[styles.tabTxt, activeTab === t.id && styles.tabTxtOn]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.spacer14} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void onRefresh()}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {isLoadingGlobal ? (
          <ReportSkeleton />
        ) : (
          <>
            {activeTab === 'bilan' && (
              <BilanTab metrics={metrics} period={activePeriod} isLoading={false} />
            )}
            {activeTab === 'tontines' && (
              <TontinesReportTab
                items={tontineReportItems}
                isLoading={false}
                onTontinePress={onTontinePress}
                onCompletedPress={onCompletedPress}
                onExportTontinePdf={(uid) =>
                  void openAuthenticatedReportUrl(ENDPOINTS.REPORTS.TONTINE_SUMMARY(uid).url)
                }
              />
            )}
            {activeTab === 'score' && (
              <ScoreTab
                score={currentScore}
                scoreLabel={scoreQuery.data?.scoreLabel ?? 'MOYEN'}
                history={scoreDisplays}
                stats={{
                  totalEvents: scoreQuery.data?.stats?.totalEvents ?? 0,
                  positiveEvents: scoreQuery.data?.stats?.positiveEvents ?? 0,
                  negativeEvents: scoreQuery.data?.stats?.negativeEvents ?? 0,
                  netDelta: scoreQuery.data?.stats?.netDelta ?? 0,
                }}
                isLoading={scoreQuery.isLoading}
              />
            )}
            {activeTab === 'exports' && userUid !== '' && (
              <ExportsTab
                userUid={userUid}
                tontines={tontineReportItems}
                metrics={metrics}
                punctualityRate={metrics.punctualityRate}
                currentScore={currentScore}
                onExportGlobalPdf={handleExportGlobalPdf}
              />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  headerBlock: {
    paddingHorizontal: 20,
    backgroundColor: '#1A6B3C',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    color: COLORS.white,
  },
  headerBtns: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodHint: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
  },
  tabBar: {
    flexDirection: 'row',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 10,
    padding: 3,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 0,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnOn: {
    backgroundColor: COLORS.white,
  },
  tabTxt: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  tabTxtOn: {
    color: COLORS.primary,
  },
  spacer14: { height: 14 },
  scroll: {
    flex: 1,
    backgroundColor: COLORS.gray100,
  },
  scrollContent: {
    paddingBottom: 80,
  },
});
