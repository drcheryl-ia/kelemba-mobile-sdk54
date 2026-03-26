import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Linking,
  Share,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import type { RootState } from '@/store/store';
import { selectUserUid } from '@/store/authSlice';
import { useTontineDetails } from '@/hooks/useTontineDetails';
import { useTontineMembers } from '@/hooks/useTontineMembers';
import {
  useSwapRequests,
  useShuffleRotation,
  useDecideSwapRequest,
} from '@/hooks/useTontineRotationActions';
import { useInviteLink } from '@/hooks/useInviteLink';
import { usePaymentHistory, type PaymentFilter } from '@/hooks/usePaymentHistory';
import { useTontineRotation } from '@/hooks/useTontineRotation';
import { useNextPayment } from '@/hooks/useNextPayment';
import { useContributionHistory } from '@/hooks/useContributionHistory';
import { useTontines } from '@/hooks/useTontines';
import { withNextPaymentPenaltyWaivedForPendingCashValidation } from '@/utils/nextPaymentPenaltyWaive';
import {
  resolveCurrentCycleMemberDueDate,
  resolveDisplayPaymentDate,
  resolveTontineDueState,
  resolveTontinePaymentContext,
} from '@/utils/tontinePaymentState';
import { initializeCycles, shuffleRotation } from '@/api/tontinesApi';
import { getCycleCompletion } from '@/api/cyclePayoutApi';
import { getErrorMessageForCode } from '@/api/errors';
import { parseApiError } from '@/api/errors/errorHandler';
import { logger } from '@/utils/logger';
import { formatFcfa, maskPhone } from '@/utils/formatters';
import { getInitials, hashToColor } from '@/utils/avatarUtils';
import { resolveCurrentCycleMetrics } from '@/utils/currentCycleMetrics';
import { canShowOrganizerPayoutCta } from '@/utils/cyclePayoutEligibility';
import { resolveOrganizerPayoutNavigationData } from '@/utils/organizerPayoutNavigation';
import { allUserBeneficiaryPayoutsReceived } from '@/utils/homePayoutScheduleFromRotation';
import QRCode from 'react-native-qrcode-svg';
import { ScoreProgressBar } from '@/components/profile/ScoreProgressBar';
import { ErrorToast } from '@/components/ui/ErrorToast';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { TontineActivationPanel } from '@/components/tontines';
import {
  RotationStatsHeader,
  DelayBanner,
  RotationTimelineItem,
} from '@/components/rotation';
import type { TontineStatus, TontineMember } from '@/types/tontine';

function getMemberLabels(member: TontineMember, currentUserUid: string | null): string[] {
  const labels: string[] = [];
  if (member.memberRole === 'CREATOR') labels.push('Organisateur');
  if (currentUserUid && member.userUid === currentUserUid) labels.push('vous');
  return labels;
}

type Props = NativeStackScreenProps<RootStackParamList, 'TontineDetails'>;

type TabId = 'dashboard' | 'rotation' | 'payments' | 'members';

const KELEMBA_GREEN = '#1A6B3C';
const KELEMBA_GREEN_LIGHT = '#E8F5EE';
const BORDER_RADIUS = 16;
const BORDER_RADIUS_SM = 12;

const STATUS_COLORS: Record<TontineStatus, string> = {
  DRAFT: '#9E9E9E',
  ACTIVE: '#1A6B3C',
  BETWEEN_ROUNDS: '#F5A623',
  PAUSED: '#F5A623',
  COMPLETED: '#0055A5',
  CANCELLED: '#D0021B',
};

const STATUS_KEYS: Record<TontineStatus, string> = {
  DRAFT: 'tontineDetails.statusDraft',
  ACTIVE: 'tontineDetails.statusActive',
  BETWEEN_ROUNDS: 'tontineDetails.statusBetweenRounds',
  PAUSED: 'tontineDetails.statusPaused',
  COMPLETED: 'tontineDetails.statusCompleted',
  CANCELLED: 'tontineDetails.statusCancelled',
};

const PAYMENT_STATUS: Record<string, { icon: string; color: string }> = {
  COMPLETED: { icon: 'checkmark-circle', color: '#1A6B3C' },
  PROCESSING: { icon: 'time', color: '#F5A623' },
  PENDING: { icon: 'ellipse-outline', color: '#9E9E9E' },
  FAILED: { icon: 'close-circle', color: '#D0021B' },
  REFUNDED: { icon: 'close-circle', color: '#9E9E9E' },
};

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  // Prend uniquement la partie date (YYYY-MM-DD) pour éviter NaN sur ISO complets
  const datePart = dateStr.split('T')[0];
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return '—';
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const TontineDetailsScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const { tontineUid, isCreator: isCreatorParam } = route.params;
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const userUid = useSelector((state: RootState) => selectUserUid(state));

  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [isActivating, setIsActivating] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastSeverity, setToastSeverity] = useState<'error' | 'warning' | 'info'>('info');
  const [payoutNavBusy, setPayoutNavBusy] = useState(false);
  const payoutNavLockRef = useRef(false);
  const showToast = useCallback((msg: string, severity: 'error' | 'warning' | 'info' = 'info') => {
    setToastMessage(msg);
    setToastSeverity(severity);
    setToastVisible(true);
  }, []);

  const {
    tontine,
    currentCycle,
    isLoading: detailsLoading,
    isError: detailsError,
    refetch: refetchDetails,
  } = useTontineDetails(tontineUid);

  const { members, isLoading: membersLoading, refetch: refetchMembers } = useTontineMembers(tontineUid);

  const rotationQueryEnabled = Boolean(
    tontineUid && tontine && tontine.status !== 'DRAFT'
  );
  const {
    rotationList,
    totalAmount: rotationTotalAmount,
    memberCount: rotationMemberCount,
    currentCycleNumber: rotationCurrentCycleNumber,
    currentRotationRound,
    maxRotationRound,
    pendingReason,
    isDelayedByOthers,
    isLoading: rotationLoading,
    isError: rotationError,
    refetch: refetchRotation,
  } = useTontineRotation(tontineUid, { enabled: rotationQueryEnabled });

  const nextRotationTourNumber = rotationCurrentCycleNumber + 1;
  const showRotationRoundBadge = maxRotationRound > 1;
  const { data: swapRequests = [] } = useSwapRequests(tontineUid);
  const shuffleMutation = useShuffleRotation(tontineUid);
  const decideSwapMutation = useDecideSwapRequest(tontineUid);

  const isDraft = tontine?.status === 'DRAFT';
  /** Après activation / démarrage : plus d’invitation depuis l’onglet Membres. */
  const inviteMembersDisabled =
    tontine != null && tontine.status !== 'DRAFT';
  const isCreator: boolean =
    isCreatorParam ??
    tontine?.isCreator ??
    (userUid != null &&
      members.some((m) => m.memberRole === 'CREATOR' && m.userUid === userUid)) ??
    false;

  const { data: inviteLinkData, isLoading: inviteLinkLoading } = useInviteLink(tontineUid, {
    enabled: isDraft && isCreator,
  });
  const { nextPayment } = useNextPayment();
  const { items: cashHistoryForWaive } = useContributionHistory(undefined, {
    methodFilter: 'CASH',
    sortField: 'date',
    sortOrder: 'desc',
  });
  const nextPaymentForUi = useMemo(
    () =>
      withNextPaymentPenaltyWaivedForPendingCashValidation(
        nextPayment,
        cashHistoryForWaive
      ),
    [nextPayment, cashHistoryForWaive]
  );
  const { tontines: myTontinesList } = useTontines();
  const listItemForTontine = useMemo(
    () => myTontinesList.find((t) => t.uid === tontineUid) ?? null,
    [myTontinesList, tontineUid]
  );

  const cycleOverviewMemberHint = useMemo(() => {
    if (!currentCycle?.expectedDate) return null;
    if (!listItemForTontine) {
      return {
        label: t(
          'tontineDetails.cycleCalendarExpected',
          'Date prévue du cycle (calendrier)'
        ),
        dateStr: currentCycle.expectedDate,
      };
    }
    const dueState = resolveTontineDueState(listItemForTontine);
    const isDebt = dueState === 'DUE' || dueState === 'PROCESSING';
    const dateStr = isDebt
      ? resolveCurrentCycleMemberDueDate(listItemForTontine) ?? currentCycle.expectedDate
      : resolveDisplayPaymentDate(listItemForTontine) ?? currentCycle.expectedDate;
    const label = isDebt
      ? t('tontineDetails.currentCycleDueLabel', 'Échéance du cycle courant')
      : t('tontineDetails.nextScheduledDueLabel', 'Prochaine échéance');
    return { label, dateStr };
  }, [currentCycle, listItemForTontine, t]);

  const memberNextPaymentLine = useMemo(() => {
    if (!listItemForTontine || !currentCycle) return null;
    const dueState = resolveTontineDueState(listItemForTontine);
    const isDebt = dueState === 'DUE' || dueState === 'PROCESSING';
    const dateStr = isDebt
      ? resolveCurrentCycleMemberDueDate(listItemForTontine) ?? currentCycle.expectedDate
      : resolveDisplayPaymentDate(listItemForTontine) ?? currentCycle.expectedDate;
    const prefix = isDebt
      ? t('tontineDetails.dueLinePrefix', 'Échéance à régler')
      : t('tontineDetails.nextDueLinePrefix', 'Prochaine échéance');
    return { prefix, dateStr };
  }, [listItemForTontine, currentCycle, t]);

  const {
    payments,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch: refetchPayments,
  } = usePaymentHistory(tontineUid, paymentFilter);

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.rotationOrder - b.rotationOrder),
    [members]
  );

  const myMember = useMemo(
    () => (userUid ? members.find((m) => m.userUid === userUid) : null),
    [members, userUid]
  );

  const myPendingSwapRequest = useMemo(
    () =>
      userUid
        ? swapRequests.find(
            (r) => r.requesterUid === userUid && r.status === 'PENDING'
          )
        : null,
    [swapRequests, userUid]
  );

  /**
   * Désactiver l’échange si l’utilisateur a perçu toutes ses cagnottes bénéficiaires
   * (1 part → 1 tour ; plusieurs parts → tous les tours bénéficiaires prévus).
   */
  const userHasReceivedBeneficiaryPayout = useMemo(
    () => allUserBeneficiaryPayoutsReceived(rotationList),
    [rotationList]
  );

  /** Membre actif (membre classique ou organisateur / créateur) — même droit à l’échange de position. */
  const canRequestRotationSwap =
    myMember != null &&
    myMember.membershipStatus === 'ACTIVE' &&
    (myMember.memberRole === 'MEMBER' || myMember.memberRole === 'CREATOR');

  const pendingSwapRequests = useMemo(
    () => swapRequests.filter((r) => r.status === 'PENDING'),
    [swapRequests]
  );

  const showCotiserFAB = useMemo(() => {
    if (tontine?.status !== 'ACTIVE') return false;
    if (!currentCycle || currentCycle.status !== 'ACTIVE') return false;
    if (!myMember) return false;
    // Masquer si cotisation déjà réglée ou en cours de traitement
    if (
      myMember.currentCyclePaymentStatus === 'COMPLETED' ||
      myMember.currentCyclePaymentStatus === 'PROCESSING'
    )
      return false;
    return true;
  }, [tontine?.status, currentCycle, myMember]);

  const totalDue = useMemo(() => {
    if (nextPaymentForUi?.tontineUid === tontineUid) return nextPaymentForUi.totalDue;
    if (listItemForTontine) {
      const ctx = resolveTontinePaymentContext(listItemForTontine);
      if (ctx.dueState === 'DUE') return ctx.totalDue;
    }
    if (myMember && tontine) return tontine.amountPerShare * myMember.sharesCount;
    return 0;
  }, [nextPaymentForUi, tontineUid, myMember, tontine, listItemForTontine]);

  const { baseAmount, penaltyAmount } = useMemo(() => {
    if (nextPaymentForUi?.tontineUid === tontineUid) {
      return {
        baseAmount: nextPaymentForUi.amountDue,
        penaltyAmount: nextPaymentForUi.penaltyAmount ?? 0,
      };
    }
    if (listItemForTontine) {
      const ctx = resolveTontinePaymentContext(listItemForTontine);
      if (ctx.dueState === 'DUE') {
        return {
          baseAmount: ctx.amount,
          penaltyAmount: ctx.penaltyAmount,
        };
      }
    }
    if (myMember && tontine) {
      const base = tontine.amountPerShare * myMember.sharesCount;
      return { baseAmount: base, penaltyAmount: 0 };
    }
    return { baseAmount: 0, penaltyAmount: 0 };
  }, [nextPaymentForUi, tontineUid, myMember, tontine, listItemForTontine]);

  const handleCotiser = useCallback(() => {
    if (!currentCycle || !tontine || totalDue <= 0) return;
    queryClient.invalidateQueries({ queryKey: ['tontine', tontineUid] });
    queryClient.invalidateQueries({ queryKey: ['cycle', 'current', tontineUid] });
    (navigation as { navigate: (name: string, params: object) => void }).navigate(
      'PaymentScreen',
      {
        cycleUid: currentCycle.uid,
        tontineUid,
        tontineName: tontine.name,
        baseAmount,
        penaltyAmount,
        cycleNumber: currentCycle.cycleNumber,
      }
    );
  }, [
    currentCycle,
    tontine,
    totalDue,
    tontineUid,
    baseAmount,
    penaltyAmount,
    navigation,
    queryClient,
  ]);

  const handleShuffleRotation = useCallback(() => {
    Alert.alert(
      t('rotation.shuffleConfirmTitle', 'Confirmer le tirage'),
      t(
        'rotation.shuffleConfirmMessage',
        "L'ordre sera attribué aléatoirement à tous les membres. Cette action est irréversible."
      ),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm', 'Confirmer'),
          style: 'default',
          onPress: () => {
            shuffleMutation.mutate(undefined, {
              onSuccess: () => {
                refetchDetails();
                refetchMembers();
                showToast(
                  t('rotation.shuffleSuccess', 'Ordre attribué par tirage au sort.'),
                  'info'
                );
              },
              onError: (err: unknown) => {
                const apiErr = parseApiError(err);
                showToast(apiErr.message, 'error');
              },
            });
          },
        },
      ]
    );
  }, [shuffleMutation, refetchDetails, refetchMembers, showToast, t]);

  const handleActivateTontine = useCallback(async () => {
    if (isActivating) return;
    Alert.alert(
      t('tontineDetails.activateTitle', 'Démarrer la tontine ?'),
      t(
        'tontineDetails.activateMessage',
        'Les cycles seront créés et la tontine passera en statut Actif. Cette action est irréversible.'
      ),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('tontineDetails.activateConfirm', 'Démarrer'),
          style: 'default',
          onPress: async () => {
            setIsActivating(true);
            try {
              if (tontine?.rules?.rotationType === 'RANDOM') {
                await shuffleRotation(tontineUid);
              }
              await initializeCycles(tontineUid);
              queryClient.invalidateQueries({ queryKey: ['tontines'] });
              queryClient.invalidateQueries({ queryKey: ['nextPayment'] });
              queryClient.invalidateQueries({ queryKey: ['tontines', 'active'] });
              queryClient.invalidateQueries({ queryKey: ['payments', 'pending'] });
              queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
              queryClient.invalidateQueries({ queryKey: ['score', 'me'] });
              queryClient.invalidateQueries({ queryKey: ['tontine', tontineUid] });
              queryClient.invalidateQueries({ queryKey: ['cycle', 'current', tontineUid] });
              queryClient.invalidateQueries({ queryKey: ['tontineRotation', tontineUid] });
              refetchDetails();
              refetchMembers();
              showToast(
                t('tontineDetails.activateSuccess', 'Tontine démarrée avec succès !'),
                'info'
              );
            } catch (err: unknown) {
              const apiErr = parseApiError(err);
              if (apiErr.httpStatus === 400) {
                showToast(
                  t(
                    'tontineDetails.activateErrorMembers',
                    'Pas assez de membres actifs pour démarrer (minimum 2).'
                  ),
                  'error'
                );
              } else if (apiErr.httpStatus === 409) {
                showToast(
                  t('tontineDetails.activateErrorAlready', 'Les cycles sont déjà initialisés.'),
                  'warning'
                );
              } else {
                showToast(
                  t('tontineDetails.activateErrorGeneric', 'Erreur lors du démarrage.'),
                  'error'
                );
              }
              logger.error('handleActivateTontine failed', { code: apiErr.code });
            } finally {
              setIsActivating(false);
            }
          },
        },
      ]
    );
  }, [isActivating, tontineUid, tontine?.rules?.rotationType, queryClient, showToast, t, refetchDetails, refetchMembers]);

  const currentCycleMetrics = useMemo(
    () =>
      resolveCurrentCycleMetrics({
        currentCycle,
        amountPerShare: tontine?.amountPerShare ?? 0,
        members,
      }),
    [currentCycle, tontine?.amountPerShare, members]
  );

  const { data: cycleCompletion } = useQuery({
    queryKey: ['cycle', 'completion', currentCycle?.uid],
    queryFn: () => getCycleCompletion(currentCycle!.uid),
    enabled: Boolean(
      currentCycle?.uid &&
        isCreator &&
        tontine?.status === 'ACTIVE' &&
        currentCycle?.status === 'ACTIVE'
    ),
    staleTime: 30_000,
  });

  const showOrganizerPayoutCta = useMemo(
    () => canShowOrganizerPayoutCta(isCreator, currentCycle, cycleCompletion),
    [isCreator, currentCycle, cycleCompletion]
  );

  const canNavigatePayout = showOrganizerPayoutCta && currentCycle != null;

  const handleOrganizerPayoutToCycle = useCallback(async () => {
    if (!currentCycle || !tontine || payoutNavLockRef.current) return;
    payoutNavLockRef.current = true;
    setPayoutNavBusy(true);
    try {
      const result = await resolveOrganizerPayoutNavigationData(currentCycle.uid, {
        kind: 'detail',
        tontineUid,
        tontineName: tontine.name,
        currentCycle: {
          uid: currentCycle.uid,
          cycleNumber: currentCycle.cycleNumber,
          beneficiaryMembershipUid: currentCycle.beneficiaryMembershipUid,
        },
        members,
      });
      if (!result.ok) {
        if (result.reason === 'not_payable') {
          Alert.alert(
            t('tontineList.payoutUnavailableTitle', 'Versement indisponible'),
            t(
              'tontineList.payoutUnavailableMessage',
              "Le versement n'est pas possible pour l'instant. Consultez le détail de la tontine pour l'état du cycle."
            )
          );
        } else {
          showToast(
            t(
              'tontineList.payoutUnavailableMessage',
              "Le versement n'est pas possible pour l'instant. Consultez le détail de la tontine pour l'état du cycle."
            ),
            'warning'
          );
        }
        return;
      }
      navigation.navigate('CyclePayoutScreen', result.payload);
    } catch (error: unknown) {
      const apiError = parseApiError(error);
      Alert.alert(
        t('common.error', 'Erreur'),
        getErrorMessageForCode(apiError, i18n.language === 'sango' ? 'sango' : 'fr')
      );
    } finally {
      payoutNavLockRef.current = false;
      setPayoutNavBusy(false);
    }
  }, [
    currentCycle,
    tontine,
    tontineUid,
    members,
    navigation,
    t,
    i18n.language,
    showToast,
  ]);

  const delayedByMemberIds = currentCycle?.delayedByMemberIds ?? [];

  const refetch = useCallback(() => {
    refetchDetails();
    refetchMembers();
    refetchPayments();
    if (rotationQueryEnabled) {
      void refetchRotation();
    }
  }, [
    refetchDetails,
    refetchMembers,
    refetchPayments,
    refetchRotation,
    rotationQueryEnabled,
  ]);

  // Recharger la rotation à chaque retour sur cet écran
  // pour afficher les tours immédiatement après activation.
  useFocusEffect(
    useCallback(() => {
      if (
        tontine?.status === 'ACTIVE' ||
        tontine?.status === 'BETWEEN_ROUNDS'
      ) {
        queryClient.invalidateQueries({ queryKey: ['tontineRotation', tontineUid] });
        queryClient.invalidateQueries({ queryKey: ['tontine', tontineUid] });
        queryClient.invalidateQueries({ queryKey: ['cycle', 'current', tontineUid] });
        queryClient.invalidateQueries({ queryKey: ['members', tontineUid] });
      }
    }, [tontine?.status, tontineUid, queryClient])
  );

  if (detailsLoading || (tontine == null && !detailsError)) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.skeletonHeader} />
        <View style={styles.skeletonContent}>
          <SkeletonBlock width="100%" height={120} borderRadius={16} style={styles.skeletonBlock} />
          <SkeletonBlock width="100%" height={80} borderRadius={16} style={styles.skeletonBlock} />
        </View>
      </SafeAreaView>
    );
  }

  if (detailsError || !tontine) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backText}>{t('common.back')}</Text>
          </Pressable>
        </View>
        <View style={styles.errorState}>
          <Text style={styles.errorText}>{t('register.errorNetwork')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor = STATUS_COLORS[tontine.status];
  const statusLabel = t(STATUS_KEYS[tontine.status]);

  const headerSubtitle =
    tontine.status === 'DRAFT'
      ? `${members.length} ${t('tontineDetails.membersLabel', 'membres')} · ${formatFcfa(tontine.amountPerShare)}/part`
      : `${members.length} ${t('tontineDetails.membersLabel', 'membres')} · ${statusLabel}`;

  const showActivationPanel =
    (tontine.status === 'DRAFT' || tontine.status === 'BETWEEN_ROUNDS') &&
    isCreator;

  // DRAFT / BETWEEN_ROUNDS + organisateur : panneau d'activation (pas les onglets)
  if (showActivationPanel) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.headerBackButton}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="arrow-back" size={24} color={KELEMBA_GREEN} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={2}>
              {tontine.name}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {headerSubtitle}
            </Text>
          </View>
          <Pressable
            style={styles.settingsButton}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Paramètres"
            onPress={() => showToast('Paramètres à venir', 'info')}
          >
            <Ionicons name="settings-outline" size={24} color="#6B7280" />
          </Pressable>
        </View>
        <TontineActivationPanel
          tontine={tontine}
          tontineUid={tontineUid}
          members={members}
          membersLoading={membersLoading}
          navigation={navigation}
          onSuccess={() => {
            refetchDetails();
            refetchMembers();
          }}
          showToast={showToast}
          activationPhase={
            tontine.status === 'BETWEEN_ROUNDS' ? 'BETWEEN_ROUNDS' : 'DRAFT'
          }
        />
        <ErrorToast
          message={toastMessage}
          visible={toastVisible}
          severity={toastSeverity}
          onHide={() => setToastVisible(false)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.headerBackButton}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="arrow-back" size={24} color={KELEMBA_GREEN} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={2}>
            {tontine.name}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {headerSubtitle}
          </Text>
        </View>
        <Pressable
          style={styles.settingsButton}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Paramètres"
          onPress={() => showToast('Paramètres à venir', 'info')}
        >
          <Ionicons name="settings-outline" size={24} color="#6B7280" />
        </Pressable>
      </View>

      <View style={styles.tabScrollView}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
        >
          {(['dashboard', 'rotation', 'payments', 'members'] as const).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {t(`tontineDetails.tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`)}
            </Text>
            {activeTab === tab && <View style={styles.tabUnderline} />}
          </Pressable>
        ))}
        </ScrollView>
      </View>

      {activeTab === 'dashboard' && (
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentInner}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={refetch}
              tintColor="#1A6B3C"
            />
          }
        >
          {currentCycle?.status === 'ACTIVE' ? (
            <>
              <View style={styles.cycleOverviewCard}>
                <View style={styles.cycleOverviewHeader}>
                  <Text style={styles.cycleOverviewTitle}>
                    {t('tontineDetails.cycleOverviewTitle', 'Cycle de Tontine')}
                  </Text>
                  <View style={[styles.cycleStatusBadge, { backgroundColor: statusColor }]}>
                    <Text style={styles.cycleStatusBadgeText}>{statusLabel}</Text>
                  </View>
                </View>
                <View style={styles.cycleOverviewRow}>
                  <Text style={styles.cycleOverviewLabel}>
                    {t('tontineDetails.monthLabel', 'Mois')} {currentCycle.cycleNumber} / {tontine.totalCycles}
                  </Text>
                  <Text style={styles.cycleOverviewPercent}>
                    {Math.round(currentCycleMetrics.progress * 100)}%
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[styles.progressFill, { width: `${currentCycleMetrics.progress * 100}%` }]}
                  />
                </View>
                {cycleOverviewMemberHint ? (
                  <Text style={styles.cycleOverviewHint}>
                    {cycleOverviewMemberHint.label} :{' '}
                    {formatDateLong(cycleOverviewMemberHint.dateStr)}
                  </Text>
                ) : null}
                {delayedByMemberIds.length > 0 && (
                  <View style={styles.delayedBanner}>
                    <Ionicons name="warning" size={18} color="#F5A623" />
                    <Text style={styles.delayedText}>
                      {delayedByMemberIds.length} membre(s) en retard
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.metricCardRow}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricCardLabel}>
                    {t('tontineDetails.collectedGrossLabel', 'Collecté brut')}
                  </Text>
                  <Text style={styles.metricCardValueGreen}>
                    {formatFcfa(currentCycleMetrics.collected)}
                  </Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricCardLabel}>
                    {t('tontineDetails.expectedLabel', 'Attendu')}
                  </Text>
                  <Text style={styles.metricCardValueOrange}>
                    {formatFcfa(currentCycleMetrics.expected)}
                  </Text>
                </View>
              </View>
              {currentCycleMetrics.beneficiaryNetAmount != null &&
                currentCycleMetrics.beneficiaryNetAmount > 0 && (
                  <View style={styles.metricCardRow}>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricCardLabel}>
                        {t('tontineDetails.netPayoutLabel', 'Montant à verser')}
                      </Text>
                      <Text style={styles.metricCardValueGreen}>
                        {formatFcfa(currentCycleMetrics.beneficiaryNetAmount)}
                      </Text>
                    </View>
                  </View>
                )}

              {canNavigatePayout && currentCycle && (
                <Pressable
                  style={[styles.payoutCta, payoutNavBusy && styles.payoutCtaDisabled]}
                  onPress={handleOrganizerPayoutToCycle}
                  disabled={payoutNavBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Payer la cagnotte"
                  accessibilityState={{ disabled: payoutNavBusy }}
                >
                  {payoutNavBusy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.payoutCtaText}>PAYER LA CAGNOTTE</Text>
                  )}
                </Pressable>
              )}

              {(nextPaymentForUi?.tontineUid === tontineUid ||
                totalDue > 0 ||
                (listItemForTontine != null &&
                  resolveDisplayPaymentDate(listItemForTontine) != null)) &&
                memberNextPaymentLine && (
                <View style={styles.nextPaymentCard}>
                  <Ionicons name="alarm-outline" size={20} color="#92400E" />
                  <Text style={styles.nextPaymentText}>
                    {memberNextPaymentLine.prefix}
                    {' : '}
                    <Text style={styles.nextPaymentBold}>
                      {formatDateLong(memberNextPaymentLine.dateStr)} — {formatFcfa(totalDue)}
                    </Text>
                  </Text>
                </View>
              )}

              <Text style={styles.sectionTitle}>
                {t('tontineDetails.contributionStatusTitle', 'STATUT DES COTISATIONS')}
              </Text>
              <View style={styles.membersCard}>
                {sortedMembers.map((m, index) => {
                  const isYou = userUid != null && m.userUid === userUid;
                  const isBeneficiary =
                    currentCycle.beneficiaryMembershipUid === m.uid;
                  const payStatus = m.currentCyclePaymentStatus ?? 'PENDING';
                  const isPaid = payStatus === 'COMPLETED';
                  const isLate = delayedByMemberIds.includes(m.userUid);
                  const memberDue = tontine.amountPerShare * m.sharesCount;

                  return (
                    <View
                      key={m.uid}
                      style={[
                        styles.memberRow,
                        index < sortedMembers.length - 1 && styles.memberRowBorder,
                      ]}
                    >
                      <View style={[styles.avatar, { backgroundColor: hashToColor(m.fullName) }]}>
                        <Text style={styles.avatarText}>{getInitials(m.fullName)}</Text>
                      </View>

                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>
                          {m.fullName}{isYou ? ' (Vous)' : ''}
                        </Text>
                        {isBeneficiary && (
                          <View style={styles.beneficiaryBadge}>
                            <Ionicons name="checkmark-circle" size={12} color={KELEMBA_GREEN} />
                            <Text style={styles.beneficiaryText}>
                              {t('tontineDetails.receivesPot', 'Reçoit le pot ce mois')}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.memberDueText}>
                          {formatFcfa(memberDue)}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.payStatusPill,
                          isPaid && styles.payStatusPaid,
                          isLate && styles.payStatusLate,
                          !isPaid && !isLate && styles.payStatusPending,
                        ]}
                      >
                        {isPaid ? (
                          <Ionicons name="checkmark-circle" size={18} color={KELEMBA_GREEN} />
                        ) : isLate ? (
                          <Ionicons name="warning" size={18} color="#D0021B" />
                        ) : (
                          <Ionicons name="time-outline" size={18} color="#F5A623" />
                        )}
                        <Text
                          style={[
                            styles.payStatusText,
                            isPaid && styles.payStatusTextPaid,
                            isLate && styles.payStatusTextLate,
                            !isPaid && !isLate && styles.payStatusTextPending,
                          ]}
                        >
                          {isPaid ? t('tontineDetails.paid', 'Payé') : isLate ? t('tontineDetails.late', 'En retard') : t('tontineDetails.pending', 'En attente')}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          ) : isDraft && isCreator ? (
            <View style={styles.draftPanel}>
              <View style={styles.draftBadge}>
                <Text style={styles.draftBadgeText}>
                  {t('tontineList.statusDraft', 'Brouillon')}
                </Text>
              </View>
              <Text style={styles.draftPanelTitle}>
                {t('tontineDetails.draftPanelTitle', 'Partagez votre tontine')}
              </Text>
              <Text style={styles.draftPanelSubtitle}>
                {t('tontineDetails.draftPanelSubtitle', 'Invitez vos membres pour démarrer.')}
              </Text>
              <Text style={styles.draftPanelSubtitle}>
                {t('tontineDetails.draftPanelStartDate', 'Démarrage prévu le {{date}}', {
                  date: formatDateLong(tontine.startDate),
                })}
              </Text>
              {inviteLinkLoading ? (
                <View style={styles.qrContainer}>
                  <ActivityIndicator size="large" color="#1A6B3C" />
                </View>
              ) : inviteLinkData?.inviteUrl ? (
                <>
                  <View style={styles.qrContainer}>
                    <QRCode
                      value={inviteLinkData.inviteUrl}
                      size={160}
                      color="#1A6B3C"
                      backgroundColor="#FFFFFF"
                    />
                  </View>
                  <Pressable
                    style={styles.shareButton}
                    onPress={async () => {
                      try {
                        const Clipboard = await import('expo-clipboard');
                        await Clipboard.setStringAsync(inviteLinkData.inviteUrl);
                        showToast(t('tontineDetails.copyLink', 'Lien copié'), 'info');
                      } catch {
                        Share.share({
                          message: inviteLinkData.inviteUrl,
                          title: tontine.name,
                        });
                      }
                    }}
                  >
                    <Ionicons name="copy-outline" size={20} color="#1A6B3C" />
                    <Text style={styles.shareButtonText}>
                      {t('tontineDetails.copyLink', 'Copier le lien')}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.shareButton}
                    onPress={() => {
                      const message = `Rejoignez ma tontine "${tontine.name}" sur Kelemba : ${inviteLinkData.inviteUrl}`;
                      Linking.openURL(
                        `whatsapp://send?text=${encodeURIComponent(message)}`
                      ).catch(() => Share.share({ message }));
                    }}
                  >
                    <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
                    <Text style={styles.shareButtonText}>
                      {t('tontineDetails.shareWhatsApp', 'Partager via WhatsApp')}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.shareButton}
                    onPress={() => {
                      const message = `Rejoignez ma tontine "${tontine.name}" sur Kelemba : ${inviteLinkData.inviteUrl}`;
                      Linking.openURL(`sms:?body=${encodeURIComponent(message)}`).catch(() =>
                        Share.share({ message })
                      );
                    }}
                  >
                    <Ionicons name="chatbubble-outline" size={20} color="#1A6B3C" />
                    <Text style={styles.shareButtonText}>
                      {t('tontineDetails.shareSms', 'Partager via SMS')}
                    </Text>
                  </Pressable>
                  <View style={styles.divider} />
                  <Pressable
                    style={styles.manageCta}
                    onPress={() =>
                      navigation.navigate('InviteMembers', {
                        tontineUid,
                        tontineName: tontine.name,
                      })
                    }
                  >
                    <Ionicons name="mail-outline" size={22} color="#FFFFFF" />
                    <Text style={styles.manageCtaText}>
                      {t('tontineDetails.manageInvitations', 'Gérer les invitations')}
                    </Text>
                  </Pressable>
                  {members.filter((m) => m.membershipStatus === 'ACTIVE').length >= 2 && (
                    <>
                      <View style={styles.divider} />
                      <Pressable
                        style={[styles.activateBtn, isActivating && styles.activateBtnDisabled]}
                        onPress={handleActivateTontine}
                        disabled={isActivating}
                        accessibilityRole="button"
                      >
                        {isActivating ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="play-circle-outline" size={22} color="#FFFFFF" />
                            <Text style={styles.activateBtnText}>
                              {t('tontineDetails.activateTontine', 'Démarrer la tontine')}
                            </Text>
                          </>
                        )}
                      </Pressable>
                      <Text style={styles.activateHint}>
                        {t(
                          'tontineDetails.activateHint',
                          'Les cycles seront attribués dans l\'ordre de rotation configuré.'
                        )}
                      </Text>
                    </>
                  )}
                </>
              ) : (
                <View style={styles.emptyCycle}>
                  <Text style={styles.emptyCycleText}>
                    {t('tontineDetails.notStarted')}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.emptyCycle}>
              <Text style={styles.emptyCycleText}>
                {tontine.status === 'DRAFT'
                  ? t('tontineDetails.notStarted')
                  : tontine.status === 'BETWEEN_ROUNDS'
                    ? t(
                        'tontineDetails.betweenRoundsMemberHint',
                        'En attente du lancement de la prochaine rotation par l’organisateur.'
                      )
                  : tontine.status === 'ACTIVE'
                    ? t('tontineDetails.noActiveCycle')
                    : t('tontineDetails.terminated')}
              </Text>

              {/* Bouton Démarrer — visible sur dashboard pour organisateur en DRAFT */}
              {isDraft && isCreator &&
                members.filter((m) => m.membershipStatus === 'ACTIVE').length >= 2 && (
                <Pressable
                  style={[
                    styles.startTontineBtn,
                    isActivating && styles.startTontineBtnDisabled,
                  ]}
                  onPress={handleActivateTontine}
                  disabled={isActivating}
                  accessibilityRole="button"
                >
                  {isActivating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="play-circle-outline" size={24} color="#FFFFFF" />
                      <Text style={styles.startTontineBtnText}>
                        Démarrer la tontine
                      </Text>
                    </>
                  )}
                </Pressable>
              )}

              {/* Indique à l'organisateur combien de membres manquent */}
              {isDraft && isCreator &&
                members.filter((m) => m.membershipStatus === 'ACTIVE').length < 2 && (
                <View style={styles.startTontineHint}>
                  <Ionicons name="information-circle-outline" size={18} color="#6B7280" />
                  <Text style={styles.startTontineHintText}>
                    {`Il vous faut au moins 2 membres actifs pour démarrer.\n` +
                     `Actuellement : ${members.filter((m) => m.membershipStatus === 'ACTIVE').length} membre(s).`}
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {activeTab === 'rotation' && (
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentInner}
        >
          {isDraft && isCreator && (
            <View style={styles.rotationManagementSection}>
              <Text style={styles.sectionTitle}>
                {t('rotation.managementTitle', 'Ordre de rotation')}
              </Text>
              <Pressable
                style={[styles.rotationActionBtn, shuffleMutation.isPending && styles.btnDisabled]}
                onPress={handleShuffleRotation}
                disabled={shuffleMutation.isPending}
              >
                {shuffleMutation.isPending ? (
                  <ActivityIndicator size="small" color="#1A6B3C" />
                ) : (
                  <>
                    <Ionicons name="shuffle" size={22} color="#1A6B3C" />
                    <Text style={styles.rotationActionText}>
                      {t('rotation.shuffle', 'Tirage au sort')}
                    </Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={styles.rotationActionBtn}
                onPress={() =>
                  (navigation as { navigate: (n: string, p?: object) => void }).navigate(
                    'RotationReorderScreen',
                    { tontineUid }
                  )
                }
              >
                <Ionicons name="reorder-three" size={22} color="#1A6B3C" />
                <Text style={styles.rotationActionText}>
                  {t('rotation.reorder', "Modifier l'ordre")}
                </Text>
              </Pressable>
            </View>
          )}
          {isCreator && pendingSwapRequests.length > 0 && (
            <View style={styles.swapRequestsSection}>
              <Text style={styles.sectionTitle}>
                {t('rotation.pendingSwapRequests', 'Demandes d\'échange en attente')}
              </Text>
              {pendingSwapRequests.map((req) => {
                const requesterPos = sortedMembers.find(
                  (m) => m.userUid === req.requesterUid || m.uid === req.requesterUid
                )?.rotationOrder;
                const targetPos = sortedMembers.find(
                  (m) => m.userUid === req.targetUid || m.uid === req.targetUid
                )?.rotationOrder;
                return (
                <View key={req.uid} style={styles.swapRequestCard}>
                  <Text style={styles.swapRequestText}>
                    {req.requesterName} (#{requesterPos ?? '?'}) ↔ {req.targetName} (#{targetPos ?? '?'})
                  </Text>
                  <Text style={styles.swapRequestDate}>
                    {formatDate(req.requestedAt)}
                  </Text>
                  <View style={styles.swapRequestActions}>
                    <Pressable
                      style={[styles.swapApproveBtn, decideSwapMutation.isPending && styles.btnDisabled]}
                      onPress={() => {
                        Alert.alert(
                          t('rotation.approveConfirmTitle', 'Approuver'),
                          t('rotation.approveConfirmMessage', 'Échanger les positions de ces deux membres ?'),
                          [
                            { text: t('common.cancel'), style: 'cancel' },
                            {
                              text: t('common.confirm', 'Confirmer'),
                              onPress: () =>
                                decideSwapMutation.mutate({
                                  requestUid: req.uid,
                                  payload: { decision: 'APPROVED' },
                                }),
                            },
                          ]
                        );
                      }}
                      disabled={decideSwapMutation.isPending}
                    >
                      <Text style={styles.swapApproveText}>{t('common.approve', 'Approuver')}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.swapRejectBtn, decideSwapMutation.isPending && styles.btnDisabled]}
                      onPress={() =>
                        decideSwapMutation.mutate({
                          requestUid: req.uid,
                          payload: { decision: 'REJECTED' },
                        })
                      }
                      disabled={decideSwapMutation.isPending}
                    >
                      <Text style={styles.swapRejectText}>{t('common.reject', 'Refuser')}</Text>
                    </Pressable>
                  </View>
                </View>
              );
              })}
            </View>
          )}
          {canRequestRotationSwap && tontine?.status === 'ACTIVE' && (
            <View style={styles.swapRequestMemberSection}>
              {myPendingSwapRequest ? (
                <View style={styles.pendingSwapBadge}>
                  <Ionicons name="time" size={20} color="#F5A623" />
                  <Text style={styles.pendingSwapText}>
                    {t('rotation.pendingSwapBadge', 'Demande en attente de validation')}
                  </Text>
                </View>
              ) : userHasReceivedBeneficiaryPayout ? (
                <View>
                  <Pressable
                    style={[styles.requestSwapBtn, styles.btnDisabled]}
                    disabled
                    accessibilityRole="button"
                    accessibilityState={{ disabled: true }}
                    accessibilityLabel={t(
                      'rotation.requestSwapDisabledA11y',
                      'Échange de position indisponible après tous vos versements bénéficiaires'
                    )}
                  >
                    <Ionicons name="swap-horizontal" size={22} color="#FFFFFF" />
                    <Text style={styles.requestSwapBtnText}>
                      {t('rotation.requestSwap', 'Demander un échange de position')}
                    </Text>
                  </Pressable>
                  <Text style={styles.requestSwapDisabledHint}>
                    {t(
                      'rotation.requestSwapDisabledAfterPayout',
                      'Indisponible : vous avez déjà reçu la cagnotte pour tous vos tours en tant que bénéficiaire.'
                    )}
                  </Text>
                </View>
              ) : (
                <Pressable
                  style={styles.requestSwapBtn}
                  onPress={() =>
                    (navigation as { navigate: (n: string, p?: object) => void }).navigate(
                      'SwapRequestScreen',
                      { tontineUid }
                    )
                  }
                >
                  <Ionicons name="swap-horizontal" size={22} color="#FFFFFF" />
                  <Text style={styles.requestSwapBtnText}>
                    {t('rotation.requestSwap', 'Demander un échange de position')}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
          
          {tontine.rotationChanged && (
            <View style={styles.rotationChangedBanner}>
              <Text style={styles.rotationChangedText}>
                {t('tontineDetails.rotationChanged')}
              </Text>
            </View>
          )}
          <Text style={styles.sectionTitle}>
            {t('tontineDetails.rotationCalendarSectionTitle')}
          </Text>
          {!rotationQueryEnabled ? (
            <Text style={styles.emptyText}>
              {t('tontineDetails.rotationTabAfterStart')}
            </Text>
          ) : rotationLoading ? (
            <View style={styles.rotationTabLoading}>
              <ActivityIndicator size="small" color={KELEMBA_GREEN} />
            </View>
          ) : rotationError ? (
            <View style={styles.rotationTabError}>
              <Text style={styles.rotationTabErrorText}>{t('common.error')}</Text>
              <Pressable
                onPress={() => void refetchRotation()}
                style={styles.rotationTabRetryBtn}
                accessibilityRole="button"
              >
                <Text style={styles.rotationTabRetryText}>
                  {t('common.retry')}
                </Text>
              </Pressable>
            </View>
          ) : rotationList.length === 0 ? (
            <Text style={styles.emptyText}>
              {t('tontineDetails.rotationTabNoTours')}
            </Text>
          ) : (
            <View style={styles.rotationCalendarBlock}>
              <RotationStatsHeader
                totalAmount={rotationTotalAmount}
                nextTourNumber={nextRotationTourNumber}
                currentRotation={currentRotationRound}
              />
              {isDelayedByOthers && pendingReason ? (
                <DelayBanner pendingReason={pendingReason} />
              ) : null}
              <View style={styles.rotationSectionRow}>
                <Text style={styles.rotationCalendarSubtitle}>
                  {t('rotation.calendarTitle')}
                </Text>
                <View style={styles.rotationParticipantsBadge}>
                  <Text style={styles.rotationParticipantsText}>
                    {t('rotation.participants', { count: rotationMemberCount })}
                  </Text>
                </View>
              </View>
              <View style={styles.rotationTimeline}>
                {rotationList.map((item, index) => (
                  <View key={item.uid} style={styles.rotationTimelineRow}>
                    <View
                      style={[
                        styles.rotationTimelineConnector,
                        index === 0 && styles.rotationTimelineConnectorFirst,
                      ]}
                    />
                    <RotationTimelineItem
                      cycle={item}
                      showProgressBar={
                        item.displayStatus === 'PROCHAIN' && item.totalExpected > 0
                      }
                      showRotationBadge={showRotationRoundBadge}
                    />
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {activeTab === 'payments' && (
        <View style={styles.tabContent}>
          <View style={styles.filterScrollView}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {(['all', 'success', 'inProgress', 'failed'] as const).map((f) => (
              <Pressable
                key={f}
                style={[
                  styles.filterChip,
                  paymentFilter === f && styles.filterChipActive,
                ]}
                onPress={() => setPaymentFilter(f)}
              >
                <Text
                  style={[
                    styles.filterText,
                    paymentFilter === f && styles.filterTextActive,
                  ]}
                >
                  {t(`tontineDetails.filter${f.charAt(0).toUpperCase() + f.slice(1)}`)}
                </Text>
              </Pressable>
            ))}
            </ScrollView>
          </View>
          <FlatList
            data={payments}
            keyExtractor={(item) => item.uid}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.paymentItem}>
                <View style={styles.paymentHeader}>
                  <View style={styles.cycleBadge}>
                    <Text style={styles.cycleBadgeText}>
                      {t('tontineDetails.cycleLabel')} {item.cycleNumber}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.paymentStatusBadge,
                      {
                        backgroundColor:
                          PAYMENT_STATUS[item.status]?.color ?? '#9E9E9E',
                      },
                    ]}
                  >
                    <Text style={styles.paymentStatusText}>{item.status}</Text>
                  </View>
                </View>
                <Text style={styles.paymentDate}>
                  {formatDateTime(item.paidAt)}
                </Text>
                <Text style={styles.paymentAmount}>{formatFcfa(item.amount)}</Text>
                {item.penalty > 0 && (
                  <Text style={styles.penaltyText}>
                    + {formatFcfa(item.penalty)} {t('tontineDetails.penalty')}
                  </Text>
                )}
                <View style={styles.paymentMethod}>
                  {item.method === 'ORANGE_MONEY' && (
                    <Ionicons name="phone-portrait" size={16} color="#F5A623" />
                  )}
                  {item.method === 'TELECEL_MONEY' && (
                    <Ionicons name="phone-portrait" size={16} color="#0055A5" />
                  )}
                  {item.method === 'CASH' && (
                    <Ionicons name="cash-outline" size={16} color="#1A6B3C" />
                  )}
                  {item.method === 'SYSTEM' && (
                    <Ionicons name="server" size={16} color="#6B7280" />
                  )}
                  <Text style={styles.methodText}>
                    {item.method === 'ORANGE_MONEY'
                      ? 'Orange Money'
                      : item.method === 'TELECEL_MONEY'
                        ? 'Telecel Money'
                        : item.method === 'CASH'
                          ? 'Espèces'
                          : item.method}
                  </Text>
                </View>
              </View>
            )}
            ListFooterComponent={
              hasNextPage ? (
                <Pressable
                  style={styles.seeMoreBtn}
                  onPress={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  <Text style={styles.seeMoreText}>
                    {isFetchingNextPage
                      ? t('common.loading')
                      : t('tontineDetails.seeMore')}
                  </Text>
                </Pressable>
              ) : null
            }
          />
        </View>
      )}

      {activeTab === 'members' && (
        <FlatList
          data={sortedMembers}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            isCreator ? (
              <View>
                <Pressable
                  style={[
                    styles.inviteMembersBtn,
                    inviteMembersDisabled && styles.btnDisabled,
                  ]}
                  disabled={inviteMembersDisabled}
                  onPress={() =>
                    navigation.navigate('InviteMembers', {
                      tontineUid,
                      tontineName: tontine.name,
                    })
                  }
                  accessibilityRole="button"
                  accessibilityState={{ disabled: inviteMembersDisabled }}
                  accessibilityLabel={
                    inviteMembersDisabled
                      ? t(
                          'tontineDetails.inviteMembersDisabledA11y',
                          'Inviter des membres indisponible après le démarrage de la tontine'
                        )
                      : t('inviteMembers.inviteButton')
                  }
                >
                  <Ionicons name="person-add" size={20} color="#FFFFFF" />
                  <Text style={styles.inviteMembersBtnText}>
                    {t('inviteMembers.inviteButton')}
                  </Text>
                </Pressable>
                {inviteMembersDisabled ? (
                  <Text style={styles.inviteMembersDisabledHint}>
                    {t(
                      'tontineDetails.inviteMembersDisabledAfterStart',
                      'Les invitations ne sont plus disponibles après le démarrage de la tontine.'
                    )}
                  </Text>
                ) : null}
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const labels = getMemberLabels(item, userUid ?? null);
            return (
            <View style={styles.memberCard}>
              <View style={styles.memberCardHeader}>
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: hashToColor(item.fullName) },
                  ]}
                >
                  <Text style={styles.avatarText}>{getInitials(item.fullName)}</Text>
                </View>
                <View style={styles.memberCardInfo}>
                  <Text style={styles.memberCardName}>{item.fullName}</Text>
                  <Text style={styles.memberCardPosition}>#{item.rotationOrder}</Text>
                  <Text style={styles.memberCardPhone}>
                    {maskPhone(item.phone)}
                  </Text>
                  <View style={styles.labelRow}>
                    {labels.map((label) => (
                      <View
                        key={label}
                        style={[
                          styles.memberLabelPill,
                          label === 'Organisateur' && styles.labelOrganizer,
                          label === 'vous' && styles.labelYou,
                        ]}
                      >
                        <Text style={styles.memberLabelText}>
                          {label === 'Organisateur' ? t('tontineList.organizer') : label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
              <Text style={styles.memberParts}>
                {item.sharesCount} {t('tontineDetails.parts')}
              </Text>
              <ScoreProgressBar
                label={t('tontineDetails.scoreLabel')}
                percentage={(item.kelembScore / 1000) * 100}
              />
              <Text style={styles.signedText}>
                {item.signedAt
                  ? `${t('tontineDetails.signedOn')} ${formatDate(item.signedAt)}`
                  : t('tontineDetails.notSigned')}
              </Text>
              <View style={styles.membershipBadge}>
                <Text style={styles.membershipText}>{item.membershipStatus}</Text>
              </View>
            </View>
          );
          }}
        />
      )}

      {showCotiserFAB && (
        <Pressable
          style={styles.fab}
          onPress={handleCotiser}
          accessibilityRole="button"
          accessibilityLabel={`${t('tontineDetails.contribute')} — ${formatFcfa(totalDue)}`}
        >
          <Ionicons name="card-outline" size={22} color="#FFFFFF" />
          <Text style={styles.fabText}>
            {t('tontineDetails.contribute')} — {formatFcfa(totalDue)}
          </Text>
        </Pressable>
      )}

      <ErrorToast
        message={toastMessage}
        visible={toastVisible}
        severity={toastSeverity}
        onHide={() => setToastVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerBackButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: KELEMBA_GREEN_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    fontSize: 16,
    color: KELEMBA_GREEN,
    fontWeight: '600',
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
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
  tabScrollView: {
    height: 48,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 0,
    gap: 24,
  },
  filterScrollView: {
    height: 52,
  },
  tab: {
    height: 48,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabActive: {},
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  tabTextActive: {
    color: KELEMBA_GREEN,
    fontWeight: '700',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: KELEMBA_GREEN,
    borderRadius: 2,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentInner: {
    padding: 20,
    paddingBottom: 100, // 64 tab height + 20 margin + 16 safe area
  },
  tabContent: {
    flex: 1,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: BORDER_RADIUS_SM,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: KELEMBA_GREEN_LIGHT,
    borderColor: KELEMBA_GREEN,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterTextActive: {
    color: KELEMBA_GREEN,
    fontWeight: '600',
  },
  listContent: {
    padding: 20,
    paddingBottom: 100, // 64 tab height + 20 margin + 16 safe area
    flexGrow: 1,
  },
  inviteMembersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: KELEMBA_GREEN,
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS,
    marginBottom: 16,
    minHeight: 52,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  inviteMembersBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  inviteMembersDisabledHint: {
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  cycleOverviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cycleOverviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cycleOverviewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: KELEMBA_GREEN,
  },
  cycleStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  cycleStatusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cycleOverviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cycleOverviewLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  cycleOverviewPercent: {
    fontSize: 17,
    fontWeight: '800',
    color: KELEMBA_GREEN,
  },
  cycleOverviewHint: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 8,
  },
  metricCardRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  metricCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  metricCardValueGreen: {
    fontSize: 20,
    fontWeight: '800',
    color: KELEMBA_GREEN,
  },
  metricCardValueOrange: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F5A623',
  },
  payoutCta: {
    backgroundColor: '#D0021B',
    borderRadius: BORDER_RADIUS,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 52,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  payoutCtaDisabled: {
    opacity: 0.85,
  },
  payoutCtaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  progressionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  progressionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  progressionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  progressionPercent: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A6B3C',
  },
  nextPaymentCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  nextPaymentText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  nextPaymentBold: {
    fontWeight: '700',
    color: '#78350F',
  },
  membersCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  memberRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  scoreBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  scoreStar: {
    fontSize: 10,
    color: '#F5A623',
  },
  beneficiaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  beneficiaryText: {
    fontSize: 11,
    color: '#1A6B3C',
    fontWeight: '600',
  },
  payStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 80,
    justifyContent: 'center',
  },
  payStatusPaid: {
    backgroundColor: '#DCFCE7',
  },
  payStatusLate: {
    backgroundColor: '#FEE2E2',
  },
  payStatusPending: {
    backgroundColor: '#FEF9C3',
  },
  payStatusIcon: {
    fontSize: 11,
  },
  payStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  payStatusTextPaid: {
    color: '#15803D',
  },
  payStatusTextLate: {
    color: '#B91C1C',
  },
  payStatusTextPending: {
    color: '#A16207',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1A6B3C',
  },
  delayedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF8E7',
    padding: 12,
    borderRadius: 8,
  },
  delayedText: {
    fontSize: 14,
    color: '#92400E',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 12,
    letterSpacing: 0.8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  memberDueText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  memberParts: {
    fontSize: 12,
    color: '#6B7280',
  },
  emptyCycle: {
    padding: 32,
    alignItems: 'center',
    gap: 20,
  },
  emptyCycleText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  startTontineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1A6B3C',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    minHeight: 56,
    shadowColor: '#1A6B3C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  startTontineBtnDisabled: {
    opacity: 0.6,
  },
  startTontineBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  startTontineHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
    width: '100%',
  },
  startTontineHintText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
  },
  draftPanel: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 20,
  },
  draftBadge: {
    backgroundColor: KELEMBA_GREEN_LIGHT,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  draftBadgeText: {
    color: KELEMBA_GREEN,
    fontSize: 12,
    fontWeight: '700',
  },
  draftPanelTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A6B3C',
    textAlign: 'center',
  },
  draftPanelSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },
  qrContainer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: KELEMBA_GREEN,
    borderRadius: BORDER_RADIUS_SM,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 10,
    minHeight: 48,
    width: '100%',
  },
  shareButtonText: {
    color: KELEMBA_GREEN,
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    width: '100%',
    marginVertical: 8,
  },
  manageCta: {
    backgroundColor: '#F5A623',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    width: '100%',
  },
  manageCtaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  activateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: KELEMBA_GREEN,
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS,
    minHeight: 56,
    marginTop: 8,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  activateBtnDisabled: {
    opacity: 0.6,
  },
  activateBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  activateHint: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    padding: 20,
    textAlign: 'center',
  },
  rotationManagementSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  rotationActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#1A6B3C',
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 48,
  },
  rotationActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A6B3C',
  },
  swapRequestsSection: {
    marginBottom: 16,
  },
  swapRequestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  swapRequestText: {
    fontSize: 14,
    color: '#1C1C1E',
    marginBottom: 4,
  },
  swapRequestDate: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  swapRequestActions: {
    flexDirection: 'row',
    gap: 12,
  },
  swapApproveBtn: {
    flex: 1,
    backgroundColor: '#1A6B3C',
    borderRadius: 8,
    paddingVertical: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapApproveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  swapRejectBtn: {
    flex: 1,
    backgroundColor: '#D0021B',
    borderRadius: 8,
    paddingVertical: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapRejectText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  swapRequestMemberSection: {
    marginBottom: 16,
  },
  requestSwapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1A6B3C',
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 52,
  },
  requestSwapBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  requestSwapDisabledHint: {
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  pendingSwapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF8E7',
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 48,
  },
  pendingSwapText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  viewFullRotationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E8F5EE',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  viewFullRotationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A6B3C',
  },
  rotationChangedBanner: {
    backgroundColor: '#E0F2FE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  rotationChangedText: {
    fontSize: 14,
    color: '#0369A1',
  },
  rotationTabLoading: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  rotationTabError: {
    paddingVertical: 16,
    gap: 12,
    alignItems: 'center',
  },
  rotationTabErrorText: {
    fontSize: 14,
    color: '#D0021B',
    textAlign: 'center',
  },
  rotationTabRetryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: KELEMBA_GREEN_LIGHT,
    borderRadius: 12,
  },
  rotationTabRetryText: {
    fontSize: 14,
    fontWeight: '600',
    color: KELEMBA_GREEN,
  },
  rotationCalendarBlock: {
    marginBottom: 24,
  },
  rotationSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  rotationCalendarSubtitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
    marginRight: 8,
  },
  rotationParticipantsBadge: {
    backgroundColor: '#E5E5EA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  rotationParticipantsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  rotationTimeline: {
    marginBottom: 24,
  },
  rotationTimelineRow: {
    position: 'relative',
  },
  rotationTimelineConnector: {
    position: 'absolute',
    left: 39,
    top: 0,
    bottom: -16,
    width: 2,
    backgroundColor: '#E5E5EA',
  },
  rotationTimelineConnectorFirst: {
    top: 20,
  },
  paymentItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cycleBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cycleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  paymentStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  paymentStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  paymentDate: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  penaltyText: {
    fontSize: 13,
    color: '#D0021B',
    marginBottom: 4,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  methodText: {
    fontSize: 12,
    color: '#6B7280',
  },
  seeMoreBtn: {
    padding: 16,
    alignItems: 'center',
  },
  seeMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A6B3C',
  },
  memberCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  memberCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  memberCardInfo: {
    flex: 1,
  },
  memberCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  memberCardPosition: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
  },
  memberCardPhone: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  labelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  memberLabelPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  labelOrganizer: {
    backgroundColor: '#1A6B3C',
  },
  labelYou: {
    backgroundColor: '#0055A5',
  },
  memberLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  organizerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5A623',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  organizerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  signedText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  membershipBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  membershipText: {
    fontSize: 12,
    color: '#374151',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    minHeight: 56,
    paddingHorizontal: 24,
    borderRadius: 28,
    backgroundColor: '#F5A623',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#F5A623',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  modalAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A6B3C',
    marginBottom: 24,
  },
  methodButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  methodBtn: {
    flex: 1,
    minHeight: 80,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  methodBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  cancelBtn: {
    padding: 16,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    color: '#6B7280',
  },
  errorState: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#D0021B',
    textAlign: 'center',
  },
  skeletonHeader: {
    height: 60,
    marginHorizontal: 20,
    marginTop: 12,
  },
  skeletonContent: {
    padding: 20,
  },
  skeletonBlock: {
    marginBottom: 12,
  },
});
