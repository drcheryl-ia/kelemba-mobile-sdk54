/**
 * Accueil — dashboard membre / organisateur, données API réelles.
 */
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, ScrollView, RefreshControl, StyleSheet, Text, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '@/navigation/types';
import { useDashboard } from '@/hooks/useDashboard';
import { useTontines } from '@/hooks/useTontines';
import { useNextPayment } from '@/hooks/useNextPayment';
import { useContributionHistory } from '@/hooks/useContributionHistory';
import { useNotifications } from '@/hooks/useNotifications';
import { useApiError } from '@/hooks/useApiError';
import { useHasOrganizerRoleInTontines } from '@/hooks/useHasOrganizerRoleInTontines';
import {
  useOrganizerCashPendingBadgeCount,
  useOrganizerCashPendingActions,
} from '@/hooks/useOrganizerCashPending';
import { isMembershipPending, mergeDisplayableTontines } from '@/utils/tontineMerge';
import { deriveTontinePaymentUiState } from '@/utils/tontinePaymentState';
import { buildDashboardReminderCards } from '@/components/dashboard/paymentReminderBanner.helpers';
import { parseApiError, getErrorMessageForCode } from '@/api/errors';
import { navigationRef } from '@/navigation/navigationRef';
import type { TontineListItem } from '@/types/tontine';
import type { TontineRotationResponse } from '@/types/rotation';
import {
  HomeHeader,
  HomeHeroCard,
  HomeKpiRow,
  HomeQuickActions,
  HomeNotificationsPreview,
} from '@/components/dashboard/home';
import type { HomeQuickActionDef } from '@/components/dashboard/home';
import { useTranslation } from 'react-i18next';
import { resolveOrganizerPayoutNavigationData } from '@/utils/organizerPayoutNavigation';
import { logger } from '@/utils/logger';
import {
  HomePayoutScheduleSection,
  HOME_PAYOUT_SCHEDULE_PREVIEW_LIMIT,
} from '@/components/dashboard/HomePayoutScheduleSection';
import { getTontineRotation } from '@/api/tontinesApi';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { formatFcfa } from '@/utils/formatters';
import { withNextPaymentPenaltyWaivedForPendingCashValidation } from '@/utils/nextPaymentPenaltyWaive';
import { resolveDashboardOrganizerPayoutReminder } from '@/utils/cyclePayoutEligibility';
import { aggregateSavingsHomeSummary } from '@/utils/homeSavingsRowViewModel';
import { HomeSavingsSummaryCard } from '@/components/dashboard/HomeSavingsSummaryCard';

type Props = BottomTabScreenProps<MainTabParamList, 'Dashboard'>;

export const DashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const payoutRequestLockRef = useRef(false);
  const queryClient = useQueryClient();
  const hasOrganizerRole = useHasOrganizerRoleInTontines();
  const cashPendingBadge = useOrganizerCashPendingBadgeCount();
  const { isLoading: organizerCashLoading } = useOrganizerCashPendingActions({
    active: hasOrganizerRole,
  });

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
    isLoading: nextPaymentLoading,
    error: nextPaymentError,
    refetch: refetchNextPayment,
  } = useNextPayment();

  const { items: cashHistoryItems, isFetching: cashHistoryFetching } =
    useContributionHistory(undefined, {
      methodFilter: 'CASH',
      sortField: 'date',
      sortOrder: 'desc',
    });

  const nextPaymentForUi = useMemo(
    () =>
      withNextPaymentPenaltyWaivedForPendingCashValidation(
        nextPayment,
        cashHistoryItems
      ),
    [nextPayment, cashHistoryItems]
  );

  const {
    tontines: myTontines,
    invitations,
    isLoading: tontinesLoading,
    refetch: refetchTontines,
  } = useTontines({ includeInvitations: false });

  const {
    allNotifications,
    isLoading: notifLoading,
    isError: notifError,
    refetch: refetchNotifs,
  } = useNotifications();

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

  const homePayoutRotationUids = useMemo(() => {
    const preview = officialTontines.slice(0, HOME_PAYOUT_SCHEDULE_PREVIEW_LIMIT);
    return Array.from(
      new Set(preview.filter((t) => t.type !== 'EPARGNE').map((t) => t.uid))
    );
  }, [officialTontines]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    clearError();
    try {
      await Promise.all([
        refetchAll(),
        refetchNextPayment(),
        refetchTontines(),
        refetchNotifs(),
        ...homePayoutRotationUids.map((uid) =>
          queryClient.invalidateQueries({ queryKey: ['tontineRotation', uid] })
        ),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [
    refetchAll,
    refetchNextPayment,
    refetchTontines,
    refetchNotifs,
    clearError,
    queryClient,
    homePayoutRotationUids,
  ]);

  const homePayoutRotationQueries = useQueries({
    queries: homePayoutRotationUids.map((uid) => ({
      queryKey: ['tontineRotation', uid] as const,
      queryFn: () => getTontineRotation(uid),
      enabled: homePayoutRotationUids.length > 0 && Boolean(uid),
      staleTime: 5 * 60_000,
      gcTime: 24 * 60 * 60 * 1000,
      networkMode: 'offlineFirst' as const,
      refetchOnWindowFocus: false,
      retry: 2,
    })),
  });

  const payoutRotationByUid = useMemo(() => {
    const m: Record<
      string,
      { data?: TontineRotationResponse; isLoading: boolean; isError: boolean }
    > = {};
    homePayoutRotationUids.forEach((uid, i) => {
      const q = homePayoutRotationQueries[i];
      if (!q) return;
      m[uid] = {
        data: q.data,
        isLoading: q.isPending,
        isError: q.isError,
      };
    });
    return m;
  }, [homePayoutRotationUids, homePayoutRotationQueries]);

  const totalBalance = officialTontines.reduce(
    (acc: number, t: TontineListItem) => acc + t.amountPerShare,
    0
  );

  const managedTontinesCount = useMemo(() => {
    let n = 0;
    for (const t of officialTontines) {
      if (t.isCreator === true || t.membershipRole === 'CREATOR') n += 1;
    }
    return n;
  }, [officialTontines]);

  const overdueOrganizerTontines = useMemo(() => {
    let n = 0;
    for (const t of officialTontines) {
      if (!(t.isCreator === true || t.membershipRole === 'CREATOR')) continue;
      const ui = deriveTontinePaymentUiState(t);
      if (ui.uiStatus === 'OVERDUE') n += 1;
    }
    return n;
  }, [officialTontines]);

  /** Versement cagnotte (organisateur) — même source que les cartes liste, sans requête supplémentaire. */
  const organizerPayoutTontines = useMemo(() => {
    if (!hasOrganizerRole) return [];
    return officialTontines.filter(
      (t) => resolveDashboardOrganizerPayoutReminder(t) != null
    );
  }, [hasOrganizerRole, officialTontines]);

  const reminders = useMemo(
    () =>
      buildDashboardReminderCards(nextPaymentForUi, cashHistoryItems, {
        organizerPayoutTontines,
        savingsTontines: officialTontines,
        limit: 10,
      }),
    [cashHistoryItems, nextPaymentForUi, organizerPayoutTontines, officialTontines]
  );

  const savingsHomeAggregate = useMemo(
    () => aggregateSavingsHomeSummary(officialTontines),
    [officialTontines]
  );

  const heroLoading = useMemo(() => {
    const dataLoading = nextPaymentLoading || cashHistoryFetching;
    if (hasOrganizerRole && reminders.length === 0) {
      return dataLoading || organizerCashLoading;
    }
    return dataLoading;
  }, [
    hasOrganizerRole,
    reminders.length,
    nextPaymentLoading,
    cashHistoryFetching,
    organizerCashLoading,
  ]);

  const pendingPaymentsCount = payments.data?.data?.length ?? 0;
  const pendingActionsCount = cashPendingBadge + pendingPaymentsCount;

  const unreadNotifications = unreadCount.data?.count ?? 0;

  const scoreValue = scoreData.data?.currentScore ?? null;
  const scoreLabel = scoreData.data?.scoreLabel ?? null;

  const memberNextDueLabel = useMemo(() => {
    if (nextPaymentForUi == null) return null;
    if (joursRestants == null) return null;
    if (joursRestants < 0) return `En retard · ${formatFcfa(nextPaymentForUi.totalDue)}`;
    if (joursRestants === 0) return `Aujourd'hui · ${formatFcfa(nextPaymentForUi.totalDue)}`;
    return `Dans ${joursRestants} j · ${formatFcfa(nextPaymentForUi.totalDue)}`;
  }, [nextPaymentForUi, joursRestants]);

  const navigateToTontinePayout = useCallback((item: TontineListItem) => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('TontineDetails', {
        tontineUid: item.uid,
        isCreator: item.isCreator ?? item.membershipRole === 'CREATOR',
      });
    }
  }, []);

  const handleOrganizerPayoutPress = useCallback(
    async (item: TontineListItem) => {
      if (payoutRequestLockRef.current) return;
      if (item.currentCycleUid == null || item.currentCycle == null) {
        navigateToTontinePayout(item);
        return;
      }
      payoutRequestLockRef.current = true;
      try {
        const result = await resolveOrganizerPayoutNavigationData(item.currentCycleUid, {
          kind: 'list',
          item,
        });
        if (!result.ok) {
          navigateToTontinePayout(item);
          if (result.reason === 'not_payable') {
            Alert.alert(
              t('tontineList.payoutUnavailableTitle', 'Versement indisponible'),
              t(
                'tontineList.payoutUnavailableMessage',
                "Le versement n'est pas possible pour l'instant. Consultez le détail de la tontine pour l'état du cycle."
              )
            );
          }
          return;
        }
        if (navigationRef.isReady()) {
          navigationRef.navigate('CyclePayoutScreen', result.payload);
        }
      } catch (error: unknown) {
        const apiError = parseApiError(error);
        Alert.alert(
          t('common.error', 'Erreur'),
          getErrorMessageForCode(apiError, i18n.language === 'sango' ? 'sango' : 'fr')
        );
      } finally {
        payoutRequestLockRef.current = false;
      }
    },
    [i18n.language, navigateToTontinePayout, t]
  );

  const handleDashboardHeroPrimary = useCallback(() => {
    const primary = reminders[0] ?? null;
    if (primary?.kind === 'pendingValidation') {
      logger.info('[DashboardHero] Pending validation pressed', {
        tontineUid: primary.tontineUid,
      });
      navigation.navigate('Payments');
      return;
    }
    if (primary?.kind === 'payoutPot') {
      const src = primary.organizerPayoutSource;
      if (!src) return;
      if (primary.payoutPhase === 'in_progress') {
        logger.info('[DashboardHero] Payout in progress — tontine', {
          tontineUid: primary.tontineUid,
        });
        navigateToTontinePayout(src);
        return;
      }
      logger.info('[DashboardHero] Payer la cagnotte pressed', {
        tontineUid: primary.tontineUid,
      });
      void handleOrganizerPayoutPress(src);
      return;
    }
    if (primary?.kind === 'savingsPeriod' && navigationRef.isReady()) {
      logger.info('[DashboardHero] Savings reminder pressed', {
        tontineUid: primary.tontineUid,
        periodUid: primary.periodUid,
      });
      if (primary.periodUid) {
        navigationRef.navigate('SavingsContributeScreen', {
          tontineUid: primary.tontineUid,
          periodUid: primary.periodUid,
        });
      } else {
        navigationRef.navigate('SavingsDetailScreen', { tontineUid: primary.tontineUid });
      }
      return;
    }
    if (primary?.kind === 'nextPayment' && primary.cycleUid) {
      logger.info('[DashboardHero] Cotiser pressed', { tontineUid: primary.tontineUid });
      if (navigationRef.isReady()) {
        navigationRef.navigate('PaymentScreen', {
          cycleUid: primary.cycleUid,
          tontineUid: primary.tontineUid,
          tontineName: primary.tontineName,
          baseAmount: nextPaymentForUi?.amountDue ?? primary.amount,
          penaltyAmount: nextPaymentForUi?.penaltyAmount ?? 0,
          cycleNumber: primary.cycleNumber ?? nextPaymentForUi?.cycleNumber ?? 1,
        });
      }
      return;
    }
    if (nextPaymentForUi?.cycleUid && navigationRef.isReady()) {
      navigationRef.navigate('PaymentScreen', {
        cycleUid: nextPaymentForUi.cycleUid,
        tontineUid: nextPaymentForUi.tontineUid,
        tontineName: nextPaymentForUi.tontineName,
        baseAmount: nextPaymentForUi.amountDue,
        penaltyAmount: nextPaymentForUi.penaltyAmount,
        cycleNumber: nextPaymentForUi.cycleNumber,
      });
    }
  }, [
    reminders,
    nextPaymentForUi,
    navigation,
    navigateToTontinePayout,
    handleOrganizerPayoutPress,
  ]);

  const onOrganizerTreat = useCallback(() => {
    navigation.navigate('Payments', { initialSegment: 'cashValidations' });
  }, [navigation]);

  const onOrganizerDashboard = useCallback(() => {
    navigation.navigate('Tontines');
  }, [navigation]);

  const onScoreDetail = useCallback(() => {
    navigation.navigate('Profile', { screen: 'ScoreHistory' });
  }, [navigation]);

  const memberQuickActions: HomeQuickActionDef[] = useMemo(
    () => [
      {
        id: 'tour',
        label: 'Mon tour',
        icon: 'sync-outline',
        onPress: () => navigation.navigate('Tontines'),
      },
      {
        id: 'invitations',
        label: 'Mes invitations',
        icon: 'mail-outline',
        onPress: () => navigation.navigate('Tontines', { initialTab: 'invitations' }),
      },
      {
        id: 'rejoindre',
        label: 'Rejoindre tontine',
        icon: 'enter-outline',
        onPress: () =>
          navigation.navigate('Tontines', { openJoinModal: true }),
      },
      {
        id: 'aide',
        label: 'Aide',
        icon: 'help-circle-outline',
        onPress: () => navigation.navigate('Profile', { screen: 'Profile' }),
      },
    ],
    [navigation]
  );

  const organizerQuickActions: HomeQuickActionDef[] = useMemo(
    () => [
      {
        id: 'createTontine',
        label: 'Créer une tontine',
        icon: 'add-circle-outline',
        onPress: () => {
          if (navigationRef.isReady()) navigationRef.navigate('TontineTypeSelectionScreen');
        },
      },
      {
        id: 'cash',
        label: 'Valider espèces',
        icon: 'cash-outline',
        badgeCount: cashPendingBadge,
        onPress: () =>
          navigation.navigate('Payments', { initialSegment: 'cashValidations' }),
      },
      {
        id: 'invite',
        label: 'Inviter',
        icon: 'person-add-outline',
        onPress: () => navigation.navigate('Tontines'),
      },
      {
        id: 'aide',
        label: 'Aide',
        icon: 'help-circle-outline',
        onPress: () => navigation.navigate('Profile', { screen: 'Profile' }),
      },
    ],
    [navigation, cashPendingBadge]
  );

  const kycBannerVisible =
    profile.data?.kycStatus != null && profile.data.kycStatus !== 'VERIFIED';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <HomeHeader
        fullName={profile.data?.fullName ?? ''}
        isLoading={profile.isLoading}
        kycStatus={profile.data?.kycStatus}
        managedTontinesCount={managedTontinesCount}
        pendingActionsCount={pendingActionsCount}
        isOrganizerContext={hasOrganizerRole}
        unreadCount={unreadNotifications}
        onNotificationsPress={() => {
          if (navigationRef.isReady()) navigationRef.navigate('NotificationsScreen');
        }}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1A6B3C" />
        }
      >
        {errorMessage ? (
          <View style={styles.errorBannerWrapper}>
            <ErrorBanner
              message={errorMessage}
              severity={errorSeverity ?? 'error'}
              onDismiss={clearError}
            />
          </View>
        ) : null}

        {kycBannerVisible ? (
          <View style={styles.kycBanner}>
            <Text style={styles.kycText}>
              Finalisez votre vérification pour accéder à toutes les fonctionnalités.
            </Text>
          </View>
        ) : null}

        <HomeHeroCard
          reminders={reminders}
          nextPayment={nextPaymentForUi}
          isLoading={heroLoading}
          nextPaymentAmountDue={nextPaymentForUi?.amountDue ?? null}
          nextPaymentPenaltyAmount={nextPaymentForUi?.penaltyAmount ?? null}
          organizerFallback={
            hasOrganizerRole && reminders.length === 0
              ? {
                  cashPendingCount: cashPendingBadge,
                  overdueMembersHint: overdueOrganizerTontines,
                }
              : undefined
          }
          onPressPrimary={handleDashboardHeroPrimary}
          onPressUpToDate={onOrganizerDashboard}
          onOrganizerTreat={onOrganizerTreat}
        />

        <View style={styles.sectionGap}>
          <HomeKpiRow
            variant={hasOrganizerRole ? 'organizer' : 'member'}
            score={scoreValue}
            scoreLabel={scoreLabel}
            scoreLoading={scoreData.isLoading}
            scoreError={scoreData.error != null}
            onScoreDetail={onScoreDetail}
            memberTotalEngaged={totalBalance}
            memberNextDueLabel={memberNextDueLabel}
            organizerCashPending={cashPendingBadge}
            organizerCollectedHint="—"
            memberKpiLoading={tontinesLoading || nextPaymentLoading}
            organizerKpiLoading={tontinesLoading}
          />
        </View>

        <HomeSavingsSummaryCard aggregate={savingsHomeAggregate} />

        <View style={styles.quickActionsSection}>
          <HomeQuickActions
            actions={hasOrganizerRole ? organizerQuickActions : memberQuickActions}
          />
        </View>

        <View style={styles.tontinesSection}>
          <HomePayoutScheduleSection
            tontines={officialTontines}
            isLoading={tontinesLoading}
            payoutRotationByUid={payoutRotationByUid}
            onPressTontine={(tontine) => {
              if (isMembershipPending(tontine)) return;
              if (navigationRef.isReady()) {
                if (tontine.type === 'EPARGNE') {
                  navigationRef.navigate('SavingsDetailScreen', { tontineUid: tontine.uid });
                } else {
                  navigationRef.navigate('TontineDetails', { tontineUid: tontine.uid });
                }
              }
            }}
            onSeeAllPress={() => navigation.navigate('Tontines')}
          />
        </View>

        <View style={styles.sectionGap}>
          <HomeNotificationsPreview
            items={allNotifications}
            isLoading={notifLoading}
            isError={notifError}
            onSeeAll={() => {
              if (navigationRef.isReady()) navigationRef.navigate('NotificationsScreen');
            }}
            onOpen={() => {
              if (navigationRef.isReady()) navigationRef.navigate('NotificationsScreen');
            }}
          />
        </View>
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
    /** Évite que la première carte (héro / rappel) colle au HomeHeader. */
    paddingTop: 16,
    paddingBottom: 100,
    gap: 14,
  },
  errorBannerWrapper: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  kycBanner: {
    marginHorizontal: 20,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  kycText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  sectionGap: {
    marginTop: 4,
  },
  /** Espace sous le bloc Actions rapides avant le planning de passage. */
  quickActionsSection: {
    marginTop: 4,
    marginBottom: 2,
  },
  tontinesSection: {
    marginTop: 0,
  },
});
