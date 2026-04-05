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
  SectionList,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '@/navigation/types';
import { selectAccountType, selectUserUid } from '@/store/authSlice';
import { useTontines } from '@/hooks/useTontines';
import {
  approveMember,
  getInviteLink,
  getTontinePreview,
  rejectInvitation,
  rejectMemberByOrganizer,
} from '@/api/tontinesApi';
import type { TontinePreview } from '@/api/types/api.types';
import { parseApiError, getErrorMessageForCode } from '@/api/errors';
import {
  InvitationCard,
  OverdueBanner,
  TontineCardSkeletonList,
  TontineEmptyState,
  TontineFullCard,
  TontineSummaryStrip,
} from '@/components/tontines';
import { navigationRef } from '@/navigation/navigationRef';
import {
  type PendingMemberRequest,
  type PendingRequestsByTontine,
  type TontineListItem,
} from '@/types/tontine';
import { apiClient } from '@/api/apiClient';
import { ENDPOINTS } from '@/api/endpoints';
import { openAuthenticatedReportUrl } from '@/utils/reportOpenUrl';
import { InvitationInput } from '@/components/auth/InvitationInput';
import { formatPhoneSafe } from '@/utils/formatters';
import { isMembershipPending } from '@/utils/tontineMerge';
import { RADIUS } from '@/theme/spacing';
import { COLORS } from '@/theme/colors';
import {
  computeActiveCount,
  computeNextBeneficiaryCycleLabel,
  computeTotalEngagedThisMonth,
  computeWorstOverdueTontine,
} from '@/utils/tontineListMetrics';
import {
  deriveTontinePaymentUiState,
  resolveTontinePaymentContext,
} from '@/utils/tontinePaymentState';
import {
  chipCounts,
  filterAndSearch,
  filterPendingList,
  groupByStatusForSections,
  type FilterChip,
  type SectionKey,
  type SortOrder,
} from './tontineListQuery';

type Props = BottomTabScreenProps<MainTabParamList, 'Tontines'>;

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

function IconLines({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M4 6h16M4 12h16M4 18h10" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function IconPlus({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function IconSearch({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 21l-4.35-4.35M11 18a7 7 0 110-14 7 7 0 010 14z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconFunnel({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 4h16l-6 8v6l-4 2v-8L4 4z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const SECTION_LABELS: Record<SectionKey, string> = {
  ACTIVE: 'Actives',
  DRAFT: 'Brouillons',
  COMPLETED: 'Terminées',
};

const CHIP_DEFS: { id: FilterChip; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'active', label: 'Actives' },
  { id: 'draft', label: 'Brouillons' },
  { id: 'pending', label: 'Invitations' },
  { id: 'completed', label: 'Terminées' },
];

export const TontineListScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const accountType = useSelector(selectAccountType);
  const userUid = useSelector(selectUserUid);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeChip, setActiveChip] = useState<FilterChip>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinLink, setJoinLink] = useState('');
  const [joinPreview, setJoinPreview] = useState<TontinePreview | null>(null);
  const [joinPreviewLoading, setJoinPreviewLoading] = useState(false);
  const [joinPreviewError, setJoinPreviewError] = useState<string | null>(null);

  useEffect(() => {
    const openJoin = (route.params as { openJoinModal?: boolean } | undefined)?.openJoinModal;
    if (openJoin) {
      setShowJoinModal(true);
      navigation.setParams({ openJoinModal: false });
    }
  }, [(route.params as { openJoinModal?: boolean } | undefined)?.openJoinModal, navigation]);

  const { tontines, invitations, isLoading, isError, dataUpdatedAt, refetch } = useTontines();

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

  const tontinesNoPending = useMemo(
    () => tontines.filter((item) => !isMembershipPending(item)),
    [tontines]
  );

  const counts = useMemo(
    () => chipCounts(tontines, invitations),
    [invitations, tontines]
  );

  const filteredItems = useMemo(() => {
    if (activeChip === 'pending') {
      return filterPendingList(invitations, tontines, searchQuery, sortOrder);
    }
    return filterAndSearch(tontinesNoPending, searchQuery, activeChip, sortOrder);
  }, [
    activeChip,
    invitations,
    searchQuery,
    sortOrder,
    tontines,
    tontinesNoPending,
  ]);

  const useSectionMode = activeChip === 'all' && searchQuery.trim() === '';

  const sections = useMemo(() => {
    if (!useSectionMode) return [];
    return groupByStatusForSections(filteredItems);
  }, [filteredItems, useSectionMode]);

  const overduePick = useMemo(() => computeWorstOverdueTontine(tontines), [tontines]);

  const summaryProps = useMemo(
    () => ({
      activeCount: computeActiveCount(tontines),
      totalEngagedThisMonth: computeTotalEngagedThisMonth(tontines),
      nextBeneficiaryCycleLabel: computeNextBeneficiaryCycleLabel(tontines),
    }),
    [tontines]
  );

  const headerPaddingTop =
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 12;

  const openSortMenu = useCallback(() => {
    Alert.alert(
      'Trier par',
      undefined,
      [
        { text: 'Plus récentes', onPress: () => setSortOrder('recent') },
        { text: 'Nom A → Z', onPress: () => setSortOrder('name_asc') },
        { text: 'Paiement imminent', onPress: () => setSortOrder('due_soon') },
        { text: 'Montant décroissant', onPress: () => setSortOrder('amount_desc') },
        { text: 'Annuler', style: 'cancel' },
      ],
      { cancelable: true }
    );
  }, []);

  const navigateToTontine = useCallback(
    (
      item: TontineListItem,
      tab?: 'dashboard' | 'rotation' | 'payments' | 'members'
    ) => {
      const nav = navigation as { navigate: (screen: string, params: object) => void };
      const isCreator = item.isCreator ?? item.membershipRole === 'CREATOR';
      if (item.type === 'EPARGNE') {
        nav.navigate('SavingsDetailScreen', { tontineUid: item.uid, isCreator });
        return;
      }
      nav.navigate('TontineDetails', {
        tontineUid: item.uid,
        isCreator,
        ...(tab != null ? { tab } : {}),
      });
    },
    [navigation]
  );

  const navigateToTontineFinalReport = useCallback(
    (item: TontineListItem) => {
      const nav = navigation as { navigate: (screen: string, params: object) => void };
      if (item.type === 'EPARGNE') {
        nav.navigate('SavingsDetailScreen', {
          tontineUid: item.uid,
          uid: item.uid,
          isCreator: item.isCreator ?? item.membershipRole === 'CREATOR',
        });
        return;
      }
      nav.navigate('TontineDetails', {
        tontineUid: item.uid,
        isCreator: item.isCreator ?? item.membershipRole === 'CREATOR',
        tab: 'payments',
      });
    },
    [navigation]
  );

  const handleCertificateDownload = useCallback(
    (_item: TontineListItem) => {
      if (userUid == null || userUid === '') return;
      void openAuthenticatedReportUrl(ENDPOINTS.REPORTS.USER_CERTIFICATE(userUid).url);
    },
    [userUid]
  );

  /** Versement cagnotte : écran détail (dashboard) — step-up PIN côté détail. */
  const handlePayoutTriggerPress = useCallback(
    (item: TontineListItem) => {
      navigateToTontine(item, 'dashboard');
    },
    [navigateToTontine]
  );

  const handleLaunchRotationPress = useCallback(
    (item: TontineListItem) => {
      const nav = navigation as { navigate: (screen: string, params: object) => void };
      nav.navigate('TontineActivationScreen', { tontineUid: item.uid });
    },
    [navigation]
  );

  const handleActivatePress = useCallback(
    (item: TontineListItem) => {
      const nav = navigation as { navigate: (screen: string, params: object) => void };
      nav.navigate('TontineActivationScreen', { tontineUid: item.uid });
    },
    [navigation]
  );

  const handlePaymentPress = useCallback(
    (item: TontineListItem) => {
      if (item.currentCycleUid == null || item.currentCycleUid === '') {
        navigateToTontine(item, 'dashboard');
        return;
      }
      const ctx = resolveTontinePaymentContext(item);
      const ui = deriveTontinePaymentUiState(item);
      if (!navigationRef.isReady()) return;
      navigationRef.navigate('PaymentScreen', {
        cycleUid: item.currentCycleUid,
        tontineUid: item.uid,
        tontineName: item.name,
        baseAmount: ctx.amount,
        penaltyAmount: ctx.penaltyAmount,
        penaltyDays:
          ui.uiStatus === 'OVERDUE'
            ? Math.max(0, Math.round(ui.daysOverdue ?? 0))
            : undefined,
        cycleNumber: item.currentCycle ?? item.currentCycleNumber ?? 0,
      });
    },
    [navigateToTontine]
  );

  const handleSharePress = useCallback(async (item: TontineListItem) => {
    try {
      const linkData = await getInviteLink(item.uid);
      const url = linkData.inviteUrl ?? '';
      await Share.share({
        message: `Rejoignez ma tontine "${item.name}" sur Kelemba !\n${url}`,
      });
    } catch (error: unknown) {
      const apiError = parseApiError(error);
      Alert.alert(
        t('common.error', 'Erreur'),
        getErrorMessageForCode(apiError, i18n.language === 'sango' ? 'sango' : 'fr')
      );
    }
  }, [i18n.language, t]);

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
        "Refuser l'invitation ?",
        'Vous ne pourrez pas rejoindre cette tontine sans nouvelle invitation.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Refuser',
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

  const handleCreatePress = useCallback(() => {
    (navigation as { navigate: (screen: string) => void }).navigate(
      'TontineTypeSelectionScreen'
    );
  }, [navigation]);

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

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        userUid != null
          ? queryClient.refetchQueries({ queryKey: ['tontines', userUid] })
          : Promise.resolve(),
        userUid != null
          ? queryClient.refetchQueries({ queryKey: ['invitationsReceived', userUid] })
          : Promise.resolve(),
      ]);
      if (accountType === 'ORGANISATEUR') {
        await refetchPending();
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [accountType, queryClient, refetchPending, userUid]);

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

  const renderRow = useCallback(
    ({ item }: { item: TontineListItem }) => {
      if (activeChip === 'pending' || isMembershipPending(item)) {
        return (
          <InvitationCard
            item={item}
            onAccept={() => handleInvitationAccept(item)}
            onDecline={() => handleInvitationReject(item)}
          />
        );
      }
      return (
        <TontineFullCard
          item={item}
          onPress={() => navigateToTontine(item, 'dashboard')}
          onActionPayment={() => handlePaymentPress(item)}
          onActionRotation={() => navigateToTontine(item, 'rotation')}
          onActionMembers={() => navigateToTontine(item, 'members')}
          onActionShare={() => void handleSharePress(item)}
          onActionReport={() => navigateToTontine(item, 'payments')}
          onActionActivate={() => handleActivatePress(item)}
          onActionPayoutTrigger={() => handlePayoutTriggerPress(item)}
          onActionLaunchRotation={() => handleLaunchRotationPress(item)}
          onActionFinalReport={() => navigateToTontineFinalReport(item)}
          onActionCertificate={() => handleCertificateDownload(item)}
        />
      );
    },
    [
      activeChip,
      handleInvitationAccept,
      handleInvitationReject,
      handleActivatePress,
      handleCertificateDownload,
      handleLaunchRotationPress,
      handlePaymentPress,
      handlePayoutTriggerPress,
      handleSharePress,
      navigateToTontine,
      navigateToTontineFinalReport,
    ]
  );

  const listHeaderTop = useMemo(
    () => (
      <>
        <View style={[styles.headerGreen, { paddingTop: headerPaddingTop }]}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Mes tontines</Text>
            <View style={styles.headerActions}>
              <Pressable
                onPress={openSortMenu}
                style={styles.headerIconBtn}
                accessibilityRole="button"
                accessibilityLabel="Trier la liste"
              >
                <IconLines color="#FFFFFF" />
              </Pressable>
              <Pressable
                onPress={handleCreatePress}
                style={styles.headerIconBtn}
                accessibilityRole="button"
                accessibilityLabel="Créer une nouvelle tontine"
              >
                <IconPlus color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </View>

        {isLoading && tontines.length === 0 ? (
          <View style={styles.summarySkeleton} />
        ) : (
          <TontineSummaryStrip
            activeCount={summaryProps.activeCount}
            totalEngagedThisMonth={summaryProps.totalEngagedThisMonth}
            nextBeneficiaryCycleLabel={summaryProps.nextBeneficiaryCycleLabel}
          />
        )}

        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <View style={styles.searchIconAbs} pointerEvents="none">
              <IconSearch color={COLORS.gray500} />
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher une tontine…"
              placeholderTextColor={COLORS.gray500}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {searchQuery.length > 0 ? (
              <Pressable
                onPress={() => setSearchQuery('')}
                style={styles.searchClear}
                accessibilityRole="button"
                accessibilityLabel="Effacer la recherche"
              >
                <Text style={styles.searchClearText}>×</Text>
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={openSortMenu}
            style={styles.filterSquareBtn}
            accessibilityRole="button"
            accessibilityLabel="Trier ou filtrer"
          >
            <IconFunnel color={COLORS.gray700} />
          </Pressable>
        </View>

        <View style={styles.chipScrollOuter}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipScrollContent}
          >
            {CHIP_DEFS.filter(
              (c) => c.id === 'all' || c.id === 'completed' || counts[c.id] > 0
            ).map((c) => {
              const selected = activeChip === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setActiveChip(c.id)}
                  style={[styles.chip, selected && styles.chipSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                    {c.label} ({counts[c.id]})
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <Pressable
          style={styles.joinBanner}
          onPress={() => setShowJoinModal(true)}
          accessibilityRole="button"
        >
          <Ionicons name="enter-outline" size={18} color={COLORS.primary} />
          <Text style={styles.joinBannerText}>
            {t('tontineList.joinCta', 'Rejoindre une tontine')}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
        </Pressable>

        {overduePick != null ? (
          <OverdueBanner
            tontineName={overduePick.tontineName}
            daysLate={overduePick.daysLate}
            onPayPress={() => {
              if (!navigationRef.isReady()) return;
              const row = tontines.find((x) => x.uid === overduePick.tontineUid);
              navigationRef.navigate('TontineDetails', {
                tontineUid: overduePick.tontineUid,
                isCreator: row?.isCreator === true || row?.membershipRole === 'CREATOR',
              });
            }}
          />
        ) : null}

        {invitations.length > 0 && activeChip === 'all' ? (
          <View style={styles.invitationsBlock}>
            <View style={styles.invitationsHeader}>
              <View style={styles.invitationsDot} />
              <Text style={styles.invitationsTitle}>
                {invitations.length} invitation(s) en attente
              </Text>
            </View>
            {invitations.map((inv) => (
              <InvitationCard
                key={inv.uid}
                item={inv}
                onAccept={() => handleInvitationAccept(inv)}
                onDecline={() => handleInvitationReject(inv)}
              />
            ))}
          </View>
        ) : null}

        {accountType === 'ORGANISATEUR' && pendingRequestsByTontine.length > 0 ? (
          <View style={styles.pendingOrganizerBlock}>
            <Text style={styles.sectionListHeaderTitle}>
              {t('tontineList.pendingRequests', "Demandes d'adhésion reçues")}
            </Text>
            {pendingRequestsByTontine.map((group) => (
              <View key={group.tontineUid} style={styles.pendingGroup}>
                <Text style={styles.pendingGroupTitle}>{group.tontineName}</Text>
                {group.requests.map((request) =>
                  renderPendingRequestCard(request, group.tontineUid)
                )}
              </View>
            ))}
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
      </>
    ),
    [
      accountType,
      activeChip,
      counts,
      dataUpdatedAt,
      handleCreatePress,
      handleInvitationAccept,
      handleInvitationReject,
      headerPaddingTop,
      invitations,
      isError,
      isLoading,
      openSortMenu,
      overduePick,
      pendingRequestCount,
      pendingRequestsByTontine,
      renderPendingRequestCard,
      searchQuery,
      summaryProps,
      t,
      tontines,
    ]
  );

  const refreshCtl = (
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={onRefresh}
      tintColor={COLORS.primary}
      colors={[COLORS.primary]}
    />
  );

  const listEmpty =
    !isLoading && filteredItems.length === 0 ? (
      <TontineEmptyState filter={activeChip} onCreatePress={handleCreatePress} />
    ) : null;

  const listFooter = <View style={{ height: 80 }} />;

  if (isError && tontines.length === 0 && invitations.length === 0) {
    return (
      <SafeAreaView style={styles.screenRoot} edges={['top']}>
        <View style={[styles.headerGreen, { paddingTop: headerPaddingTop }]}>
          <Text style={styles.headerTitle}>Mes tontines</Text>
        </View>
        <View style={styles.errorCenter}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.gray500} />
          <Text style={styles.errorCenterTitle}>Erreur de chargement</Text>
          <Pressable style={styles.emptyButton} onPress={() => void refetch()}>
            <Text style={styles.emptyButtonText}>{t('common.retry', 'Réessayer')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading && tontines.length === 0) {
    return (
      <SafeAreaView style={styles.screenRoot} edges={['top']}>
        <ScrollView
          style={styles.loadingScroll}
          refreshControl={refreshCtl}
        >
          {listHeaderTop}
          <View style={styles.listBodyPad}>
            <TontineCardSkeletonList />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screenRoot} edges={['top']}>
      <View style={styles.listWrapper}>
      {useSectionMode && sections.length > 0 ? (
        <SectionList
          style={styles.listFlex}
          sections={sections.map((s) => ({
            title: SECTION_LABELS[s.key],
            data: s.data,
          }))}
          keyExtractor={(item) => item.uid}
          renderItem={renderRow}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionListHeader}>
              <Text style={styles.sectionListHeaderTitle}>{section.title}</Text>
              <Text style={styles.sectionListHeaderCount}>
                {section.data.length} tontine(s)
              </Text>
            </View>
          )}
          ListHeaderComponent={listHeaderTop}
          ListFooterComponent={listFooter}
          ListEmptyComponent={listEmpty}
          contentContainerStyle={styles.listContentGrow}
          stickySectionHeadersEnabled={false}
          refreshControl={refreshCtl}
        />
      ) : (
        <FlatList
          style={styles.listFlex}
          data={filteredItems}
          keyExtractor={(item) => item.uid}
          renderItem={renderRow}
          ListHeaderComponent={listHeaderTop}
          ListFooterComponent={listFooter}
          ListEmptyComponent={listEmpty}
          contentContainerStyle={styles.listContentGrow}
          refreshControl={refreshCtl}
        />
      )}
      </View>

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
  screenRoot: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingScroll: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  listWrapper: {
    flex: 1,
  },
  listFlex: {
    flex: 1,
  },
  headerGreen: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: COLORS.white,
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summarySkeleton: {
    height: 52,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.gray200,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#F3F4F6',
  },
  searchInputWrap: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  searchIconAbs: {
    position: 'absolute',
    left: 10,
    zIndex: 1,
    top: '50%',
    marginTop: -7,
  },
  searchInput: {
    height: 36,
    backgroundColor: COLORS.white,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    borderRadius: 10,
    paddingLeft: 34,
    paddingRight: 36,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  searchClear: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  searchClearText: { fontSize: 18, color: COLORS.gray500 },
  filterSquareBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipScrollOuter: {
    height: 32,
    marginTop: 12,
    backgroundColor: '#F3F4F6',
  },
  chipScrollContent: {
    paddingHorizontal: 16,
    gap: 6,
    alignItems: 'center',
  },
  chip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.gray700,
  },
  chipLabelSelected: { color: COLORS.white },
  joinBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#F0F9F4',
    borderWidth: 1,
    borderColor: '#C6E6D4',
  },
  joinBannerText: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.primary },
  invitationsBlock: {
    marginTop: 10,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  invitationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  invitationsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D85A30',
  },
  invitationsTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#993C1D',
  },
  pendingOrganizerBlock: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: '#F3F4F6',
  },
  sectionListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    backgroundColor: '#F3F4F6',
  },
  sectionListHeaderTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.gray500,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  sectionListHeaderCount: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.primary,
  },
  listBodyPad: {
    paddingHorizontal: 0,
    backgroundColor: '#F3F4F6',
    paddingBottom: 80,
  },
  listContentGrow: {
    flexGrow: 1,
    backgroundColor: '#F3F4F6',
    paddingBottom: 80,
  },
  errorBanner: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
  },
  errorBannerText: { flex: 1, fontSize: 13, lineHeight: 18, color: '#92400E' },
  errorCenter: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  errorCenterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  pendingGroup: { marginBottom: 18 },
  pendingGroupTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 2,
  },
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
  emptyButton: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#1A6B3C',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyButtonText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
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
