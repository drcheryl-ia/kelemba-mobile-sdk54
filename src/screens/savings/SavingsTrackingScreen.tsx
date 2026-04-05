/**
 * Suivi consolidé épargne / rotatif — données API + agrégats centralisés.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSelector } from 'react-redux';
import type { MainTabParamList } from '@/navigation/types';
import { useTontines } from '@/hooks/useTontines';
import { savingsKeys } from '@/hooks/useSavings';
import { savingsApi } from '@/api/savings.api';
import { getTontineReport } from '@/api/tontinesApi';
import { shouldRetryApiQuery } from '@/api/errors/queryRetry';
import { navigationRef } from '@/navigation/navigationRef';
import { selectUserUid } from '@/store/authSlice';
import type { RootState } from '@/store/store';
import type { TontineListItem } from '@/types/tontine';
import type { MyBalanceResponse } from '@/types/savings.types';
import { SavingsScreenHeader } from '@/components/savings';
import { TontineCard } from '@/components/tontines/TontineCard';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { formatFcfa } from '@/utils/formatters';
import { deriveSavingsHomeRowVm } from '@/utils/homeSavingsRowViewModel';
import {
  buildSavingsTrackingGlobalTotals,
  countRotativeBeneficiaryTurns,
  filterByTrackingRole,
  splitEpargneRotative,
  type TrackingRoleFilter,
} from '@/utils/savingsTrackingViewModel';
import { resolveOrganizerPayoutNavigationData } from '@/utils/organizerPayoutNavigation';
import { parseApiError, getErrorMessageForCode } from '@/api/errors';

type Props = {
  navigation: BottomTabNavigationProp<MainTabParamList>;
};

const ROLE_FILTERS: TrackingRoleFilter[] = ['all', 'member', 'organizer'];

function formatUnlockShort(iso: string | null | undefined): string {
  if (iso == null || iso === '') return '—';
  const d = new Date(`${iso.split('T')[0]}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="button"
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

function savingsStatusLabel(
  item: TontineListItem,
  t: (k: string, f: string) => string
): string {
  const vm = deriveSavingsHomeRowVm(item);
  if (item.savingsMemberStatus === 'WITHDRAWN' || item.savingsMemberStatus === 'EXCLUDED') {
    return t('savingsTracking.statusEarlyExit', 'Sortie ou exclusion');
  }
  switch (vm.statusKey) {
    case 'suspended':
      return t('savingsTracking.statusSuspended', 'Suspendu');
    case 'unlocked':
      return t('savingsTracking.statusUnlocked', 'Débloquée');
    case 'late':
      return t('savingsTracking.statusLate', 'En retard');
    case 'up_to_date':
    default:
      return t('savingsTracking.statusUpToDate', 'À jour');
  }
}

export const SavingsTrackingScreen: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const userUid = useSelector(selectUserUid);
  const unreadCount = useSelector((s: RootState) => s.notifications.unreadCount);
  const [roleFilter, setRoleFilter] = useState<TrackingRoleFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const { tontines, isLoading: tontinesLoading, isError: tontinesError, refetch } = useTontines({
    includeInvitations: false,
  });

  const filtered = useMemo(
    () => filterByTrackingRole(tontines, roleFilter),
    [tontines, roleFilter]
  );

  const { epargne, rotative } = useMemo(() => splitEpargneRotative(filtered), [filtered]);

  const epargneUids = useMemo(() => epargne.map((x) => x.uid), [epargne]);
  const rotativeUids = useMemo(() => rotative.map((x) => x.uid), [rotative]);

  const balanceQueries = useQueries({
    queries: epargneUids.map((uid) => ({
      queryKey: savingsKeys.myBalance(uid),
      queryFn: () => savingsApi.myBalance(uid),
      enabled: uid.length > 0 && !tontinesLoading,
      staleTime: 60_000,
      retry: shouldRetryApiQuery,
    })),
  });

  const reportQueries = useQueries({
    queries: rotativeUids.map((uid) => ({
      queryKey: ['report', uid] as const,
      queryFn: () => getTontineReport(uid),
      enabled: uid.length > 0 && !tontinesLoading,
      staleTime: 5 * 60_000,
      retry: shouldRetryApiQuery,
    })),
  });

  const balanceByEpargneUid = useMemo(() => {
    const m: Record<string, MyBalanceResponse | undefined> = {};
    epargneUids.forEach((uid, i) => {
      const q = balanceQueries[i];
      if (q?.data != null) m[uid] = q.data;
    });
    return m;
  }, [balanceQueries, epargneUids]);

  const rotativePayoutCounts = useMemo(() => {
    const m: Record<string, number | undefined> = {};
    if (userUid == null) return m;
    rotativeUids.forEach((uid, i) => {
      const q = reportQueries[i];
      if (q?.data != null) {
        m[uid] = countRotativeBeneficiaryTurns(q.data, userUid) ?? undefined;
      }
    });
    return m;
  }, [reportQueries, rotativeUids, userUid]);

  const totals = useMemo(
    () =>
      buildSavingsTrackingGlobalTotals({
        filteredItems: filtered,
        balanceByEpargneUid,
        rotativePayoutCounts,
      }),
    [filtered, balanceByEpargneUid, rotativePayoutCounts]
  );

  const detailLoading =
    balanceQueries.some((q) => q.isLoading) || reportQueries.some((q) => q.isLoading);
  const detailError =
    balanceQueries.some((q) => q.isError) || reportQueries.some((q) => q.isError);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    await Promise.all([
      ...epargneUids.map((uid) =>
        queryClient.invalidateQueries({ queryKey: savingsKeys.myBalance(uid) })
      ),
      ...rotativeUids.map((uid) => queryClient.invalidateQueries({ queryKey: ['report', uid] })),
    ]);
    setRefreshing(false);
  }, [epargneUids, queryClient, refetch, rotativeUids]);

  const navigateToTontine = useCallback((item: TontineListItem) => {
    if (!navigationRef.isReady()) return;
    if (item.type === 'EPARGNE') {
      navigationRef.navigate('SavingsDetailScreen', { tontineUid: item.uid });
      return;
    }
    navigationRef.navigate('TontineDetails', {
      tontineUid: item.uid,
      isCreator: item.isCreator ?? item.membershipRole === 'CREATOR',
    });
  }, []);

  const handleOrganizerPayoutPress = useCallback(
    async (item: TontineListItem) => {
      if (item.currentCycleUid == null || item.currentCycle == null) {
        navigateToTontine(item);
        return;
      }
      try {
        const result = await resolveOrganizerPayoutNavigationData(item.currentCycleUid, {
          kind: 'list',
          item,
        });
        if (!result.ok) {
          navigateToTontine(item);
          return;
        }
        navigationRef.navigate('CyclePayoutScreen', result.payload);
      } catch (e: unknown) {
        const apiError = parseApiError(e);
        // eslint-disable-next-line no-alert -- aligné TontineListScreen
        alert(
          getErrorMessageForCode(apiError, i18n.language === 'sango' ? 'sango' : 'fr')
        );
      }
    },
    [i18n.language, navigateToTontine]
  );

  const roleLabel = useCallback(
    (f: TrackingRoleFilter) => {
      switch (f) {
        case 'all':
          return t('savingsTracking.filterAll', 'Toutes');
        case 'member':
          return t('savingsTracking.filterMember', 'Membre');
        case 'organizer':
          return t('savingsTracking.filterOrganizer', 'Organisateur');
        default:
          return '';
      }
    },
    [t]
  );

  const bottomPad = 88 + Math.max(insets.bottom, spacing.sm);

  if (tontinesLoading && !refreshing) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <SavingsScreenHeader
          showBackButton={false}
          title={t('savingsTracking.title', 'Mes tontines d’épargne')}
          titleNumberOfLines={1}
          titleStyle={styles.trackingHeaderTitle}
          headerContainerStyle={styles.trackingHeaderContainer}
        />
        <View style={styles.pad}>
          <SkeletonBlock width="100%" height={120} borderRadius={12} />
          <SkeletonBlock
            width="100%"
            height={80}
            borderRadius={12}
            style={{ marginTop: spacing.md }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (tontinesError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <SavingsScreenHeader
          showBackButton={false}
          title={t('savingsTracking.title', 'Mes tontines d’épargne')}
          titleNumberOfLines={1}
          titleStyle={styles.trackingHeaderTitle}
          headerContainerStyle={styles.trackingHeaderContainer}
        />
        <View style={styles.pad}>
          <ErrorBanner message={t('common.error', 'Erreur')} />
          <Pressable style={styles.secondaryBtn} onPress={() => void refetch()}>
            <Text style={styles.secondaryBtnText}>{t('common.retry', 'Réessayer')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SavingsScreenHeader
        showBackButton={false}
        title={t('savingsTracking.title', 'Mes tontines d’épargne')}
        titleNumberOfLines={1}
        titleStyle={styles.trackingHeaderTitle}
        headerContainerStyle={styles.trackingHeaderContainer}
        rightAction={
          <Pressable
            onPress={() => {
              if (navigationRef.isReady()) navigationRef.navigate('NotificationsScreen');
            }}
            style={styles.notifBtn}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('notifications.title', 'Notifications')}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.gray[800]} />
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            ) : null}
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
      >
        {detailError ? (
          <View style={{ marginBottom: spacing.md }}>
            <ErrorBanner
              severity="warning"
              message={t(
                'savingsTracking.partialLoadError',
                'Certaines données sont indisponibles.'
              )}
            />
            <Pressable style={styles.secondaryBtn} onPress={() => void onRefresh()}>
              <Text style={styles.secondaryBtnText}>{t('common.retry', 'Réessayer')}</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.blockTitle}>
          {t('savingsTracking.blockEpargne', 'Mes tontines d’épargne')} ({epargne.length})
        </Text>
        {epargne.length === 0 ? (
          <View style={styles.emptyEpargneBox}>
            <Text style={styles.empty}>{t('savingsTracking.emptyEpargne', 'Aucune tontine d’épargne.')}</Text>
            <Pressable
              style={styles.primaryCta}
              onPress={() => {
                if (navigationRef.isReady()) navigationRef.navigate('TontineTypeSelectionScreen');
              }}
              accessibilityRole="button"
              accessibilityLabel={t('savingsTracking.ctaCreateEpargneA11y', 'Créer une tontine épargne')}
            >
              <Text style={styles.primaryCtaText}>
                {t('savingsTracking.ctaCreateEpargne', 'Créer une tontine épargne')}
              </Text>
              <Ionicons name="add-circle-outline" size={22} color={colors.white} />
            </Pressable>
          </View>
        ) : (
          epargne.map((item) => {
            const bal = balanceByEpargneUid[item.uid];
            const status = savingsStatusLabel(item, t);
            const qIdx = epargneUids.indexOf(item.uid);
            const balQuery = qIdx >= 0 ? balanceQueries[qIdx] : undefined;
            const balLoading = balQuery?.isLoading === true && bal == null;
            return (
              <View key={item.uid} style={styles.cardWrap}>
                <TontineCard item={item} onPress={navigateToTontine} onOrganizerPayoutPress={handleOrganizerPayoutPress} />
                <View style={styles.metaBox}>
                  <Text style={styles.metaText}>
                    {t('savingsTracking.rowMin', 'Cotisation min.')} {formatFcfa(item.amountPerShare)}
                  </Text>
                  <Text style={styles.metaText}>
                    {t('savingsTracking.rowFrequency', 'Fréquence')} :{' '}
                    {t(`createTontine.freq${item.frequency}`, String(item.frequency))}
                  </Text>
                  <Text style={styles.metaText}>
                    {t('savingsTracking.rowUnlock', 'Déblocage')} : {formatUnlockShort(item.savingsUnlockDate)}
                  </Text>
                  <Text style={styles.metaText}>
                    {t('savingsTracking.rowStatus', 'Statut')} : {status}
                  </Text>
                  {item.collectionProgress != null && item.collectionProgress >= 0 ? (
                    <Text style={styles.metaText}>
                      {t('savingsTracking.rowProgress', 'Progression')} :{' '}
                      {Math.round(item.collectionProgress * 100)} %
                    </Text>
                  ) : null}
                  {balLoading ? (
                    <SkeletonBlock width="100%" height={14} borderRadius={4} style={{ marginTop: 4 }} />
                  ) : bal != null ? (
                    <>
                      <Text style={styles.metaText}>
                        {t('savingsTracking.rowBalance', 'Solde personnel')}: {formatFcfa(bal.personalBalance)}
                      </Text>
                      <Text style={styles.metaText}>
                        {t('savingsTracking.rowProjected', 'Projection indicative')}:{' '}
                        {bal.estimatedFinalBalance != null &&
                        Number.isFinite(bal.estimatedFinalBalance)
                          ? formatFcfa(bal.estimatedFinalBalance)
                          : '—'}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.metaMuted}>{t('savingsTracking.balancePending', 'Solde en chargement…')}</Text>
                  )}
                  <Pressable
                    style={styles.detailLink}
                    onPress={() => navigateToTontine(item)}
                    accessibilityRole="button"
                    accessibilityLabel={t('savingsTracking.ctaViewDetail', 'Voir le détail')}
                  >
                    <Text style={styles.detailLinkText}>{t('savingsTracking.ctaViewDetail', 'Voir le détail')}</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                  </Pressable>
                </View>
              </View>
            );
          })
        )}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>
            {t('savingsTracking.summaryTitle', 'Résumé global')}
          </Text>
          {detailLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.sm }} />
          ) : null}
          <Text style={styles.summaryLine}>
            {t('savingsTracking.totalSaved', 'Total épargné (soldes personnels)')}:{' '}
            <Text style={styles.summaryEm}>
              {totals.totalPersonalBalance != null ? formatFcfa(totals.totalPersonalBalance) : '—'}
            </Text>
          </Text>
          <Text style={styles.summaryLine}>
            {t('savingsTracking.bonusEstimated', 'Bonus indicatif (agrégé)')}:{' '}
            <Text style={styles.summaryEm}>
              {totals.bonusEstimatedSum != null ? formatFcfa(totals.bonusEstimatedSum) : '—'}
            </Text>
          </Text>
          <Text style={styles.summaryHint}>
            {t(
              'savingsTracking.bonusDisclaimer',
              'Montants indicatifs : le bonus provient du pool commun et n’est pas garanti.'
            )}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>{t('savingsTracking.filterLabel', 'Vue par rôle')}</Text>
        <View style={styles.chipRow}>
          {ROLE_FILTERS.map((f) => (
            <Chip
              key={f}
              label={roleLabel(f)}
              selected={roleFilter === f}
              onPress={() => setRoleFilter(f)}
            />
          ))}
        </View>

        <Text style={styles.blockTitle}>
          {t('savingsTracking.blockRotative', 'Mes tontines rotatives')} ({rotative.length})
        </Text>
        {rotative.length === 0 ? (
          <Text style={styles.empty}>{t('savingsTracking.emptyRotative', 'Aucune tontine rotative.')}</Text>
        ) : (
          rotative.map((item) => {
            const qIdx = rotativeUids.indexOf(item.uid);
            const q = qIdx >= 0 ? reportQueries[qIdx] : undefined;
            const turns =
              userUid != null && q?.data != null
                ? countRotativeBeneficiaryTurns(q.data, userUid)
                : null;
            return (
              <View key={item.uid} style={styles.cardWrap}>
                <TontineCard item={item} onPress={navigateToTontine} onOrganizerPayoutPress={handleOrganizerPayoutPress} />
                <View style={styles.metaBox}>
                  <Text style={styles.metaText}>
                    {t('savingsTracking.rotativeTurns', 'Tours perçus (bénéficiaire)')}:{' '}
                    {turns != null ? String(turns) : '—'}
                  </Text>
                  <Text style={styles.metaText}>
                    {t('savingsTracking.rotativePotHint', 'Montant des cagnottes perçues')}:{' '}
                    {item.beneficiaryNetAmount != null
                      ? formatFcfa(item.beneficiaryNetAmount)
                      : '—'}
                  </Text>
                  <Text style={styles.metaMuted}>
                    {t(
                      'savingsTracking.rotativeReportHint',
                      'Le détail des montants cumulés dépend du rapport de tontine.'
                    )}
                  </Text>
                </View>
              </View>
            );
          })
        )}

        <View style={styles.reportsBox}>
          <Text style={styles.blockTitle}>{t('savingsTracking.reportsTitle', 'Rapports')}</Text>
          <Text style={styles.metaMuted}>
            {t(
              'savingsTracking.reportsBody',
              'Ouvrez une tontine pour consulter son rapport détaillé (timeline, cycles).'
            )}
          </Text>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate('Tontines')}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryBtnText}>
              {t('savingsTracking.reportsCta', 'Aller à Mes tontines')}
            </Text>
          </Pressable>
          <Text style={[styles.metaMuted, { marginTop: spacing.sm }]}>
            {t(
              'savingsTracking.exportHint',
              'Export PDF/CSV : flux non exposé sur mobile pour le moment.'
            )}
          </Text>
        </View>

        <Pressable
          style={styles.notifRow}
          onPress={() => {
            if (navigationRef.isReady()) navigationRef.navigate('NotificationsScreen');
          }}
          accessibilityRole="button"
        >
          <Ionicons name="notifications" size={22} color={colors.primary} />
          <Text style={styles.notifRowText}>{t('savingsTracking.openNotifications', 'Notifications')}</Text>
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          ) : null}
          <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.inputBackground },
  trackingHeaderContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomColor: colors.gray[200],
  },
  trackingHeaderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.gray[900],
  },
  notifBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  pad: { padding: spacing.md },
  scrollContent: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryTitle: { fontSize: 16, fontWeight: '700', marginBottom: spacing.sm, color: colors.gray[900] },
  summaryLine: { fontSize: 14, color: colors.gray[700], marginBottom: 6 },
  summaryEm: { fontWeight: '700', color: colors.gray[900] },
  summaryHint: { fontSize: 12, color: colors.gray[500], marginBottom: spacing.sm },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray[600],
    marginBottom: spacing.xs,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  chipSelected: { backgroundColor: '#E8F5E9', borderColor: colors.primary },
  chipLabel: { fontSize: 13, color: colors.gray[700] },
  chipLabelSelected: { color: colors.primary, fontWeight: '700' },
  blockTitle: { fontSize: 16, fontWeight: '700', marginBottom: spacing.sm, color: colors.gray[900] },
  emptyEpargneBox: { marginBottom: spacing.lg },
  empty: { color: colors.gray[500], marginBottom: spacing.md },
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    minHeight: 48,
  },
  primaryCtaText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  detailLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: 4,
  },
  detailLinkText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  cardWrap: { marginBottom: spacing.md },
  metaBox: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  metaText: { fontSize: 13, color: colors.gray[700], marginBottom: 4 },
  metaMuted: { fontSize: 12, color: colors.gray[500] },
  reportsBox: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  secondaryBtn: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    backgroundColor: '#E8F5E9',
  },
  secondaryBtnText: { color: colors.primary, fontWeight: '700' },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.lg,
  },
  notifRowText: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.gray[900] },
});
