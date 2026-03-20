import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  Alert,
  Animated,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '@/navigation/types';
import type { RootState } from '@/store/store';
import { selectAccountType } from '@/store/authSlice';
import { useTontines } from '@/hooks/useTontines';
import {
  getTontines,
  rejectInvitation,
  approveMember,
  rejectMemberByOrganizer,
  getTontinePreview,
} from '@/api/tontinesApi';
import type { TontinePreview } from '@/api/types/api.types';
import { parseApiError, getErrorMessageForCode } from '@/api/errors';
import { ApiErrorCode } from '@/api/errors/errorCodes';
import { logger } from '@/utils/logger';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { TontineCard } from '@/components/tontines/TontineCard';
import {
  ORIGIN_JOIN_REQUEST,
  type TontineListItem,
  type TontineFrequency,
  type PendingMemberRequest,
  type PendingRequestsByTontine,
} from '@/types/tontine';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { ENDPOINTS } from '@/api/endpoints';
import { InvitationInput } from '@/components/auth/InvitationInput';
import { formatPhoneSafe } from '@/utils/formatters';
import { isMembershipPending, mergeDisplayableTontines } from '@/utils/tontineMerge';
import { spacing } from '@/theme/spacing';

const TAB_BAR_HEIGHT = 64;
const FAB_MARGIN_ABOVE_TAB = 12;

type Props = BottomTabScreenProps<MainTabParamList, 'Tontines'>;

type TabId = 'mine' | 'invitations';
type FilterId = 'all' | 'draft' | 'active' | 'paused' | 'completed';
type TypeFilterId = 'ALL' | 'ROTATIVE' | 'EPARGNE';

const FREQ_KEYS: Record<TontineFrequency, string> = {
  DAILY: 'createTontine.freqDAILY',
  WEEKLY: 'createTontine.freqWEEKLY',
  BIWEEKLY: 'createTontine.freqBIWEEKLY',
  MONTHLY: 'createTontine.freqMONTHLY',
};

function formatFcfa(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} FCFA`;
}

function sortTontines(items: TontineListItem[]): TontineListItem[] {
  return [...items].sort((a, b) => {
    const aDate = a.nextPaymentDate;
    const bDate = b.nextPaymentDate;
    if (!aDate && !bDate) return a.name.localeCompare(b.name);
    if (!aDate) return 1;
    if (!bDate) return -1;
    return aDate.localeCompare(bDate);
  });
}

function PaymentDueBadge() {
  const { t } = useTranslation();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [opacity]);

  return (
    <Animated.View style={[styles.paymentDueBadge, { opacity }]}>
      <Text style={styles.paymentDueText}>{t('tontineList.paymentDue', 'Paiement dû')}</Text>
    </Animated.View>
  );
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

  useEffect(() => {
    const tab = (route.params as { initialTab?: TabId } | undefined)?.initialTab;
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(route.params as { initialTab?: TabId } | undefined)?.initialTab]);

  useEffect(() => {
    const openJoin = (route.params as { openJoinModal?: boolean } | undefined)?.openJoinModal;
    if (openJoin) {
      setShowJoinModal(true);
      navigation.setParams({ openJoinModal: false });
    }
  }, [(route.params as { openJoinModal?: boolean } | undefined)?.openJoinModal, navigation]);

  const [filter, setFilter] = useState<FilterId>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilterId>('ALL');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinLink, setJoinLink] = useState('');
  const [joinPreview, setJoinPreview] = useState<TontinePreview | null>(null);
  const [joinPreviewLoading, setJoinPreviewLoading] = useState(false);
  const [joinPreviewError, setJoinPreviewError] = useState<string | null>(null);

  const {
    tontines,
    invitations,
    isLoading,
    isFetching,
    isError,
    dataUpdatedAt,
    refetch,
  } = useTontines();

  // ── Demandes d'adhésion en attente (organisateur uniquement) ──
  const organizerTontines = useMemo(
    () => tontines.filter((t) => t.membershipRole === 'CREATOR' || t.isCreator),
    [tontines]
  );

  const { data: pendingRequestsByTontine = [], refetch: refetchPending } =
    useQuery<PendingRequestsByTontine[]>({
      queryKey: ['pendingMemberRequests', organizerTontines.map((t) => t.uid)],
      queryFn: async () => {
        const results = await Promise.all(
          organizerTontines.map(async (t) => {
            const ep = ENDPOINTS.TONTINES.PENDING_MEMBER_REQUESTS(t.uid);
            const res = await apiClient.get<PendingMemberRequest[]>(ep.url);
            return {
              tontineUid: t.uid,
              tontineName: t.name,
              requests: Array.isArray(res.data) ? res.data : [],
            };
          })
        );
        return results.filter((r) => r.requests.length > 0);
      },
      enabled: accountType === 'ORGANISATEUR' && organizerTontines.length > 0,
      staleTime: 30_000,
      networkMode: 'offlineFirst',
    });

  const mergedTontinesForDisplay = useMemo(
    () => mergeDisplayableTontines(tontines, invitations),
    [tontines, invitations]
  );

  const filteredTontines = useMemo(() => {
    let list = [...mergedTontinesForDisplay];
    if (typeFilter !== 'ALL') {
      list = list.filter((t) => (t.type ?? 'ROTATIVE') === typeFilter);
    }
    if (filter === 'draft') list = list.filter((t) => t.status === 'DRAFT');
    else if (filter === 'active') list = list.filter((t) => t.status === 'ACTIVE');
    else if (filter === 'paused')
      list = list.filter((t) => ['ACTIVE', 'PAUSED'].includes(t.status));
    else if (filter === 'completed')
      list = list.filter((t) => t.status === 'COMPLETED' || t.status === 'CANCELLED');
    return sortTontines(list);
  }, [mergedTontinesForDisplay, filter, typeFilter]);

  const handleReject = useCallback(
    (item: TontineListItem) => {
      Alert.alert(
        t('tontineList.rejectConfirmTitle', 'Refuser l\'invitation'),
        t('tontineList.rejectConfirmMessage', 'Êtes-vous sûr de vouloir refuser cette invitation ?'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('tontineList.reject', 'Refuser'),
            style: 'destructive',
            onPress: async () => {
              try {
                await rejectInvitation(item.uid);
                queryClient.invalidateQueries({ queryKey: ['tontines'] });
                queryClient.invalidateQueries({ queryKey: ['invitationsReceived'] });
                refetch();
              } catch (err: unknown) {
                const apiErr = parseApiError(err);
                const msg = getErrorMessageForCode(apiErr, i18n.language === 'sango' ? 'sango' : 'fr');
                Alert.alert(t('common.error'), msg);
              }
            },
          },
        ]
      );
    },
    [queryClient, refetch, t]
  );

  const handleJoinLinkChange = useCallback(async (value: string) => {
    setJoinLink(value);
    setJoinPreviewError(null);
    setJoinPreview(null);

    const uid = value.trim().split('/').pop() ?? '';
    if (uid.length < 32) return;

    setJoinPreviewLoading(true);
    try {
      const data = await getTontinePreview(uid);
      setJoinPreview(data);
    } catch (err: unknown) {
      const apiErr = parseApiError(err);
      if (apiErr.httpStatus === 404) {
        setJoinPreviewError('Tontine introuvable. Vérifiez le lien.');
      } else {
        setJoinPreviewError('Impossible de charger la tontine.');
      }
    } finally {
      setJoinPreviewLoading(false);
    }
  }, []);

  const handleJoinQrScanned = useCallback(async (uid: string) => {
    setJoinLink(uid);
    setJoinPreviewError(null);
    setJoinPreview(null);
    setJoinPreviewLoading(true);
    try {
      const data = await getTontinePreview(uid);
      setJoinPreview(data);
    } catch (err: unknown) {
      const apiErr = parseApiError(err);
      if (apiErr.httpStatus === 404) {
        setJoinPreviewError('Tontine introuvable. Vérifiez le QR Code.');
      } else {
        setJoinPreviewError('Impossible de charger la tontine.');
      }
    } finally {
      setJoinPreviewLoading(false);
    }
  }, []);

  const handleCreatePress = useCallback(() => {
    (navigation as { navigate: (n: string) => void }).navigate('TontineTypeSelectionScreen');
  }, [navigation]);

  const handleInvitePress = useCallback(
    (tontineUid: string, tontineName: string) => {
      (navigation as { navigate: (n: string, p: object) => void }).navigate('InviteMembers', {
        tontineUid,
        tontineName,
      });
    },
    [navigation]
  );

  const handleTontinePress = useCallback(
    (item: TontineListItem) => {
      if (isMembershipPending(item)) return;
      const nav = navigation as { navigate: (n: string, p: object) => void };
      if (item.type === 'EPARGNE') {
        nav.navigate('SavingsDetailScreen', { tontineUid: item.uid });
      } else {
        nav.navigate('TontineDetails', {
          tontineUid: item.uid,
          isCreator: item.isCreator ?? (item.membershipRole === 'CREATOR') ?? false,
        });
      }
    },
    [navigation]
  );

  const renderTontineCard = useCallback(
    ({ item }: { item: TontineListItem }) => (
      <TontineCard
        item={item}
        onPress={handleTontinePress}
        onInvitePress={handleInvitePress}
        PaymentDueBadge={PaymentDueBadge}
      />
    ),
    [handleTontinePress, handleInvitePress]
  );

  const renderInvitationCard = useCallback(
    ({ item }: { item: TontineListItem }) => {
      const freqLabel = t(FREQ_KEYS[item.frequency ?? 'MONTHLY']);
      const isJoinRequest = item.invitationOrigin === ORIGIN_JOIN_REQUEST;
      const isInvite = !isJoinRequest;

      return (
        <View style={[styles.invCard, isJoinRequest && styles.invCardPending]}>
          <View
            style={[
              styles.invitationBadgeRow,
              isJoinRequest ? styles.invitationBadgePending : styles.invitationBadgeReceived,
            ]}
          >
            <Ionicons
              name={isJoinRequest ? 'time-outline' : 'mail-open-outline'}
              size={13}
              color={isJoinRequest ? '#F5A623' : '#1A6B3C'}
            />
            <Text
              style={[
                styles.invitationBadgeText,
                isJoinRequest ? styles.invitationBadgeTextPending : styles.invitationBadgeTextReceived,
              ]}
            >
              {isJoinRequest
                ? t('tontineList.joinRequestLabel', 'Demande d\'adhésion')
                : t('tontineList.invitationReceived', 'Invitation reçue')}
            </Text>
          </View>
          <Text style={styles.invCardSub}>
            {isJoinRequest
              ? t('tontineList.joinRequestSub', 'En attente de validation organisateur.')
              : t('tontineList.invitationReceivedSub', 'Acceptez cette invitation pour rejoindre automatiquement la tontine.')}
          </Text>
          <Text style={styles.invCardName}>{item.name}</Text>
          <Text style={styles.invCardAmount}>
            {formatFcfa(item.amountPerShare)} — {freqLabel}
          </Text>
          <Text style={styles.invCardCycles}>
            {item.totalCycles} {t('tontineList.cycles', 'cycles')}
          </Text>
          {isInvite && (
            <View style={styles.invCardActions}>
              <Pressable
                style={styles.invRejectBtn}
                onPress={() => handleReject(item)}
                accessibilityRole="button"
              >
                <Text style={styles.invRejectText}>{t('tontineList.reject', 'Refuser')}</Text>
              </Pressable>
              <Pressable
                style={styles.invAcceptBtn}
                onPress={() => {
                  (navigation as { navigate: (n: string, p: object) => void }).navigate(
                    'TontineContractSignature',
                    { mode: 'INVITE_ACCEPT', tontineUid: item.uid, tontineName: item.name }
                  );
                }}
                accessibilityRole="button"
              >
                <Text style={styles.invAcceptText}>{t('tontineList.accept', 'Accepter')}</Text>
              </Pressable>
            </View>
          )}
        </View>
      );
    },
    [handleReject, navigation, t]
  );

  const renderPendingRequestCard = useCallback(
    (req: PendingMemberRequest, tontineUid: string) => (
      <View key={req.uid} style={styles.invCard}>
        <View style={styles.pendingRequestHeader}>
          <Ionicons name="person-add-outline" size={16} color="#F5A623" />
          <Text style={styles.pendingRequestLabel}>
            {t('tontineList.joinRequestLabel', 'Demande d\'adhésion')}
          </Text>
        </View>
        <Text style={styles.invCardSub}>
          {t('tontineList.joinRequestSub', 'En attente de validation organisateur.')}
        </Text>
        <Text style={styles.invCardName}>{req.user.fullName}</Text>
        <Text style={styles.invCardAmount}>
          {formatPhoneSafe(
            (req.user as { phone?: string; phoneMasked?: string }).phoneMasked ??
              req.user.phone
          )}
        </Text>
        <Text style={styles.scoreLine}>
          Score Kelemba : {req.user.kelembScore}
        </Text>
        <View style={styles.invCardActions}>
          <Pressable
            style={styles.invRejectBtn}
            onPress={() =>
              Alert.alert(
                t('tontineList.rejectRequestTitle', 'Refuser la demande'),
                t('tontineList.rejectRequestMessage', 'Êtes-vous sûr de vouloir refuser cette demande d\'adhésion ?'),
                [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('tontineList.reject', 'Refuser'),
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await rejectMemberByOrganizer(tontineUid, req.uid);
                        queryClient.invalidateQueries({ queryKey: ['pendingMemberRequests'] });
                        void refetchPending();
                      } catch (err: unknown) {
                        const apiErr = parseApiError(err);
                        const msg = getErrorMessageForCode(apiErr, i18n.language === 'sango' ? 'sango' : 'fr');
                        Alert.alert(t('common.error'), msg);
                      }
                    },
                  },
                ]
              )
            }
            accessibilityRole="button"
          >
            <Text style={styles.invRejectText}>{t('tontineList.reject', 'Refuser')}</Text>
          </Pressable>
          <Pressable
            style={styles.invAcceptBtn}
            onPress={async () => {
              try {
                await approveMember(tontineUid, req.uid);
                queryClient.invalidateQueries({ queryKey: ['pendingMemberRequests'] });
                queryClient.invalidateQueries({ queryKey: ['tontines'] });
                void refetchPending();
              } catch (err: unknown) {
                const apiErr = parseApiError(err);
                const msg = getErrorMessageForCode(apiErr, i18n.language === 'sango' ? 'sango' : 'fr');
                Alert.alert(t('common.error'), msg);
              }
            }}
            accessibilityRole="button"
          >
            <Text style={styles.invAcceptText}>{t('tontineList.approve', 'Approuver')}</Text>
          </Pressable>
        </View>
      </View>
    ),
    [queryClient, refetchPending, t, i18n]
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.skeletonHeader} />
        <View style={styles.skeletonList}>
          <SkeletonBlock width="100%" height={140} borderRadius={16} style={styles.skeletonCard} />
          <SkeletonBlock width="100%" height={140} borderRadius={16} style={styles.skeletonCard} />
          <SkeletonBlock width="100%" height={140} borderRadius={16} style={styles.skeletonCard} />
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
        >
          <Text style={[styles.tabText, activeTab === 'mine' && styles.tabTextActive]}>
            {t('tontineList.tabMine', 'Mes tontines')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'invitations' && styles.tabActive]}
          onPress={() => setActiveTab('invitations')}
        >
          <Text style={[styles.tabText, activeTab === 'invitations' && styles.tabTextActive]}>
            {t('tontineList.tabInvitations', 'Invitations')}
          </Text>
          {invitations.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{invitations.length}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <Pressable
        style={styles.joinBannerBtn}
        onPress={() => setShowJoinModal(true)}
        accessibilityRole="button"
      >
        <Ionicons name="enter-outline" size={18} color="#1A6B3C" />
        <Text style={styles.joinBannerText}>Rejoindre une tontine</Text>
        <Ionicons name="chevron-forward" size={16} color="#1A6B3C" />
      </Pressable>

      {activeTab === 'mine' && (
        <>
          <View style={styles.typeFilterView}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.typeFilterRow}
            >
              {(['ALL', 'ROTATIVE', 'EPARGNE'] as const).map((id) => (
                <Pressable
                  key={id}
                  style={[styles.typeFilterChip, typeFilter === id && styles.typeFilterChipActive]}
                  onPress={() => setTypeFilter(id)}
                >
                  <Text style={[styles.typeFilterText, typeFilter === id && styles.typeFilterTextActive]}>
                    {id === 'ALL' ? t('tontineList.filterAll', 'Toutes') : id === 'ROTATIVE' ? 'Rotative' : 'Épargne'}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <View style={styles.filterScrollView}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {(['all', 'draft', 'active', 'paused', 'completed'] as const).map((id) => (
            <Pressable
              key={id}
              style={[styles.filterChip, filter === id && styles.filterChipActive]}
              onPress={() => setFilter(id)}
            >
              <Text style={[styles.filterText, filter === id && styles.filterTextActive]}>
                {id === 'all'
                  ? t('tontineList.filterAll', 'Toutes')
                  : id === 'draft'
                    ? t('tontineList.filterDraft', 'Brouillons')
                    : id === 'active'
                      ? t('tontineList.filterActive', 'Actives')
                      : id === 'paused'
                        ? t('tontineList.filterPaused', 'En cours')
                        : t('tontineList.filterCompleted', 'Terminées')}
              </Text>
            </Pressable>
          ))}
            </ScrollView>
          </View>
        </>
      )}

      {isError && (tontines.length > 0 || invitations.length > 0) && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>
            {t('tontineList.offlineMessage', 'Données hors ligne — dernière mise à jour : {{date}}', {
              date: new Date(dataUpdatedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            })}
          </Text>
        </View>
      )}

      <FlatList
        data={activeTab === 'mine' ? filteredTontines : invitations}
        keyExtractor={(item) => item.uid}
        renderItem={activeTab === 'mine' ? renderTontineCard : renderInvitationCard}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          activeTab === 'invitations' &&
          accountType === 'ORGANISATEUR' &&
          pendingRequestsByTontine.length > 0 ? (
            <View style={styles.orgSection}>
              <Text style={styles.orgSectionTitle}>
                {t('tontineList.pendingRequests', "Demandes d'adhésion reçues")}
              </Text>
              {pendingRequestsByTontine.map((group) => (
                <View key={group.tontineUid}>
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupName}>{group.tontineName}</Text>
                    <View style={styles.groupCountBadge}>
                      <Text style={styles.groupCountText}>
                        {group.requests.length}
                      </Text>
                    </View>
                  </View>
                  {group.requests.map((req) =>
                    renderPendingRequestCard(req, group.tontineUid)
                  )}
                </View>
              ))}
              <View style={styles.sectionDivider} />
              <Text style={styles.orgSectionTitle}>
                {t('tontineList.myInvitations', 'Mes invitations reçues')}
              </Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            tintColor="#1A6B3C"
          />
        }
        ListEmptyComponent={
          activeTab === 'mine' ? (
            filter === 'draft' ? (
              <View style={styles.emptyState}>
                <Ionicons name="create-outline" size={64} color="#8E8E93" />
                <Text style={styles.emptyTitle}>
                  {t('tontineList.emptyDraft', 'Aucune tontine en brouillon')}
                </Text>
                {accountType === 'ORGANISATEUR' && (
                  <Text style={styles.emptySub}>
                    {t('tontineList.emptyDraftSub', 'Créez une tontine pour commencer à inviter des membres.')}
                  </Text>
                )}
                {accountType === 'ORGANISATEUR' && (
                  <Pressable style={styles.emptyButton} onPress={handleCreatePress}>
                    <Text style={styles.emptyButtonText}>
                      {t('tontineList.createTontine', 'Créer une tontine')}
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={64} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>
                  {t('tontineList.emptyMine', 'Vous n\'êtes membre d\'aucune tontine')}
                </Text>
                {accountType === 'ORGANISATEUR' && (
                  <Pressable style={styles.emptyButton} onPress={handleCreatePress}>
                    <Text style={styles.emptyButtonText}>
                      {t('tontineList.createFirst', 'Créer ma première tontine')}
                    </Text>
                  </Pressable>
                )}
              </View>
            )
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="mail-outline" size={64} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>
                {t('tontineList.emptyInvitations', 'Aucune invitation en attente')}
              </Text>
            </View>
          )
        }
      />

      {accountType === 'ORGANISATEUR' && (
        <Pressable
          style={[styles.fab, { bottom: fabBottom }]}
          onPress={handleCreatePress}
          accessibilityRole="button"
          accessibilityLabel={t('tontineList.createTontine', 'Créer une tontine')}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      )}

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
            <Text style={styles.modalTitle}>Rejoindre une Tontine</Text>
            <Pressable
              onPress={() => {
                setShowJoinModal(false);
                setJoinLink('');
                setJoinPreview(null);
                setJoinPreviewError(null);
              }}
              style={styles.modalCloseBtn}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
            >
              <Ionicons name="close" size={24} color="#1A1A2E" />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.modalSubtitle}>
              Collez un lien d'invitation ou scannez un QR Code
            </Text>

            <InvitationInput
              value={joinLink}
              onChangeText={handleJoinLinkChange}
              onScanned={handleJoinQrScanned}
              isLoading={joinPreviewLoading}
              error={joinPreviewError}
            />

            {joinPreview && !joinPreviewLoading ? (
              <View style={styles.joinPreviewCard}>
                <Text style={styles.joinPreviewName}>{joinPreview.name}</Text>
                <Text style={styles.joinPreviewDetail}>
                  {joinPreview.amountPerShare?.toLocaleString('fr-FR')} FCFA
                  {joinPreview.frequency ? ` · ${joinPreview.frequency}` : ''}
                </Text>
                {joinPreview.memberCount !== undefined && (
                  <Text style={styles.joinPreviewDetail}>
                    {joinPreview.memberCount} membre(s)
                  </Text>
                )}
                <Pressable
                  style={styles.joinConfirmBtn}
                  onPress={() => {
                    if (!joinPreview) return;
                    setShowJoinModal(false);
                    setJoinLink('');
                    setJoinPreview(null);
                    setJoinPreviewError(null);
                    (navigation as { navigate: (n: string, p: object) => void }).navigate(
                      'TontineContractSignature',
                      {
                        mode: 'JOIN_REQUEST',
                        tontineUid: joinPreview.uid,
                        tontineName: joinPreview.name,
                      }
                    );
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.joinConfirmBtnText}>
                    Envoyer ma demande d'adhésion
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
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  tabRow: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 8,
  },
  tab: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tabActive: {
    backgroundColor: '#1A6B3C',
    borderColor: '#1A6B3C',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
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
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  typeFilterView: {
    height: 44,
  },
  typeFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  typeFilterChip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F8FA',
  },
  typeFilterChipActive: {
    backgroundColor: '#1A6B3C',
  },
  typeFilterText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    color: '#666666',
  },
  typeFilterTextActive: {
    color: '#FFFFFF',
  },
  filterScrollView: {
    height: 52,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#1A6B3C',
    borderColor: '#1A6B3C',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    marginHorizontal: 20,
    borderRadius: 8,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#D0021B',
  },
  listContent: {
    padding: 20,
    paddingBottom: 100, // 64 tab height + 20 margin + 16 safe area
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cardCycle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  cardAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  cardFreq: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  paymentDueBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#D0021B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  paymentDueText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardNext: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5A623',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  invCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  invitationBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  invitationBadgeReceived: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  invitationBadgePending: {
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  invitationBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  invitationBadgeTextReceived: {
    color: '#1A6B3C',
  },
  invitationBadgeTextPending: {
    color: '#F5A623',
  },
  invCardSub: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
    lineHeight: 18,
  },
  invCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  invCardAmount: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  invCardCycles: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  invCardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  invRejectBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D0021B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  invRejectText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D0021B',
  },
  invAcceptBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#1A6B3C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  invAcceptText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  invCardPending: {
    opacity: 0.75,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  pendingBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  pendingBadgeText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  pendingRequestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  pendingRequestLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F5A623',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scoreLine: {
    fontSize: 12,
    color: '#0055A5',
    fontWeight: '600',
    marginBottom: 12,
  },
  orgSection: {
    marginBottom: 8,
  },
  orgSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  groupName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  groupCountBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  groupCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  emptyButton: {
    marginTop: 24,
    minHeight: 48,
    paddingHorizontal: 24,
    backgroundColor: '#F5A623',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
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
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  skeletonHeader: {
    height: 60,
    marginHorizontal: 20,
    marginTop: 12,
  },
  skeletonList: {
    padding: 20,
  },
  skeletonCard: {
    marginBottom: 12,
  },
  joinBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginVertical: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F0F9F4',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#C6E6D4',
    minHeight: 44,
  },
  joinBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1A6B3C',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
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
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  modalCloseBtn: {
    padding: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  modalContent: {
    padding: 20,
    gap: 16,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  joinPreviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  joinPreviewName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  joinPreviewDetail: {
    fontSize: 13,
    color: '#6B7280',
  },
  joinConfirmBtn: {
    marginTop: 12,
    backgroundColor: '#1A6B3C',
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinConfirmBtnDisabled: {
    opacity: 0.6,
  },
  joinConfirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
