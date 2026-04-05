import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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
import { usePaymentHistory } from '@/hooks/usePaymentHistory';
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
import { formatFcfa, formatFcfaAmount, maskPhone } from '@/utils/formatters';
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
import type { TontineFrequency } from '@/api/types/api.types';
import { TontineDetailHeader } from '@/components/tontines/TontineDetailHeader';
import type { TontineDetailTabId } from '@/components/tontines/TontineDetailHeader';
import { DashboardTab } from '@/screens/tontines/tabs/DashboardTab';
import { RotationTab } from '@/screens/tontines/tabs/RotationTab';
import { PaymentsTab } from '@/screens/tontines/tabs/PaymentsTab';
import { MembersTab } from '@/screens/tontines/tabs/MembersTab';
import { useOrganizerCashPendingForTontine } from '@/hooks/useOrganizerCashPendingForTontine';
import { COLORS } from '@/theme/colors';

function getMemberLabels(member: TontineMember, currentUserUid: string | null): string[] {
  const labels: string[] = [];
  if (member.memberRole === 'CREATOR') labels.push('Organisateur');
  if (currentUserUid && member.userUid === currentUserUid) labels.push('vous');
  return labels;
}

type Props = NativeStackScreenProps<RootStackParamList, 'TontineDetails'>;

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
  const { tontineUid, isCreator: isCreatorParam, tab: tabParam } = route.params;
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const userUid = useSelector((state: RootState) => selectUserUid(state));

  const [activeTab, setActiveTab] = useState<TontineDetailTabId>('dashboard');
  const tabInitRef = useRef(false);
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
  } = usePaymentHistory(tontineUid, 'all');

  const { items: organizerCashForKpi } = useOrganizerCashPendingForTontine(
    tontineUid,
    isCreator
  );

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

  useEffect(() => {
    if (tabInitRef.current) return;
    if (
      tabParam === 'dashboard' ||
      tabParam === 'rotation' ||
      tabParam === 'payments' ||
      tabParam === 'members'
    ) {
      setActiveTab(tabParam);
      tabInitRef.current = true;
    }
  }, [tabParam]);

  const kpiCells = useMemo(() => {
    if (!tontine) {
      return [
        { label: '—', value: '—' },
        { label: '—', value: '—' },
        { label: '—', value: '—' },
        { label: '—', value: '—' },
      ];
    }
    const freqShort = (f: TontineFrequency | undefined): string => {
      if (!f) return '—';
      const m: Record<TontineFrequency, string> = {
        DAILY: 'Quot.',
        WEEKLY: 'Hebdo',
        BIWEEKLY: 'Bi.',
        MONTHLY: 'Mens.',
      };
      return m[f];
    };
    const activeMembers = members.filter((m) => m.membershipStatus === 'ACTIVE');
    const totalParts = activeMembers.reduce((s, m) => s + m.sharesCount, 0);
    const lateMembers = members.filter(
      (m) =>
        m.currentCyclePaymentStatus === 'OVERDUE' ||
        m.currentCyclePaymentStatus === 'PENALIZED'
    ).length;
    const okMembers = members.filter(
      (m) => m.currentCyclePaymentStatus === 'COMPLETED'
    ).length;

    const now = new Date();
    const ym = now.getMonth();
    const yy = now.getFullYear();
    const paidMonth = payments.reduce((s, p) => {
      if (p.status !== 'COMPLETED' || !p.paidAt) return s;
      const d = new Date(p.paidAt);
      if (d.getMonth() !== ym || d.getFullYear() !== yy) return s;
      return s + p.amount;
    }, 0);
    const penaltiesMonth = payments.reduce((s, p) => {
      if (!p.paidAt) return s;
      const d = new Date(p.paidAt);
      if (d.getMonth() !== ym || d.getFullYear() !== yy) return s;
      return s + (p.penalty ?? 0);
    }, 0);

    const completedRot = rotationList.filter((c) => c.displayStatus === 'VERSÉ').length;

    const dueToPay =
      nextPaymentForUi?.tontineUid === tontineUid
        ? formatFcfaAmount(Math.round(nextPaymentForUi.totalDue ?? 0))
        : '—';

    switch (activeTab) {
      case 'dashboard':
        return [
          { label: 'Part', value: freqShort(tontine.frequency) },
          {
            label: 'Cycle',
            value: `${currentCycle?.cycleNumber ?? 0}/${tontine.totalCycles}`,
          },
          { label: 'Mon tour', value: `C${rotationCurrentCycleNumber}` },
          { label: 'Membres', value: String(activeMembers.length) },
        ];
      case 'rotation':
        return [
          {
            label: 'Total cycles',
            value: String(rotationList.length || tontine.totalCycles),
          },
          { label: 'Complétés', value: String(completedRot) },
          { label: 'Mon tour', value: `C${rotationCurrentCycleNumber}` },
          {
            label: 'Cagnotte',
            value: `${formatFcfaAmount(Math.round(rotationTotalAmount))} F`,
          },
        ];
      case 'payments':
        return [
          {
            label: 'Payé (mois)',
            value: `${formatFcfaAmount(Math.round(paidMonth))} F`,
          },
          { label: 'À payer', value: dueToPay },
          {
            label: 'Pénalités',
            value: `${formatFcfaAmount(Math.round(penaltiesMonth))} F`,
          },
          {
            label: 'Espèces',
            value: isCreator ? String(organizerCashForKpi.length) : '—',
          },
        ];
      case 'members':
        return [
          { label: 'Membres actifs', value: String(activeMembers.length) },
          { label: 'Total parts', value: String(totalParts) },
          { label: 'En retard', value: String(lateMembers) },
          { label: 'À jour', value: String(okMembers) },
        ];
      default:
        return [
          { label: '—', value: '—' },
          { label: '—', value: '—' },
          { label: '—', value: '—' },
          { label: '—', value: '—' },
        ];
    }
  }, [
    activeTab,
    tontine,
    members,
    currentCycle,
    rotationList,
    rotationCurrentCycleNumber,
    rotationTotalAmount,
    payments,
    nextPaymentForUi,
    tontineUid,
    isCreator,
    organizerCashForKpi.length,
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
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.primary }} edges={['top']}>
      <TontineDetailHeader
        uid={tontineUid}
        isCreator={isCreator}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        kpiCells={kpiCells}
        navigation={navigation}
        t={t}
      />
      <View style={{ flex: 1, backgroundColor: COLORS.gray100 }}>
        {activeTab === 'dashboard' ? (
          <DashboardTab
            uid={tontineUid}
            isCreator={isCreator}
            onGoToMembersTab={() => setActiveTab('members')}
          />
        ) : null}
        {activeTab === 'rotation' ? (
          <RotationTab uid={tontineUid} isCreator={isCreator} />
        ) : null}
        {activeTab === 'payments' ? (
          <PaymentsTab uid={tontineUid} isCreator={isCreator} />
        ) : null}
        {activeTab === 'members' ? (
          <MembersTab uid={tontineUid} isCreator={isCreator} />
        ) : null}
      </View>
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
