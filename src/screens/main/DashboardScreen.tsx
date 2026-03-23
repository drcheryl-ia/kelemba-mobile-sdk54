/**
 * Accueil — dashboard membre / organisateur, données API réelles.
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, ScrollView, RefreshControl, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { navigationRef } from '@/navigation/navigationRef';
import type { TontineListItem } from '@/types/tontine';
import {
  HomeHeader,
  HomeHeroCard,
  HomeKpiRow,
  HomeQuickActions,
  HomeNotificationsPreview,
} from '@/components/dashboard/home';
import type { HomeQuickActionDef } from '@/components/dashboard/home';
import { PaymentReminderBanner } from '@/components/dashboard/PaymentReminderBanner';
import { TontinesList } from '@/components/dashboard/TontinesList';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { formatFcfa } from '@/utils/formatters';
import { withNextPaymentPenaltyWaivedForPendingCashValidation } from '@/utils/nextPaymentPenaltyWaive';

type Props = BottomTabScreenProps<MainTabParamList, 'Dashboard'>;

export const DashboardScreen: React.FC<Props> = ({ navigation }) => {
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    clearError();
    try {
      await Promise.all([
        refetchAll(),
        refetchNextPayment(),
        refetchTontines(),
        refetchNotifs(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchAll, refetchNextPayment, refetchTontines, refetchNotifs, clearError]);

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

  const reminders = useMemo(
    () => buildDashboardReminderCards(nextPaymentForUi, cashHistoryItems),
    [cashHistoryItems, nextPaymentForUi]
  );

  const primaryReminder = reminders[0] ?? null;

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

  const onMemberHeroPrimary = useCallback(() => {
    if (primaryReminder?.kind === 'pendingValidation') {
      navigation.navigate('Payments');
      return;
    }
    if (primaryReminder?.kind === 'nextPayment' && primaryReminder.cycleUid) {
      if (navigationRef.isReady()) {
        navigationRef.navigate('PaymentScreen', {
          cycleUid: primaryReminder.cycleUid,
          tontineUid: primaryReminder.tontineUid,
          tontineName: primaryReminder.tontineName,
          baseAmount: nextPaymentForUi?.amountDue ?? primaryReminder.amount,
          penaltyAmount: nextPaymentForUi?.penaltyAmount ?? 0,
          cycleNumber: primaryReminder.cycleNumber ?? nextPaymentForUi?.cycleNumber ?? 1,
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
  }, [primaryReminder, nextPaymentForUi, navigation]);

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
        onNotificationsPress={() => navigation.navigate('History')}
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

        {hasOrganizerRole ? (
          <HomeHeroCard
            variant="organizer"
            cashPendingCount={cashPendingBadge}
            overdueMembersHint={overdueOrganizerTontines}
            isLoading={organizerCashLoading}
            onPressTreat={onOrganizerTreat}
            onPressDashboard={onOrganizerDashboard}
          />
        ) : (
          <HomeHeroCard
            variant="member"
            primaryReminder={primaryReminder}
            nextPayment={nextPaymentForUi}
            isLoading={nextPaymentLoading || cashHistoryFetching}
            onPressPrimary={onMemberHeroPrimary}
            onPressUpToDate={() => navigation.navigate('Tontines')}
          />
        )}

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

        <View style={styles.quickActionsSection}>
          <HomeQuickActions
            actions={hasOrganizerRole ? organizerQuickActions : memberQuickActions}
          />
        </View>

        <View style={styles.reminderBannerSection}>
          <PaymentReminderBanner skipFirst={!hasOrganizerRole && primaryReminder != null} />
        </View>

        <View style={styles.tontinesSection}>
          <TontinesList
            tontines={officialTontines}
            isLoading={tontinesLoading}
            onTontinePress={(tontine) => {
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
            showDashboardMeta
          />
        </View>

        <View style={styles.sectionGap}>
          <HomeNotificationsPreview
            items={allNotifications}
            isLoading={notifLoading}
            isError={notifError}
            onSeeAll={() => navigation.navigate('History')}
            onOpen={() => navigation.navigate('History')}
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
  /** Rapproche la suite (rappels + tontines) du bloc Actions rapides. */
  quickActionsSection: {
    marginTop: 4,
    marginBottom: -12,
  },
  /** Rappels — marge haute minimale (le gap du ScrollView suffit en partie). */
  reminderBannerSection: {
    marginTop: 4,
  },
  /** Réduit l’intervalle avant « Mes tontines actives » (sous rappels ou espace vide). */
  tontinesSection: {
    marginTop: -8,
  },
});
