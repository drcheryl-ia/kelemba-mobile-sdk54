/**
 * Accueil — dashboard (refonte design system).
 * Les requêtes (profil, tontines, prochain paiement, épargne, notifications)
 * sont lancées en parallèle via des hooks React Query indépendants au mount.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import type { MainTabParamList } from '@/navigation/types';
import { navigationRef } from '@/navigation/navigationRef';
import { useDashboard } from '@/hooks/useDashboard';
import { useTontines } from '@/hooks/useTontines';
import { useHomeHeroState } from '@/hooks/dashboard/useHomeHeroState';
import { useNotifications } from '@/hooks/useNotifications';
import { useSavingsList } from '@/hooks/savings/useSavingsList';
import { savingsKeys } from '@/hooks/savings/keys';
import { selectUserUid } from '@/store/authSlice';
import type { RootState } from '@/store/store';
import { mergeDisplayableTontines } from '@/utils/tontineMerge';
import { activityItemsFromNotifications } from '@/utils/dashboardActivityFromNotifications';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { HomeHeroCard } from '@/components/dashboard/HomeHeroCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { KelembaSectionHeader } from '@/components/common/KelembaSectionHeader';
import { TontinesDashboardSection } from '@/components/dashboard/TontinesDashboardSection';
import { SavingsDashboardSection } from '@/components/dashboard/SavingsDashboardSection';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { useApiError } from '@/hooks/useApiError';
import { COLORS } from '@/theme/colors';

type Props = BottomTabScreenProps<MainTabParamList, 'Dashboard'>;

export const DashboardScreen: React.FC<Props> = ({ navigation, route }) => {
  const queryClient = useQueryClient();
  const userUid = useSelector((s: RootState) => selectUserUid(s));
  const [refreshing, setRefreshing] = useState(false);

  const { profile, scoreData, refetchAll, unreadCount } = useDashboard();
  const {
    pages: heroPages,
    isLoading: heroLoading,
    refetch: refetchHero,
    markPaymentPending,
    clearAllPaymentPending,
  } = useHomeHeroState();
  const {
    tontines: myTontines,
    invitations,
    isLoading: tontinesLoading,
    refetch: refetchTontines,
  } = useTontines({ includeInvitations: true });
  const { allNotifications, refetch: refetchNotifs } = useNotifications();
  const { data: savingsListData, refetch: refetchSavingsList } = useSavingsList();

  const { errorMessage, errorSeverity, handleError, clearError } = useApiError();

  useEffect(() => {
    const err = profile.error ?? scoreData.error ?? unreadCount.error;
    if (err) {
      handleError(err);
    } else {
      clearError();
    }
  }, [profile.error, scoreData.error, unreadCount.error, handleError, clearError]);

  useFocusEffect(
    useCallback(() => {
      const ps = route.params?.paymentSuccess;
      if (ps != null) {
        markPaymentPending(ps.tontineUid, ps.cycleUid, {
          cycleLabel: ps.cycleLabel,
          amount: ps.amount,
        });
        navigation.setParams({ paymentSuccess: undefined });
      }
    }, [route.params?.paymentSuccess, markPaymentPending, navigation])
  );

  const displayedTontines = useMemo(
    () => mergeDisplayableTontines(myTontines ?? [], invitations),
    [myTontines, invitations]
  );

  const savingsList = useMemo(
    () => (Array.isArray(savingsListData) ? savingsListData : []),
    [savingsListData]
  );

  const activityItems = useMemo(
    () => activityItemsFromNotifications(allNotifications),
    [allNotifications]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    clearError();
    clearAllPaymentPending();
    try {
      await Promise.all([
        refetchAll(),
        refetchHero(),
        refetchTontines(),
        refetchNotifs(),
        refetchSavingsList(),
      ]);
      if (userUid != null) {
        await queryClient.invalidateQueries({ queryKey: ['tontines', userUid] });
        await queryClient.invalidateQueries({ queryKey: ['nextPayment', userUid] });
      } else {
        await queryClient.invalidateQueries({ queryKey: ['tontines'] });
        await queryClient.invalidateQueries({ queryKey: ['nextPayment'] });
      }
      await queryClient.invalidateQueries({ queryKey: savingsKeys.list() });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } finally {
      setRefreshing(false);
    }
  }, [
    clearAllPaymentPending,
    clearError,
    queryClient,
    refetchAll,
    refetchHero,
    refetchNotifs,
    refetchSavingsList,
    refetchTontines,
    userUid,
  ]);

  const onScorePress = useCallback(() => {
    navigation.navigate('Profile', { screen: 'ScoreHistory' });
  }, [navigation]);

  const unread = unreadCount.data?.count ?? 0;

  return (
    <SafeAreaView style={styles.safeTop} edges={['top']}>
      <DashboardHeader
        user={profile.data}
        unreadCount={unread}
        onNotifPress={() => {
          if (navigationRef.isReady()) {
            navigationRef.navigate('NotificationsScreen');
          }
        }}
        onScorePress={onScorePress}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        <HomeHeroCard
          pages={heroPages}
          isLoading={heroLoading}
          onPaymentInitiated={markPaymentPending}
        />

        {errorMessage ? (
          <View style={styles.padH}>
            <ErrorBanner
              message={errorMessage}
              severity={errorSeverity ?? 'error'}
              onDismiss={clearError}
            />
          </View>
        ) : null}

        <View style={styles.padH}>
          <QuickActions />
        </View>

        <View style={styles.section}>
          <KelembaSectionHeader
            title="Mes tontines"
            linkLabel="Voir tout"
            onLinkPress={() => navigation.navigate('Tontines')}
          />
          <TontinesDashboardSection
            tontines={displayedTontines}
            isLoading={tontinesLoading}
            onCardPress={(uid, isCreator) => {
              if (navigationRef.isReady()) {
                navigationRef.navigate('TontineDetails', { tontineUid: uid, isCreator });
              }
            }}
            onCreateTontinePress={() => {
              if (navigationRef.isReady()) {
                navigationRef.navigate('CreateTontine');
              }
            }}
          />
        </View>

        {savingsList.length > 0 ? (
          <View style={styles.section}>
            <KelembaSectionHeader
              title="Mon épargne"
              linkLabel="Voir tout"
              onLinkPress={() => {
                if (navigationRef.isReady()) {
                  navigationRef.navigate('SavingsListScreen');
                }
              }}
            />
            <SavingsDashboardSection
              savingsTontines={savingsList}
              onItemPress={(item) => {
                if (navigationRef.isReady()) {
                  navigationRef.navigate('SavingsDetailScreen', {
                    tontineUid: item.uid,
                    isCreator: item.isCreator,
                  });
                }
              }}
            />
          </View>
        ) : null}

        <View style={styles.section}>
          <KelembaSectionHeader
            title="Activité récente"
            linkLabel="Voir tout"
            onLinkPress={() => {
              if (navigationRef.isReady()) {
                navigationRef.navigate('NotificationsScreen');
              }
            }}
          />
          <RecentActivity
            items={activityItems}
            onSeeAll={() => {
              if (navigationRef.isReady()) {
                navigationRef.navigate('NotificationsScreen');
              }
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeTop: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  scroll: {
    flex: 1,
    backgroundColor: COLORS.gray100,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  padH: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
});
