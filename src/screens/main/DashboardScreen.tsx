import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '@/navigation/types';
import { useSelector } from 'react-redux';
import { selectAccountType } from '@/store/authSlice';
import { useDashboard } from '@/hooks/useDashboard';
import { useTontines } from '@/hooks/useTontines';
import { isMembershipPending, mergeDisplayableTontines } from '@/utils/tontineMerge';
import type { TontineListItem } from '@/types/tontine';
import {
  pickMostUrgentTontineForDashboard,
  deriveTontinePaymentUiState,
  reminderHeadlineFr,
  resolveAmountsForListItem,
  type DashboardBannerReminderKind,
} from '@/utils/tontinePaymentState';
import { useNextPayment } from '@/hooks/useNextPayment';
import { useApiError } from '@/hooks/useApiError';
import {
  ProfileHeader,
  ScoreCard,
  AlertBanner,
  BalanceCard,
  QuickActions,
  TontinesList,
} from '@/components/dashboard';
import { GradientBorderCard } from '@/components/common/GradientBorderCard';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

type Props = BottomTabScreenProps<MainTabParamList, 'Dashboard'>;

export const DashboardScreen: React.FC<Props> = ({ navigation }) => {
  const accountType = useSelector(selectAccountType);
  const {
    profile,
    scoreData,
    tontines,
    payments,
    unreadCount,
    refetchAll,
  } = useDashboard();

  const {
    nextPayment,
    isProcessing,
    error: nextPaymentError,
    refetch: refetchNextPayment,
  } = useNextPayment();

  const {
    tontines: myTontines,
    invitations,
    isLoading: tontinesLoading,
    refetch: refetchTontines,
  } = useTontines();

  const { errorMessage, errorSeverity, handleError, clearError } = useApiError();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const err =
      profile.error ??
      scoreData.error ??
      tontines.error ??
      payments.error ??
      unreadCount.error ??
      nextPaymentError;
    if (err) {
      handleError(err);
    } else {
      clearError();
    }
  }, [
    profile.error,
    scoreData.error,
    tontines.error,
    payments.error,
    unreadCount.error,
    nextPaymentError,
    handleError,
    clearError,
  ]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    clearError();
    try {
      await Promise.all([refetchAll(), refetchNextPayment(), refetchTontines()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchAll, refetchNextPayment, refetchTontines, clearError]);

  const displayedTontines = useMemo(
    () => mergeDisplayableTontines(myTontines ?? [], invitations),
    [myTontines, invitations]
  );

  const officialTontines = useMemo(
    () =>
      displayedTontines.filter(
        (t: TontineListItem) =>
          (t.status === 'ACTIVE' || t.status === 'BETWEEN_ROUNDS') &&
          (t.membershipStatus === 'ACTIVE' || t.membershipStatus == null)
      ),
    [displayedTontines]
  );

  const totalBalance = officialTontines.reduce(
    (acc: number, t: TontineListItem) => acc + t.amountPerShare,
    0
  );

  const activeTontinesCount = officialTontines.length;

  const dashboardBanner = useMemo(() => {
    if (nextPayment != null && !isProcessing) {
      return { mode: 'api' as const, nextPayment };
    }
    const t = pickMostUrgentTontineForDashboard(officialTontines);
    if (!t) return null;
    const st = deriveTontinePaymentUiState(t);
    if (
      st.uiStatus !== 'OVERDUE' &&
      st.uiStatus !== 'DUE_TODAY' &&
      st.uiStatus !== 'DUE_SOON'
    ) {
      return null;
    }
    let kind: DashboardBannerReminderKind = 'SOON';
    if (st.uiStatus === 'OVERDUE') kind = 'OVERDUE';
    else if (st.uiStatus === 'DUE_TODAY') kind = 'TODAY';
    return { mode: 'fallback' as const, tontine: t, state: st, kind };
  }, [nextPayment, isProcessing, officialTontines]);

  const showNextPaymentBanner = dashboardBanner !== null;

  const bannerDaysLeft = useMemo(() => {
    if (dashboardBanner?.mode === 'api' && dashboardBanner.nextPayment?.dueDate) {
      const due = new Date(
        dashboardBanner.nextPayment.dueDate.split('T')[0] + 'T00:00:00.000Z'
      );
      const now = new Date();
      const todayUTC = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      );
      return Math.round((due.getTime() - todayUTC.getTime()) / 86_400_000);
    }
    if (dashboardBanner?.mode === 'fallback') {
      return dashboardBanner.state.daysLeft ?? 0;
    }
    return 0;
  }, [dashboardBanner]);

  const bannerReminderKind = (dl: number): DashboardBannerReminderKind => {
    if (dl < 0) return 'OVERDUE';
    if (dl === 0) return 'TODAY';
    return 'SOON';
  };

  const bannerTitle =
    dashboardBanner?.mode === 'api'
      ? `${reminderHeadlineFr(bannerReminderKind(bannerDaysLeft))} — ${dashboardBanner.nextPayment.tontineName}`
      : dashboardBanner?.mode === 'fallback'
        ? `${reminderHeadlineFr(dashboardBanner.kind)} — ${dashboardBanner.tontine.name}`
        : '';

  const bannerAmountLineOverride =
    dashboardBanner?.mode === 'fallback'
      ? (() => {
          const a = resolveAmountsForListItem(dashboardBanner.tontine);
          if (a.amount > 0 || a.totalDue > 0) return undefined;
          return `Échéance : ${dashboardBanner.state.displayDate ?? 'Date indisponible'}`;
        })()
      : undefined;

  const userScore = scoreData.data?.currentScore ?? 500; // défaut 500 = valeur BDD par défaut
  const unreadNotifications = unreadCount.data?.count ?? 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ProfileHeader
        fullName={profile.data?.fullName ?? ''}
        isOnline={true}
        unreadCount={unreadNotifications}
        isLoading={profile.isLoading}
        onNotificationsPress={() => navigation.navigate('History')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1A6B3C"
          />
        }
      >
        {errorMessage && (
          <View style={styles.errorBannerWrapper}>
            <ErrorBanner
              message={errorMessage}
              severity={errorSeverity ?? 'error'}
              onDismiss={clearError}
            />
          </View>
        )}

        <View style={styles.divider} />

        <GradientBorderCard style={styles.cardWrapper} innerStyle={styles.cardInner}>
          <ScoreCard
            score={userScore}
            scoreLabel={scoreData.data?.scoreLabel ?? 'MOYEN'}
            isLoading={scoreData.isLoading}
            compact
          />
        </GradientBorderCard>

        {showNextPaymentBanner && dashboardBanner && (
          <AlertBanner
            daysLeft={bannerDaysLeft}
            tontineName={
              dashboardBanner.mode === 'api'
                ? dashboardBanner.nextPayment.tontineName
                : dashboardBanner.tontine.name
            }
            amount={
              dashboardBanner.mode === 'api'
                ? dashboardBanner.nextPayment.amountDue
                : resolveAmountsForListItem(dashboardBanner.tontine).amount
            }
            penaltyAmount={
              dashboardBanner.mode === 'api'
                ? dashboardBanner.nextPayment.penaltyAmount ?? 0
                : resolveAmountsForListItem(dashboardBanner.tontine).penaltyAmount
            }
            totalDue={
              dashboardBanner.mode === 'api'
                ? dashboardBanner.nextPayment.totalDue
                : resolveAmountsForListItem(dashboardBanner.tontine).totalDue
            }
            titleOverride={bannerTitle}
            amountLineOverride={bannerAmountLineOverride}
            onCotiserPress={() => navigation.navigate('Payments')}
            isVisible={true}
          />
        )}

        <GradientBorderCard style={styles.cardWrapper} innerStyle={styles.cardInner}>
          <BalanceCard
            totalBalance={totalBalance}
            activeTontinesCount={activeTontinesCount}
            isLoading={tontinesLoading}
            compact
          />
        </GradientBorderCard>

        <Text style={styles.sectionTitle}>ACTIONS RAPIDES</Text>
        <QuickActions
          onCotiser={() => navigation.navigate('Payments')}
          onNouvelleTontine={() => {
            (navigation as { navigate: (s: string, p?: object) => void }).navigate(
              'TontineTypeSelectionScreen'
            );
          }}
          showNouvelleTontine={accountType === 'ORGANISATEUR'}
          showRejoindreTontine={accountType === 'MEMBRE'}
          onRejoindreTontine={() => {
            (navigation as { navigate: (s: string, p?: object) => void }).navigate(
              'Tontines',
              { openJoinModal: true }
            );
          }}
          onHistorique={() => {
            (navigation as { navigate: (s: string, p?: object) => void }).navigate(
              'History'
            );
          }}
          onAide={() => {
            (navigation as { navigate: (s: string, p?: object) => void }).navigate(
              'Help'
            );
          }}
        />

        <TontinesList
          tontines={officialTontines}
          isLoading={tontinesLoading}
          onTontinePress={(tontine) => {
            if (isMembershipPending(tontine)) return;
            const nav = navigation as { navigate: (name: string, params?: object) => void };
            if (tontine.type === 'EPARGNE') {
              nav.navigate('SavingsDetailScreen', { tontineUid: tontine.uid });
            } else {
              nav.navigate('TontineDetails', { tontineUid: tontine.uid });
            }
          }}
          onSeeAllPress={() => navigation.navigate('Tontines')}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100, // 64 tab height + 20 margin + 16 safe area
    gap: 16,
  },
  errorBannerWrapper: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  cardWrapper: {
    marginHorizontal: 20,
  },
  cardInner: {
    padding: 0,
  },
});
