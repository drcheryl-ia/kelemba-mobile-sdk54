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
    joursRestants,
    urgencyLevel,
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
          t.status === 'ACTIVE' &&
          (t.membershipStatus === 'ACTIVE' || t.membershipStatus == null)
      ),
    [displayedTontines]
  );

  const totalBalance = officialTontines.reduce(
    (acc: number, t: TontineListItem) => acc + t.amountPerShare,
    0
  );

  const activeTontinesCount = officialTontines.length;

  const showNextPaymentBanner =
    nextPayment !== null &&
    !isProcessing &&
    urgencyLevel !== null &&
    urgencyLevel !== 'NORMAL';
  const daysLeftForBanner =
    urgencyLevel === 'EN_RETARD' ? 0 : (joursRestants ?? 0);

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

        {showNextPaymentBanner && nextPayment && (
          <AlertBanner
            daysLeft={daysLeftForBanner}
            tontineName={nextPayment.tontineName}
            amount={nextPayment.totalDue}
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
