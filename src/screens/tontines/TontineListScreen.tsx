import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '@/navigation/types';
import { selectAccountType } from '@/store/authSlice';
import { useTontines } from '@/hooks/useTontines';
import {
  approveMember,
  getTontinePreview,
  rejectInvitation,
  rejectMemberByOrganizer,
} from '@/api/tontinesApi';
import type { TontinePreview } from '@/api/types/api.types';
import { parseApiError, getErrorMessageForCode } from '@/api/errors';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { TontineCard } from '@/components/tontines/TontineCard';
import {
  ORIGIN_JOIN_REQUEST,
  type PendingMemberRequest,
  type PendingRequestsByTontine,
  type TontineFrequency,
  type TontineListItem,
} from '@/types/tontine';
import { apiClient } from '@/api/apiClient';
import { ENDPOINTS } from '@/api/endpoints';
import { InvitationInput } from '@/components/auth/InvitationInput';
import { formatPhoneSafe } from '@/utils/formatters';
import { isMembershipPending } from '@/utils/tontineMerge';
import { spacing } from '@/theme/spacing';
import {
  applyAdvancedFilters,
  buildTontineOverviewStats,
  getPrimaryActionKind,
  matchesQuickFilter,
  sortTontinesForList,
  type TontineAdvancedFilters,
  type TontineQuickFilter,
  type TontineRoleFilter,
  type TontineSortOption,
  type TontineStatusFilter,
  type TontineTypeFilter,
} from './tontineListViewModel';

const TAB_BAR_HEIGHT = 64;
const FAB_MARGIN_ABOVE_TAB = 12;

type Props = BottomTabScreenProps<MainTabParamList, 'Tontines'>;
type TabId = 'mine' | 'invitations';

const DEFAULT_ADVANCED_FILTERS: TontineAdvancedFilters = {
  typeFilter: 'ALL',
  statusFilter: 'all',
  roleFilter: 'all',
  sortBy: 'priority',
};

const FREQ_KEYS: Record<TontineFrequency, string> = {
  DAILY: 'createTontine.freqDAILY',
  WEEKLY: 'createTontine.freqWEEKLY',
  BIWEEKLY: 'createTontine.freqBIWEEKLY',
  MONTHLY: 'createTontine.freqMONTHLY',
};

function formatFcfa(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} FCFA`;
}

function formatShortDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const safeValue = value.includes('T') ? value : `${value}T00:00:00`;
  const date = new Date(safeValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatUpdatedAt(value: number): string {
  if (!value) return '';
  return new Date(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function countAdvancedFilters(filters: TontineAdvancedFilters): number {
  let count = 0;
  if (filters.typeFilter !== DEFAULT_ADVANCED_FILTERS.typeFilter) count += 1;
  if (filters.statusFilter !== DEFAULT_ADVANCED_FILTERS.statusFilter) count += 1;
  if (filters.roleFilter !== DEFAULT_ADVANCED_FILTERS.roleFilter) count += 1;
  if (filters.sortBy !== DEFAULT_ADVANCED_FILTERS.sortBy) count += 1;
  return count;
}

function hasSelectedFilters(
  quickFilter: TontineQuickFilter,
  advancedFilters: TontineAdvancedFilters
): boolean {
  return quickFilter !== 'all' || countAdvancedFilters(advancedFilters) > 0;
}

export const TontineListScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const accountType = useSelector(selectAccountType);
  const insets = useSafeAreaInsets();
  const fabBottom =
    Math.max(insets.bottom, spacing.md) + TAB_BAR_HEIGHT + FAB_MARGIN_ABOVE_TAB;

  const initialTab =
    (route.params as { initialTab?: TabId } | undefined)?.initialTab ?? 'mine';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [quickFilter, setQuickFilter] = useState<TontineQuickFilter>('all');
  const [advancedFilters, setAdvancedFilters] =
    useState<TontineAdvancedFilters>(DEFAULT_ADVANCED_FILTERS);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinLink, setJoinLink] = useState('');
  const [joinPreview, setJoinPreview] = useState<TontinePreview | null>(null);
  const [joinPreviewLoading, setJoinPreviewLoading] = useState(false);
  const [joinPreviewError, setJoinPreviewError] = useState<string | null>(null);

  useEffect(() => {
    const tab = (route.params as { initialTab?: TabId } | undefined)?.initialTab;
    if (tab && tab !== activeTab) setActiveTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(route.params as { initialTab?: TabId } | undefined)?.initialTab]);

  useEffect(() => {
    const openJoin = (route.params as { openJoinModal?: boolean } | undefined)?.openJoinModal;
    if (openJoin) {
      setShowJoinModal(true);
      navigation.setParams({ openJoinModal: false });
    }
  }, [(route.params as { openJoinModal?: boolean } | undefined)?.openJoinModal, navigation]);

  const { tontines, invitations, isLoading, isFetching, isError, dataUpdatedAt, refetch } =
    useTontines();

  const organizerTontines = useMemo(
    () => tontines.filter((item) => item.membershipRole === 'CREATOR' || item.isCreator),
    [tontines]
  );

  const {
    data: pendingRequestsByTontine = [],
    refetch: refetchPending,
    isFetching: isPendingFetching,
  } = useQuery<PendingRequestsByTontine[]>({
    queryKey: ['pendingMemberRequests', organizerTontines.map((item) => item.uid)],
    queryFn: async () => {
      const groups = await Promise.all(
        organizerTontines.map(async (item) => {
          const endpoint = ENDPOINTS.TONTINES.PENDING_MEMBER_REQUESTS(item.uid);
          const response = await apiClient.get<PendingMemberRequest[]>(endpoint.url);
          return {
            tontineUid: item.uid,
            tontineName: item.name,
            requests: Array.isArray(response.data) ? response.data : [],
          };
        })
      );
      return groups.filter((group) => group.requests.length > 0);
    },
    enabled: accountType === 'ORGANISATEUR' && organizerTontines.length > 0,
    staleTime: 30_000,
    networkMode: 'offlineFirst',
  });

  const pendingRequestCount = useMemo(
    () => pendingRequestsByTontine.reduce((sum, group) => sum + group.requests.length, 0),
    [pendingRequestsByTontine]
  );

  const overviewStats = useMemo(() => {
    const stats = buildTontineOverviewStats(tontines);
    return {
      activeCount: stats.activeCount,
      draftCount: stats.draftCount,
      pendingActionsCount: stats.pendingActionsCount + invitations.length,
    };
  }, [invitations.length, tontines]);

  const filteredMineTontines = useMemo(() => {
    const advancedFiltered = applyAdvancedFilters(tontines, advancedFilters);
    const quickFiltered = advancedFiltered.filter((item) =>
      matchesQuickFilter(item, quickFilter)
    );
    return sortTontinesForList(quickFiltered, advancedFilters.sortBy);
  }, [advancedFilters, quickFilter, tontines]);

  const filtersSelected = hasSelectedFilters(quickFilter, advancedFilters);
  const invitationTabBadgeCount =
    invitations.length + (accountType === 'ORGANISATEUR' ? pendingRequestCount : 0);

  const handleRefresh = useCallback(async () => {
    await refetch();
    if (activeTab === 'invitations' && accountType === 'ORGANISATEUR') {
      await refetchPending();
    }
  }, [accountType, activeTab, refetch, refetchPending]);

  const navigateToTontine = useCallback(
    (item: TontineListItem) => {
      const nav = navigation as { navigate: (screen: string, params: object) => void };
      if (item.type === 'EPARGNE') {
        nav.navigate('SavingsDetailScreen', { tontineUid: item.uid });
        return;
      }
      nav.navigate('TontineDetails', {
        tontineUid: item.uid,
        isCreator: item.isCreator ?? item.membershipRole === 'CREATOR',
      });
    },
    [navigation]
  );

  const handleCardPress = useCallback(
    (item: TontineListItem) => {
      if (isMembershipPending(item)) {
        if (item.invitationOrigin === 'INVITE') {
          (navigation as { navigate: (screen: string, params: object) => void }).navigate(
            'TontineContractSignature',
            { mode: 'INVITE_ACCEPT', tontineUid: item.uid, tontineName: item.name }
          );
        }
        return;
      }
      const action = getPrimaryActionKind(item);
      if (action === 'NEW_ROTATION') {
        navigateToTontine(item);
        return;
      }
      navigateToTontine(item);
    },
    [navigateToTontine, navigation]
  );

  const handleCreatePress = useCallback(() => {
    (navigation as { navigate: (screen: string) => void }).navigate(
      'TontineTypeSelectionScreen'
    );
  }, [navigation]);

  const handleInvitationAccept = useCallback(
    (item: TontineListItem) => {
      (navigation as { navigate: (screen: string, params: object) => void }).navigate(
        'TontineContractSignature',
        { mode: 'INVITE_ACCEPT', tontineUid: item.uid, tontineName: item.name }
      );
    },
    [navigation]
  );

  const handleInvitationReject = useCallback(
    (item: TontineListItem) => {
      Alert.alert(
        t('tontineList.rejectConfirmTitle', "Refuser l'invitation"),
        t(
          'tontineList.rejectConfirmMessage',
          "Êtes-vous sûr de vouloir refuser cette invitation ?"
        ),
        [
          { text: t('common.cancel', 'Annuler'), style: 'cancel' },
          {
            text: t('tontineList.reject', 'Refuser'),
            style: 'destructive',
            onPress: async () => {
              try {
                await rejectInvitation(item.uid);
                await queryClient.invalidateQueries({ queryKey: ['tontines'] });
                await queryClient.invalidateQueries({ queryKey: ['invitationsReceived'] });
                await refetch();
              } catch (error: unknown) {
                const apiError = parseApiError(error);
                const message = getErrorMessageForCode(
                  apiError,
                  i18n.language === 'sango' ? 'sango' : 'fr'
                );
                Alert.alert(t('common.error', 'Erreur'), message);
              }
            },
          },
        ]
      );
    },
    [i18n.language, queryClient, refetch, t]
  );

  const handleJoinLinkChange = useCallback(async (value: string) => {
    setJoinLink(value);
    setJoinPreview(null);
    setJoinPreviewError(null);
    const uid = value.trim().split('/').pop() ?? '';
    if (uid.length < 32) return;

    setJoinPreviewLoading(true);
    try {
      const preview = await getTontinePreview(uid);
      setJoinPreview(preview);
    } catch (error: unknown) {
      const apiError = parseApiError(error);
      setJoinPreviewError(
        apiError.httpStatus === 404
          ? 'Tontine introuvable. Vérifiez le lien.'
          : 'Impossible de charger la tontine.'
      );
    } finally {
      setJoinPreviewLoading(false);
    }
  }, []);

  const handleJoinQrScanned = useCallback(async (uid: string) => {
    setJoinLink(uid);
    setJoinPreview(null);
    setJoinPreviewError(null);
    setJoinPreviewLoading(true);
    try {
      const preview = await getTontinePreview(uid);
      setJoinPreview(preview);
    } catch (error: unknown) {
      const apiError = parseApiError(error);
      setJoinPreviewError(
        apiError.httpStatus === 404
          ? 'Tontine introuvable. Vérifiez le QR Code.'
          : 'Impossible de charger la tontine.'
      );
    } finally {
      setJoinPreviewLoading(false);
    }
  }, []);

  const handleResetFilters = useCallback(() => {
    setQuickFilter('all');
    setAdvancedFilters(DEFAULT_ADVANCED_FILTERS);
  }, []);

  const renderMineCard = useCallback(
    ({ item }: { item: TontineListItem }) => (
      <TontineCard item={item} onPress={handleCardPress} onNewRotationPress={handleCardPress} />
    ),
    [handleCardPress]
  );

  const renderInvitationCard = useCallback(
    ({ item }: { item: TontineListItem }) => {
      const isJoinRequest = item.invitationOrigin === ORIGIN_JOIN_REQUEST;
      const frequencyLabel = t(
        FREQ_KEYS[item.frequency ?? 'MONTHLY'],
        item.frequency ?? 'MONTHLY'
      );
      const startDate = formatShortDate(item.startDate);

      return (
        <View style={[styles.invitationCard, isJoinRequest && styles.invitationCardPending]}>
          <View
            style={[
              styles.invitationBadge,
              isJoinRequest ? styles.badgePending : styles.badgeInvite,
            ]}
          >
            <Ionicons
              name={isJoinRequest ? 'time-outline' : 'mail-open-outline'}
              size={14}
              color={isJoinRequest ? '#C77D00' : '#1A6B3C'}
            />
            <Text
              style={[
                styles.invitationBadgeText,
                isJoinRequest ? styles.badgePendingText : styles.badgeInviteText,
              ]}
            >
              {isJoinRequest
                ? t('tontineList.joinRequestLabel', "Demande d'adhésion")
                : t('tontineList.invitationReceived', 'Invitation reçue')}
            </Text>
          </View>
          <Text style={styles.invitationTitle}>{item.name}</Text>
          <Text style={styles.invitationAmount}>{formatFcfa(item.amountPerShare)}</Text>
          <Text style={styles.invitationMeta}>
            {frequencyLabel} · {item.totalCycles} {t('tontineList.cycles', 'cycles')}
          </Text>
          {item.organizerName ? (
            <Text style={styles.invitationMeta}>
              {t('tontineList.organizerLabel', 'Organisateur')} : {item.organizerName}
            </Text>
          ) : null}
          {startDate ? (
            <Text style={styles.invitationMeta}>
              {t('tontineList.startDateLabel', 'Début')} : {startDate}
            </Text>
          ) : null}
          {item.invitationMessage ? (
            <View style={styles.messageBox}>
              <Text style={styles.messageLabel}>
                {t('tontineList.invitationMessageLabel', "Message d'invitation")}
              </Text>
              <Text style={styles.messageText}>{item.invitationMessage}</Text>
            </View>
          ) : null}
          <Text style={styles.supportText}>
            {isJoinRequest
              ? t(
                  'tontineList.joinRequestSub',
                  "En attente de validation de l'organisateur."
                )
              : t(
                  'tontineList.invitationReceivedSub',
                  'Acceptez cette invitation pour rejoindre automatiquement la tontine.'
                )}
          </Text>
          {!isJoinRequest ? (
            <View style={styles.cardActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => handleInvitationReject(item)}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryButtonText}>
                  {t('tontineList.reject', 'Refuser')}
                </Text>
              </Pressable>
              <Pressable
                style={styles.primaryButton}
                onPress={() => handleInvitationAccept(item)}
                accessibilityRole="button"
              >
                <Text style={styles.primaryButtonText}>
                  {t('tontineList.accept', 'Accepter')}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      );
    },
    [handleInvitationAccept, handleInvitationReject, t]
  );

  const renderPendingRequestCard = useCallback(
    (request: PendingMemberRequest, tontineUid: string) => (
      <View key={request.uid} style={styles.pendingRequestCard}>
        <View style={styles.pendingRequestBadge}>
          <Ionicons name="person-add-outline" size={14} color="#C77D00" />
          <Text style={styles.pendingRequestBadgeText}>
            {t('tontineList.joinRequestLabel', "Demande d'adhésion")}
          </Text>
        </View>
        <Text style={styles.pendingRequestTitle}>{request.user.fullName}</Text>
        <Text style={styles.pendingRequestMeta}>
          {formatPhoneSafe(
            (request.user as { phoneMasked?: string; phone?: string }).phoneMasked ??
              request.user.phone
          )}
        </Text>
        <Text style={styles.pendingRequestMeta}>
          {t('tontineList.scoreLabel', 'Score Kelemba')} : {request.user.kelembScore}
        </Text>
        <View style={styles.cardActions}>
          <Pressable
            style={styles.secondaryButton}
            onPress={() =>
              Alert.alert(
                t('tontineList.rejectRequestTitle', 'Refuser la demande'),
                t(
                  'tontineList.rejectRequestMessage',
                  "Êtes-vous sûr de vouloir refuser cette demande d'adhésion ?"
                ),
                [
                  { text: t('common.cancel', 'Annuler'), style: 'cancel' },
                  {
                    text: t('tontineList.reject', 'Refuser'),
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await rejectMemberByOrganizer(tontineUid, request.uid);
                        await queryClient.invalidateQueries({
                          queryKey: ['pendingMemberRequests'],
                        });
                        await refetchPending();
                      } catch (error: unknown) {
                        const apiError = parseApiError(error);
                        const message = getErrorMessageForCode(
                          apiError,
                          i18n.language === 'sango' ? 'sango' : 'fr'
                        );
                        Alert.alert(t('common.error', 'Erreur'), message);
                      }
                    },
                  },
                ]
              )
            }
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonText}>
              {t('tontineList.reject', 'Refuser')}
            </Text>
          </Pressable>
          <Pressable
            style={styles.primaryButton}
            onPress={async () => {
              try {
                await approveMember(tontineUid, request.uid);
                await queryClient.invalidateQueries({ queryKey: ['pendingMemberRequests'] });
                await queryClient.invalidateQueries({ queryKey: ['tontines'] });
                await refetchPending();
              } catch (error: unknown) {
                const apiError = parseApiError(error);
                const message = getErrorMessageForCode(
                  apiError,
                  i18n.language === 'sango' ? 'sango' : 'fr'
                );
                Alert.alert(t('common.error', 'Erreur'), message);
              }
            }}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>
              {t('tontineList.approve', 'Approuver')}
            </Text>
          </Pressable>
        </View>
      </View>
    ),
    [i18n.language, queryClient, refetchPending, t]
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.skeletonHead} />
        <View style={styles.skeletonRow}>
          <SkeletonBlock width={116} height={38} borderRadius={19} />
          <SkeletonBlock width={96} height={38} borderRadius={19} />
          <SkeletonBlock width={110} height={38} borderRadius={19} />
        </View>
        <View style={styles.skeletonStats}>
          <SkeletonBlock width="31%" height={80} borderRadius={18} />
          <SkeletonBlock width="31%" height={80} borderRadius={18} />
          <SkeletonBlock width="31%" height={80} borderRadius={18} />
        </View>
        <View style={styles.skeletonList}>
          <SkeletonBlock width="100%" height={220} borderRadius={18} style={styles.skeletonCard} />
          <SkeletonBlock width="100%" height={220} borderRadius={18} style={styles.skeletonCard} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, activeTab === 'mine' && styles.tabActive]}
          onPress={() => setActiveTab('mine')}
          accessibilityRole="button"
        >
          <Text style={[styles.tabText, activeTab === 'mine' && styles.tabTextActive]}>
            {t('tontineList.tabMine', 'Mes tontines')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'invitations' && styles.tabActive]}
          onPress={() => setActiveTab('invitations')}
          accessibilityRole="button"
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'invitations' && styles.tabTextActive,
            ]}
          >
            {t('tontineList.tabInvitations', 'Invitations')}
          </Text>
          {invitationTabBadgeCount > 0 ? (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{invitationTabBadgeCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <Pressable
        style={styles.joinBanner}
        onPress={() => setShowJoinModal(true)}
        accessibilityRole="button"
      >
        <Ionicons name="enter-outline" size={18} color="#1A6B3C" />
        <Text style={styles.joinBannerText}>
          {t('tontineList.joinCta', 'Rejoindre une tontine')}
        </Text>
        <Ionicons name="chevron-forward" size={16} color="#1A6B3C" />
      </Pressable>

      {activeTab === 'mine' ? (
        <View style={styles.mineHeader}>
          <View style={styles.overviewRow}>
            <View style={styles.overviewCard}>
              <Text style={styles.overviewValue}>{overviewStats.activeCount}</Text>
              <Text style={styles.overviewLabel}>
                {t('tontineList.overviewActive', 'Actives')}
              </Text>
            </View>
            <View style={styles.overviewCard}>
              <Text style={styles.overviewValue}>{overviewStats.draftCount}</Text>
              <Text style={styles.overviewLabel}>
                {t('tontineList.overviewDraft', 'Brouillons')}
              </Text>
            </View>
            <View style={styles.overviewCard}>
              <Text style={styles.overviewValue}>{overviewStats.pendingActionsCount}</Text>
              <Text style={styles.overviewLabel}>
                {t('tontineList.overviewPending', 'Actions en attente')}
              </Text>
            </View>
          </View>

          <View style={styles.quickFiltersWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickFiltersContent}
            >
              {([
                ['all', 'tontineList.filterAll', 'Toutes'],
                ['active', 'tontineList.filterActive', 'Actives'],
                ['draft', 'tontineList.filterDraft', 'Brouillons'],
              ] as const).map(([id, key, fallback]) => {
                const active = quickFilter === id;
                return (
                  <Pressable
                    key={id}
                    style={[styles.quickChip, active && styles.quickChipActive]}
                    onPress={() => setQuickFilter(id)}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.quickChipText,
                        active && styles.quickChipTextActive,
                      ]}
                    >
                      {t(key, fallback)}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                style={[
                  styles.quickChip,
                  filtersSelected && styles.quickChipAttention,
                ]}
                onPress={() => setShowFilterModal(true)}
                accessibilityRole="button"
              >
                <Ionicons
                  name="options-outline"
                  size={15}
                  color={filtersSelected ? '#FFFFFF' : '#4B5563'}
                />
                <Text
                  style={[
                    styles.quickChipText,
                    filtersSelected && styles.quickChipTextActive,
                  ]}
                >
                  {t('tontineList.filterButton', 'Filtres')}
                </Text>
                {countAdvancedFilters(advancedFilters) > 0 ? (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>
                      {countAdvancedFilters(advancedFilters)}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            </ScrollView>
          </View>
          {filtersSelected ? (
            <Text style={styles.filterHint}>
              {filteredMineTontines.length > 0
                ? t('tontineList.filteredResultsCount', '{{count}} résultat(s)', {
                    count: filteredMineTontines.length,
                  })
                : t(
                    'tontineList.noResults',
                    'Aucune tontine ne correspond à ces filtres.'
                  )}
            </Text>
          ) : null}
        </View>
      ) : null}

      {isError && (tontines.length > 0 || invitations.length > 0 || pendingRequestCount > 0) ? (
        <View style={styles.errorBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color="#92400E" />
          <Text style={styles.errorBannerText}>
            {t(
              'tontineList.offlineMessage',
              'Données récentes affichées — dernière mise à jour : {{date}}',
              { date: formatUpdatedAt(dataUpdatedAt) }
            )}
          </Text>
        </View>
      ) : null}

      <FlatList
        data={activeTab === 'mine' ? filteredMineTontines : invitations}
        keyExtractor={(item) => item.uid}
        renderItem={activeTab === 'mine' ? renderMineCard : renderInvitationCard}
        contentContainerStyle={[
          styles.listContent,
          activeTab === 'mine' && filteredMineTontines.length === 0 && styles.listContentCentered,
          activeTab === 'invitations' &&
            invitations.length === 0 &&
            pendingRequestCount === 0 &&
            styles.listContentCentered,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isFetching || isPendingFetching}
            onRefresh={handleRefresh}
            tintColor="#1A6B3C"
          />
        }
        ListHeaderComponent={
          activeTab === 'invitations' && accountType === 'ORGANISATEUR' ? (
            <View style={styles.invitationHeaderSection}>
              {pendingRequestsByTontine.length > 0 ? (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>
                      {t('tontineList.pendingRequests', "Demandes d'adhésion reçues")}
                    </Text>
                    <View style={styles.sectionCount}>
                      <Text style={styles.sectionCountText}>{pendingRequestCount}</Text>
                    </View>
                  </View>
                  {pendingRequestsByTontine.map((group) => (
                    <View key={group.tontineUid} style={styles.pendingGroup}>
                      <Text style={styles.pendingGroupTitle}>{group.tontineName}</Text>
                      <Text style={styles.pendingGroupSub}>
                        {group.requests.length} {t('tontineList.requestsLabel', 'demande(s)')}
                      </Text>
                      {group.requests.map((request) =>
                        renderPendingRequestCard(request, group.tontineUid)
                      )}
                    </View>
                  ))}
                </>
              ) : null}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {t('tontineList.myInvitations', 'Mes invitations reçues')}
                </Text>
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          activeTab === 'mine' ? (
            isError && tontines.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="cloud-offline-outline" size={56} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>
                  {t('tontineList.errorTitle', 'Impossible de charger vos tontines')}
                </Text>
                <Text style={styles.emptySub}>
                  {t(
                    'tontineList.errorSub',
                    'Vérifiez votre connexion puis réessayez.'
                  )}
                </Text>
                <Pressable style={styles.emptyButton} onPress={handleRefresh}>
                  <Text style={styles.emptyButtonText}>
                    {t('common.retry', 'Réessayer')}
                  </Text>
                </Pressable>
              </View>
            ) : filtersSelected && tontines.length > 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="options-outline" size={56} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>
                  {t('tontineList.noResults', 'Aucune tontine ne correspond à ces filtres.')}
                </Text>
                <Pressable style={styles.emptyButton} onPress={handleResetFilters}>
                  <Text style={styles.emptyButtonText}>
                    {t('tontineList.resetFilters', 'Réinitialiser les filtres')}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={64} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>
                  {t('tontineList.emptyMine', "Vous n'êtes membre d'aucune tontine")}
                </Text>
                <Text style={styles.emptySub}>
                  {t(
                    'tontineList.emptyMineSub',
                    'Rejoignez une tontine ou créez-en une pour commencer.'
                  )}
                </Text>
                {accountType === 'ORGANISATEUR' ? (
                  <Pressable style={styles.emptyButton} onPress={handleCreatePress}>
                    <Text style={styles.emptyButtonText}>
                      {t('tontineList.createFirst', 'Créer ma première tontine')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            )
          ) : invitations.length === 0 && pendingRequestCount === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="mail-open-outline" size={64} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>
                {t('tontineList.emptyInvitations', 'Aucune invitation en attente')}
              </Text>
              <Text style={styles.emptySub}>
                {t(
                  'tontineList.emptyInvitationsSub',
                  "Vos invitations et demandes d'adhésion apparaîtront ici."
                )}
              </Text>
            </View>
          ) : null
        }
      />

      {accountType === 'ORGANISATEUR' ? (
        <Pressable
          style={[styles.fab, { bottom: fabBottom }]}
          onPress={handleCreatePress}
          accessibilityRole="button"
          accessibilityLabel={t('tontineList.createTontine', 'Créer une tontine')}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      ) : null}

      <Modal
        visible={showFilterModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('tontineList.filterButton', 'Filtres')}</Text>
            <Pressable
              onPress={() => setShowFilterModal(false)}
              style={styles.modalClose}
              accessibilityRole="button"
            >
              <Ionicons name="close" size={24} color="#1A1A2E" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.filterModalContent}>
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>{t('tontineList.filterType', 'Type')}</Text>
              <View style={styles.optionGrid}>
                {([
                  ['ALL', 'tontineList.filterAll', 'Toutes'],
                  ['ROTATIVE', 'tontineList.typeRotative', 'Rotative'],
                  ['EPARGNE', 'tontineList.typeSavings', 'Épargne'],
                ] as const).map(([id, key, fallback]) => {
                  const active = advancedFilters.typeFilter === id;
                  return (
                    <Pressable
                      key={id}
                      style={[styles.optionChip, active && styles.optionChipActive]}
                      onPress={() =>
                        setAdvancedFilters((current) => ({
                          ...current,
                          typeFilter: id as TontineTypeFilter,
                        }))
                      }
                      accessibilityRole="button"
                    >
                      <Text
                        style={[styles.optionText, active && styles.optionTextActive]}
                      >
                        {t(key, fallback)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>
                {t('tontineList.filterStatus', 'Statut')}
              </Text>
              <View style={styles.optionGrid}>
                {([
                  ['all', 'tontineList.filterAll', 'Toutes'],
                  ['draft', 'tontineList.statusDraft', 'Brouillon'],
                  ['active', 'tontineList.statusActive', 'Active'],
                  ['between_rounds', 'tontineList.statusBetweenRounds', 'Entre deux tours'],
                  ['paused', 'tontineList.statusPaused', 'En pause'],
                  ['completed', 'tontineList.statusCompleted', 'Terminée'],
                  ['cancelled', 'tontineList.statusCancelled', 'Annulée'],
                ] as const).map(([id, key, fallback]) => {
                  const active = advancedFilters.statusFilter === id;
                  return (
                    <Pressable
                      key={id}
                      style={[styles.optionChip, active && styles.optionChipActive]}
                      onPress={() =>
                        setAdvancedFilters((current) => ({
                          ...current,
                          statusFilter: id as TontineStatusFilter,
                        }))
                      }
                      accessibilityRole="button"
                    >
                      <Text
                        style={[styles.optionText, active && styles.optionTextActive]}
                      >
                        {t(key, fallback)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>{t('tontineList.filterRole', 'Rôle')}</Text>
              <View style={styles.optionGrid}>
                {([
                  ['all', 'tontineList.filterAll', 'Toutes'],
                  ['creator', 'tontineList.organizer', 'Organisateur'],
                  ['member', 'tontineList.memberRole', 'Membre'],
                ] as const).map(([id, key, fallback]) => {
                  const active = advancedFilters.roleFilter === id;
                  return (
                    <Pressable
                      key={id}
                      style={[styles.optionChip, active && styles.optionChipActive]}
                      onPress={() =>
                        setAdvancedFilters((current) => ({
                          ...current,
                          roleFilter: id as TontineRoleFilter,
                        }))
                      }
                      accessibilityRole="button"
                    >
                      <Text
                        style={[styles.optionText, active && styles.optionTextActive]}
                      >
                        {t(key, fallback)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>{t('tontineList.filterSort', 'Tri')}</Text>
              <View style={styles.optionGrid}>
                {([
                  ['priority', 'tontineList.sortPriority', 'Priorité'],
                  ['dueDate', 'tontineList.sortDueDate', 'Prochaine échéance'],
                  ['amount', 'tontineList.sortAmount', 'Montant'],
                  ['name', 'tontineList.sortName', 'Nom'],
                  ['recent', 'tontineList.sortRecent', 'Plus récentes'],
                ] as const).map(([id, key, fallback]) => {
                  const active = advancedFilters.sortBy === id;
                  return (
                    <Pressable
                      key={id}
                      style={[styles.optionChip, active && styles.optionChipActive]}
                      onPress={() =>
                        setAdvancedFilters((current) => ({
                          ...current,
                          sortBy: id as TontineSortOption,
                        }))
                      }
                      accessibilityRole="button"
                    >
                      <Text
                        style={[styles.optionText, active && styles.optionTextActive]}
                      >
                        {t(key, fallback)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>
          <View style={styles.modalFooter}>
            <Pressable
              style={styles.modalSecondary}
              onPress={handleResetFilters}
              accessibilityRole="button"
            >
              <Text style={styles.modalSecondaryText}>
                {t('tontineList.resetFilters', 'Réinitialiser les filtres')}
              </Text>
            </Pressable>
            <Pressable
              style={styles.modalPrimary}
              onPress={() => setShowFilterModal(false)}
              accessibilityRole="button"
            >
              <Text style={styles.modalPrimaryText}>{t('common.apply', 'Appliquer')}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showJoinModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowJoinModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {t('tontineList.joinCta', 'Rejoindre une tontine')}
            </Text>
            <Pressable
              onPress={() => {
                setShowJoinModal(false);
                setJoinLink('');
                setJoinPreview(null);
                setJoinPreviewError(null);
              }}
              style={styles.modalClose}
              accessibilityRole="button"
            >
              <Ionicons name="close" size={24} color="#1A1A2E" />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.joinModalContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.joinSubtitle}>
              {t(
                'tontineList.joinSubtitle',
                "Collez un lien d'invitation ou scannez un QR Code."
              )}
            </Text>
            <InvitationInput
              value={joinLink}
              onChangeText={handleJoinLinkChange}
              onScanned={handleJoinQrScanned}
              isLoading={joinPreviewLoading}
              error={joinPreviewError}
            />
            {joinPreview ? (
              <View style={styles.joinPreview}>
                <Text style={styles.joinPreviewTitle}>{joinPreview.name}</Text>
                <Text style={styles.joinPreviewText}>
                  {joinPreview.amountPerShare?.toLocaleString('fr-FR')} FCFA
                  {joinPreview.frequency ? ` · ${joinPreview.frequency}` : ''}
                </Text>
                {joinPreview.memberCount !== undefined ? (
                  <Text style={styles.joinPreviewText}>
                    {joinPreview.memberCount} {t('tontineList.memberCount', 'membre(s)')}
                  </Text>
                ) : null}
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => {
                    if (!joinPreview) return;
                    setShowJoinModal(false);
                    setJoinLink('');
                    setJoinPreview(null);
                    setJoinPreviewError(null);
                    (navigation as {
                      navigate: (screen: string, params: object) => void;
                    }).navigate('TontineContractSignature', {
                      mode: 'JOIN_REQUEST',
                      tontineUid: joinPreview.uid,
                      tontineName: joinPreview.name,
                    });
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryButtonText}>
                    {t('tontineList.sendJoinRequest', "Envoyer ma demande d'adhésion")}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 8 },
  tab: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tabActive: { backgroundColor: '#1A6B3C', borderColor: '#1A6B3C' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  tabTextActive: { color: '#FFFFFF' },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#D0021B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabBadgeText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  joinBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#F0F9F4',
    borderWidth: 1,
    borderColor: '#C6E6D4',
  },
  joinBannerText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#1A6B3C' },
  mineHeader: { paddingHorizontal: 20, gap: 12, marginBottom: 6 },
  overviewRow: { flexDirection: 'row', gap: 10 },
  overviewCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  overviewValue: { fontSize: 22, fontWeight: '800', color: '#111827' },
  overviewLabel: { marginTop: 4, fontSize: 12, fontWeight: '600', color: '#6B7280' },
  quickFiltersWrap: { marginHorizontal: -20 },
  quickFiltersContent: { paddingHorizontal: 20, gap: 8 },
  quickChip: {
    minHeight: 38,
    borderRadius: 19,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  quickChipActive: { backgroundColor: '#1A6B3C', borderColor: '#1A6B3C' },
  quickChipAttention: { backgroundColor: '#0055A5', borderColor: '#0055A5' },
  quickChipText: { fontSize: 13, fontWeight: '700', color: '#4B5563' },
  quickChipTextActive: { color: '#FFFFFF' },
  filterBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 4,
  },
  filterBadgeText: { fontSize: 11, fontWeight: '800', color: '#0055A5' },
  filterHint: { fontSize: 12, color: '#6B7280' },
  errorBanner: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
  },
  errorBannerText: { flex: 1, fontSize: 13, lineHeight: 18, color: '#92400E' },
  listContent: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 120 },
  listContentCentered: { flexGrow: 1, justifyContent: 'center' },
  invitationHeaderSection: { paddingBottom: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCount: {
    backgroundColor: '#FEE2E2',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sectionCountText: { fontSize: 12, fontWeight: '800', color: '#B91C1C' },
  pendingGroup: { marginBottom: 18 },
  pendingGroupTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 2 },
  pendingGroupSub: { fontSize: 13, color: '#6B7280', marginBottom: 10 },
  pendingRequestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  pendingRequestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#FFF7E6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  pendingRequestBadgeText: { fontSize: 11, fontWeight: '800', color: '#C77D00' },
  pendingRequestTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  pendingRequestMeta: { marginTop: 4, fontSize: 13, color: '#6B7280' },
  invitationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  invitationCardPending: { backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#E5E7EB' },
  invitationBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  badgeInvite: { backgroundColor: '#E8F5E9' },
  badgePending: { backgroundColor: '#FFF7E6' },
  invitationBadgeText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  badgeInviteText: { color: '#1A6B3C' },
  badgePendingText: { color: '#C77D00' },
  invitationTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  invitationAmount: { marginTop: 10, fontSize: 24, fontWeight: '900', color: '#1A6B3C' },
  invitationMeta: { marginTop: 4, fontSize: 13, lineHeight: 18, color: '#6B7280' },
  messageBox: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB' },
  messageLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 4 },
  messageText: { fontSize: 13, lineHeight: 19, color: '#374151' },
  supportText: { marginTop: 12, fontSize: 13, lineHeight: 19, color: '#4B5563' },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#1A6B3C',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D0021B',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: { fontSize: 14, fontWeight: '800', color: '#D0021B' },
  emptyState: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  emptyTitle: {
    marginTop: 16,
    fontSize: 17,
    fontWeight: '800',
    color: '#374151',
    textAlign: 'center',
  },
  emptySub: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: 20,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#1A6B3C',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyButtonText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F5A623',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F5A623',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  skeletonHead: {
    height: 46,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 23,
    backgroundColor: '#E5E7EB',
  },
  skeletonRow: { flexDirection: 'row', gap: 8, marginHorizontal: 20, marginTop: 18 },
  skeletonStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 18,
  },
  skeletonList: { paddingHorizontal: 20, paddingTop: 22 },
  skeletonCard: { marginBottom: 14 },
  modalContainer: { flex: 1, backgroundColor: '#F7F8FA' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A2E' },
  modalClose: { padding: 8, minHeight: 44, justifyContent: 'center' },
  filterModalContent: { padding: 20, gap: 22 },
  filterSection: { gap: 12 },
  filterSectionTitle: { fontSize: 14, fontWeight: '800', color: '#374151' },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionChip: {
    minHeight: 40,
    borderRadius: 20,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionChipActive: { backgroundColor: '#1A6B3C', borderColor: '#1A6B3C' },
  optionText: { fontSize: 13, fontWeight: '700', color: '#4B5563' },
  optionTextActive: { color: '#FFFFFF' },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  modalPrimary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#1A6B3C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  modalSecondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  modalSecondaryText: { fontSize: 14, fontWeight: '800', color: '#374151' },
  joinModalContent: { padding: 20, gap: 16 },
  joinSubtitle: { fontSize: 14, lineHeight: 20, color: '#6B7280' },
  joinPreview: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  joinPreviewTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A2E' },
  joinPreviewText: { fontSize: 13, color: '#6B7280' },
});
