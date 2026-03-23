/**
 * Ecran - Paiements : suivi personnel + validations cash organisateur.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  SectionList,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { selectUserUid } from '@/store/authSlice';
import type { MainTabParamList } from '@/navigation/types';
import { navigationRef } from '@/navigation/navigationRef';
import {
  useContributionHistory,
  type StatusFilter,
  type PeriodPreset,
  type MethodFilterOption,
  type HistorySortField,
} from '@/hooks/useContributionHistory';
import { useNextPayment } from '@/hooks/useNextPayment';
import { useTontines } from '@/hooks/useTontines';
import { useHasOrganizerRoleInTontines } from '@/hooks/useHasOrganizerRoleInTontines';
import {
  useOrganizerCashPendingActions,
  filterOrganizerCashPendingForTontineScope,
  getOrganizerTontineUids,
} from '@/hooks/useOrganizerCashPending';
import {
  validateCashPayment,
  type OrganizerCashPendingAction,
} from '@/api/cashPaymentApi';
import { classifyApiQueryError } from '@/api/errors/queryRetry';
import { parseApiError } from '@/api/errors/errorHandler';
import { formatFcfa } from '@/utils/formatters';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import {
  PaymentsSegmentedControl,
  type PaymentsSegment,
} from './components/PaymentsSegmentedControl';
import { PaymentSummaryGrid } from './components/PaymentSummaryGrid';
import { PaymentHistoryToolbar } from './components/PaymentHistoryToolbar';
import { PaymentHistoryCard } from './components/PaymentHistoryCard';
import { PaymentFiltersModal } from './components/PaymentFiltersModal';
import { PaymentSortModal } from './components/PaymentSortModal';
import { PaymentReceiptSummaryModal } from './components/PaymentReceiptSummaryModal';
import { CashOrganizerCard } from './components/CashOrganizerCard';
import { CashOrganizerDetailModal } from './components/CashOrganizerDetailModal';
import {
  buildViewerRoleByTontine,
  buildPaymentHistoryVm,
  groupOrganizerCashActions,
  matchesRoleFilter,
  type OrganizerCashGroupVm,
  type PaymentHistoryListItemVm,
  type PaymentRoleFilterOption,
} from './paymentViewModels';
import {
  decrementPendingCount,
  removePendingActionByPaymentUid,
  type CashDecisionAction,
} from './organizerCashMutations';
import { withNextPaymentPenaltyWaivedForPendingCashValidation } from '@/utils/nextPaymentPenaltyWaive';

type Props = BottomTabScreenProps<MainTabParamList, 'Payments'>;

type ContributionSection = {
  key: string;
  title: string;
  subtitle?: string;
  data: PaymentHistoryListItemVm[];
};

type CashSection = {
  key: string;
  title: string;
  subtitle: string;
  group: OrganizerCashGroupVm;
  data: OrganizerCashPendingAction[];
};

const GREEN = '#1A6B3C';
const ORANGE = '#F5A623';
const BLUE = '#0055A5';
const RED = '#D0021B';

const FILTER_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: undefined, label: 'Tous statuts' },
  { id: 'PENDING', label: 'En attente' },
  { id: 'PROCESSING', label: 'En traitement' },
  { id: 'COMPLETED', label: 'Valide' },
  { id: 'FAILED', label: 'Rejete' },
  { id: 'REFUNDED', label: 'Rembourse' },
];

function periodChipLabel(
  preset: PeriodPreset,
  customFrom: string,
  customTo: string
): string {
  if (preset === 'all') return 'Toute periode';
  if (preset === '7d') return '7 jours';
  if (preset === '30d') return '30 jours';
  if (preset === 'custom' && customFrom && customTo) return `${customFrom} -> ${customTo}`;
  return 'Personnalisee';
}

function sortChipLabel(field: HistorySortField, order: 'asc' | 'desc'): string {
  if (field === 'amount') {
    return order === 'asc' ? 'Montant croissant' : 'Montant decroissant';
  }
  return order === 'asc' ? 'Plus anciens' : 'Plus recents';
}

function formatDateTime(str: string | null | undefined): string {
  if (!str) return '-';
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getUrgencyMeta(
  urgencyLevel: string | null,
  joursRestants: number | null,
  isOverdue?: boolean,
  daysLate?: number
): { label: string; color: string; bg: string; helper: string } {
  if (isOverdue || (daysLate ?? 0) > 0 || urgencyLevel === 'EN_RETARD') {
    return {
      label: 'En retard',
      color: RED,
      bg: '#FEE2E2',
      helper:
        (daysLate ?? 0) > 0
          ? `${daysLate} jour(s) de retard`
          : 'Cette cotisation doit etre regularisee',
    };
  }
  if (urgencyLevel === 'URGENT') {
    return {
      label: 'Urgent',
      color: ORANGE,
      bg: '#FEF3C7',
      helper:
        joursRestants === 0
          ? "Echeance aujourd'hui"
          : `${joursRestants ?? 0} jour(s) restant(s)`,
    };
  }
  if (urgencyLevel === 'BIENTOT' || urgencyLevel === 'BIENTÔT') {
    return {
      label: 'Bientot',
      color: BLUE,
      bg: '#DBEAFE',
      helper: `${joursRestants ?? 0} jour(s) restant(s)`,
    };
  }
  return {
    label: 'A jour',
    color: GREEN,
    bg: '#DCFCE7',
    helper: `${joursRestants ?? 0} jour(s) restant(s)`,
  };
}

function getInlineErrorMessage(
  err: unknown,
  options?: { hasCachedData?: boolean; fallback?: string }
): string {
  const kind = classifyApiQueryError(err);
  const hasCachedData = options?.hasCachedData ?? false;

  if (kind === 'rate_limited') {
    return hasCachedData
      ? 'Donnees recentes affichees. Reessayez dans quelques secondes.'
      : 'Serveur temporairement sollicite. Reessayez dans quelques secondes.';
  }

  if (kind === 'network') {
    return hasCachedData
      ? 'Connexion instable. Les dernieres donnees disponibles restent affichees.'
      : 'Impossible de joindre le serveur. Verifiez votre connexion.';
  }

  if (kind === 'server') {
    return hasCachedData
      ? 'Les donnees recentes restent affichees pendant la reprise du service.'
      : 'Le service est temporairement indisponible. Reessayez plus tard.';
  }

  return options?.fallback ?? 'Une erreur est survenue. Reessayez.';
}

function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function QueueMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'danger' | 'success';
}) {
  return (
    <View style={styles.queueMetric}>
      <Text style={styles.queueMetricLabel}>{label}</Text>
      <Text
        style={[
          styles.queueMetricValue,
          tone === 'danger'
            ? styles.queueMetricValueDanger
            : tone === 'success'
              ? styles.queueMetricValueSuccess
              : null,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export const ContributionHistoryScreen: React.FC<Props> = ({ route, navigation }) => {
  const queryClient = useQueryClient();
  const userUid = useSelector(selectUserUid);
  const hasOrganizerRoleInTontines = useHasOrganizerRoleInTontines();

  const [segment, setSegment] = useState<PaymentsSegment>('contributions');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(undefined);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [methodFilter, setMethodFilter] = useState<MethodFilterOption>('all');
  const [roleFilter, setRoleFilter] = useState<PaymentRoleFilterOption>('all');
  const [sortField, setSortField] = useState<HistorySortField>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [receiptItem, setReceiptItem] = useState<PaymentHistoryListItemVm | null>(null);
  const [cashDetail, setCashDetail] = useState<OrganizerCashPendingAction | null>(null);
  const [rejectTarget, setRejectTarget] = useState<OrganizerCashPendingAction | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actioningPaymentUid, setActioningPaymentUid] = useState<string | null>(null);
  const [actioningDecision, setActioningDecision] = useState<CashDecisionAction | null>(null);

  const {
    nextPayment,
    joursRestants,
    urgencyLevel,
    isLoading: nextPaymentLoading,
    isFetching: nextPaymentFetching,
    isError: nextPaymentError,
    error: nextPaymentErrorValue,
    refetch: refetchNextPayment,
  } = useNextPayment();
  const {
    tontines,
    isFetching: tontinesFetching,
    refetch: refetchTontines,
  } = useTontines({ includeInvitations: false });
  const {
    data: pendingRaw = [],
    isLoading: pendingLoading,
    isFetching: pendingFetching,
    isError: pendingError,
    error: pendingErrorValue,
    refetch: refetchPending,
  } = useOrganizerCashPendingActions({
    active: hasOrganizerRoleInTontines,
  });

  const organizerTontineUids = useMemo(
    () => getOrganizerTontineUids(tontines),
    [tontines]
  );

  const pendingForOrganizer = useMemo(
    () =>
      filterOrganizerCashPendingForTontineScope(
        pendingRaw,
        userUid,
        organizerTontineUids
      ),
    [pendingRaw, userUid, organizerTontineUids]
  );

  useEffect(() => {
    if (!hasOrganizerRoleInTontines && segment === 'cashValidations') {
      setSegment('contributions');
    }
  }, [hasOrganizerRoleInTontines, segment]);

  useFocusEffect(
    useCallback(() => {
      const seg = route.params?.initialSegment;
      if (seg === 'cashValidations' && hasOrganizerRoleInTontines) {
        setSegment('cashValidations');
        navigation.setParams({ initialSegment: undefined });
      }
    }, [
      route.params?.initialSegment,
      hasOrganizerRoleInTontines,
      navigation,
    ])
  );

  const {
    items,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isError: historyError,
    error: historyErrorValue,
    fetchNextPage,
    refetch: refetchHistory,
  } = useContributionHistory(statusFilter, {
    periodPreset,
    customFrom,
    customTo,
    methodFilter,
    sortField,
    sortOrder,
  });

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

  const validateMutation = useMutation({
    mutationFn: ({
      paymentUid,
      action,
      reason,
    }: {
      paymentUid: string;
      action: 'APPROVE' | 'REJECT';
      reason?: string;
    }) => validateCashPayment(paymentUid, action, reason),
    onMutate: async (vars) => {
      setActioningPaymentUid(vars.paymentUid);
      setActioningDecision(vars.action);

      const pendingActionsKey = [
        'payments',
        'cash',
        'organizer',
        'pending-actions',
        userUid,
      ] as const;
      const pendingCountKey = [
        'payments',
        'cash',
        'organizer',
        'pending-count',
        userUid,
      ] as const;

      await Promise.all([
        queryClient.cancelQueries({ queryKey: pendingActionsKey }),
        queryClient.cancelQueries({ queryKey: pendingCountKey }),
      ]);

      const previousPendingActions =
        queryClient.getQueryData<OrganizerCashPendingAction[]>(pendingActionsKey);
      const previousPendingCount =
        queryClient.getQueryData<number>(pendingCountKey);

      queryClient.setQueryData<OrganizerCashPendingAction[]>(
        pendingActionsKey,
        (current) => removePendingActionByPaymentUid(current, vars.paymentUid)
      );
      queryClient.setQueryData<number>(
        pendingCountKey,
        (current) => decrementPendingCount(current)
      );

      return {
        pendingActionsKey,
        pendingCountKey,
        previousPendingActions,
        previousPendingCount,
      };
    },
    onSuccess: (_, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['payments', 'history'] });
      void queryClient.invalidateQueries({ queryKey: ['nextPayment'] });
      void queryClient.invalidateQueries({
        queryKey: ['payments', 'cash', 'organizer', 'pending-count'],
      });
      if (segment === 'cashValidations') {
        void queryClient.invalidateQueries({
          queryKey: ['payments', 'cash', 'organizer', 'pending-actions'],
        });
      }
      setRejectTarget(null);
      setRejectReason('');
      setCashDetail(null);
      setActioningPaymentUid(null);
      setActioningDecision(null);
      Alert.alert(
        vars.action === 'APPROVE' ? 'Paiement valide' : 'Paiement refuse',
        vars.action === 'APPROVE'
          ? 'La cotisation especes a ete confirmee.'
          : 'Le membre peut etre informe du refus.'
      );
    },
    onError: (err: unknown, _vars, context) => {
      if (context?.pendingActionsKey) {
        queryClient.setQueryData(
          context.pendingActionsKey,
          context.previousPendingActions
        );
      }
      if (context?.pendingCountKey) {
        queryClient.setQueryData(
          context.pendingCountKey,
          context.previousPendingCount
        );
      }
      setActioningPaymentUid(null);
      setActioningDecision(null);
      const e = parseApiError(err);
      Alert.alert('Erreur', e.message);
    },
    onSettled: () => {
      setActioningPaymentUid(null);
      setActioningDecision(null);
    },
  });

  const roleByTontine = useMemo(() => buildViewerRoleByTontine(tontines), [tontines]);

  const historyItems = useMemo(
    () => items.map((item) => buildPaymentHistoryVm(item, userUid, roleByTontine)),
    [items, userUid, roleByTontine]
  );

  const filteredHistoryItems = useMemo(
    () => historyItems.filter((item) => matchesRoleFilter(item, roleFilter)),
    [historyItems, roleFilter]
  );

  const summary = useMemo(() => {
    const completed = filteredHistoryItems.filter((item) => item.status === 'COMPLETED');
    const totalVerse = completed.reduce((sum, item) => sum + item.totalPaid, 0);
    const totalPenalites = completed.reduce((sum, item) => sum + item.penalty, 0);
    const sansPenalite = completed.filter((item) => item.penalty === 0).length;
    const taux = completed.length > 0 ? Math.round((sansPenalite / completed.length) * 100) : 100;
    const enAttente = filteredHistoryItems.filter((item) => item.isActionRequired).length;
    return { totalVerse, totalPenalites, taux, enAttente };
  }, [filteredHistoryItems]);

  const contributionsSections = useMemo<ContributionSection[]>(() => {
    const actionRequired = filteredHistoryItems.filter((item) => item.isActionRequired);
    const history = filteredHistoryItems.filter((item) => !item.isActionRequired);
    const sections: ContributionSection[] = [];

    if (actionRequired.length > 0) {
      sections.push({
        key: 'actionRequired',
        title: 'A suivre',
        subtitle: 'Cotisations qui demandent une action ou un suivi',
        data: actionRequired,
      });
    }

    if (history.length > 0) {
      sections.push({
        key: 'history',
        title: 'Historique',
        subtitle: 'Cotisations deja traitees',
        data: history,
      });
    }

    return sections;
  }, [filteredHistoryItems]);

  const periodToolbarLabel = useMemo(
    () => periodChipLabel(periodPreset, customFrom, customTo),
    [periodPreset, customFrom, customTo]
  );

  const statusToolbarLabel = useMemo(
    () =>
      FILTER_OPTIONS.find((option) => option.id === statusFilter)?.label ??
      'Tous statuts',
    [statusFilter]
  );

  const nextPaymentActionItem = useMemo(() => {
    if (!nextPayment) return null;
    return historyItems.find(
      (item) =>
        item.cycleUid === nextPayment.cycleUid &&
        (item.status === 'PENDING' || item.status === 'PROCESSING')
    );
  }, [historyItems, nextPayment]);

  const nextPaymentMeta = useMemo(
    () =>
      getUrgencyMeta(
        urgencyLevel,
        joursRestants,
        nextPayment?.isOverdue,
        nextPayment?.daysLate
      ),
    [urgencyLevel, joursRestants, nextPayment?.daysLate, nextPayment?.isOverdue]
  );

  const cashGroups = useMemo(
    () => groupOrganizerCashActions(pendingForOrganizer),
    [pendingForOrganizer]
  );

  const cashSections = useMemo<CashSection[]>(
    () =>
      cashGroups.map((group) => ({
        key: group.tontineUid || group.tontineName,
        title: group.tontineName,
        subtitle: `${group.count} demande(s) · ${formatFcfa(group.totalAmount)}`,
        group,
        data: group.items,
      })),
    [cashGroups]
  );

  const cashSummary = useMemo(() => {
    const oldest = pendingForOrganizer.reduce<string | null>((current, item) => {
      if (current == null) return item.submittedAt;
      return new Date(item.submittedAt).getTime() < new Date(current).getTime()
        ? item.submittedAt
        : current;
    }, null);
    return {
      count: pendingForOrganizer.length,
      totalAmount: pendingForOrganizer.reduce((sum, item) => sum + item.amount, 0),
      oldestSubmittedAt: oldest,
    };
  }, [pendingForOrganizer]);

  const nextPaymentErrorMessage = useMemo(
    () =>
      nextPaymentError
        ? getInlineErrorMessage(nextPaymentErrorValue, {
            hasCachedData: nextPayment != null,
            fallback: 'Impossible de charger votre prochaine cotisation.',
          })
        : null,
    [nextPayment, nextPaymentError, nextPaymentErrorValue]
  );

  const historyErrorMessage = useMemo(
    () =>
      historyError
        ? getInlineErrorMessage(historyErrorValue, {
            hasCachedData: historyItems.length > 0,
            fallback: 'Impossible de charger votre historique.',
          })
        : null,
    [historyError, historyErrorValue, historyItems.length]
  );

  const pendingErrorMessage = useMemo(
    () =>
      pendingError
        ? getInlineErrorMessage(pendingErrorValue, {
            hasCachedData: pendingRaw.length > 0,
            fallback: 'Impossible de charger les validations especes.',
          })
        : null,
    [pendingError, pendingErrorValue, pendingRaw.length]
  );

  const showHistorySkeleton =
    segment === 'contributions' &&
    historyItems.length === 0 &&
    isFetching &&
    !historyError &&
    (nextPaymentLoading || tontinesFetching);

  const handleEndReached = useCallback(() => {
    if (hasNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage]);

  const refreshContributions = useCallback(() => {
    void refetchHistory();
    void refetchNextPayment();
    void refetchTontines();
    if (hasOrganizerRoleInTontines) {
      void refetchPending();
    }
  }, [
    hasOrganizerRoleInTontines,
    refetchHistory,
    refetchNextPayment,
    refetchPending,
    refetchTontines,
  ]);

  const refreshCashValidations = useCallback(() => {
    void refetchPending();
  }, [refetchPending]);

  const openTontine = useCallback((tontineUid: string) => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('TontineDetails', { tontineUid });
    }
  }, []);

  const openCashProof = useCallback((item: PaymentHistoryListItemVm) => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('CashProofScreen', {
        paymentUid: item.uid,
        tontineUid: item.tontineUid,
        tontineName: item.tontineName,
        amount: item.amount,
      });
    }
  }, []);

  const openPaymentStatus = useCallback((item: PaymentHistoryListItemVm) => {
    if (!navigationRef.isReady()) return;
    if (item.method === 'SYSTEM') return;

    if (
      item.method === 'CASH' &&
      (item.status === 'PENDING' || item.status === 'PROCESSING') &&
      !item.cashAutoValidated &&
      item.memberUserUid !== userUid
    ) {
      openCashProof(item);
      return;
    }

    navigationRef.navigate('PaymentStatusScreen', {
      paymentUid: item.uid,
      tontineUid: item.tontineUid,
      tontineName: item.tontineName,
      amount: item.totalPaid || item.amount,
      method: item.method,
      initialStatus:
        item.status === 'PENDING' ||
        item.status === 'PROCESSING' ||
        item.status === 'COMPLETED' ||
        item.status === 'FAILED' ||
        item.status === 'REFUNDED'
          ? item.status
          : undefined,
    });
  }, [openCashProof, userUid]);

  const openPaymentFlow = useCallback(() => {
    if (!nextPaymentForUi || !navigationRef.isReady()) return;
    navigationRef.navigate('PaymentScreen', {
      cycleUid: nextPaymentForUi.cycleUid,
      tontineUid: nextPaymentForUi.tontineUid,
      tontineName: nextPaymentForUi.tontineName,
      baseAmount: nextPaymentForUi.amountRemaining ?? nextPaymentForUi.amountDue,
      penaltyAmount: nextPaymentForUi.penaltyAmount,
      penaltyDays: nextPaymentForUi.daysLate,
      cycleNumber: nextPaymentForUi.cycleNumber,
    });
  }, [nextPaymentForUi]);

  const followCurrentPayment = useCallback(() => {
    if (nextPaymentActionItem) {
      openPaymentStatus(nextPaymentActionItem);
    }
  }, [nextPaymentActionItem, openPaymentStatus]);

  const confirmApprove = useCallback(
    (row: OrganizerCashPendingAction) => {
      Alert.alert(
        'Valider le paiement',
        `Confirmer ${formatFcfa(row.amount)} en especes pour ${row.memberName} ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Valider',
            onPress: () =>
              validateMutation.mutate({ paymentUid: row.paymentUid, action: 'APPROVE' }),
          },
        ]
      );
    },
    [validateMutation]
  );

  const startReject = useCallback((row: OrganizerCashPendingAction) => {
    setCashDetail(null);
    setRejectTarget(row);
    setRejectReason('');
  }, []);

  const submitReject = useCallback(() => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      Alert.alert('Motif requis', 'Indiquez la raison du refus.');
      return;
    }
    validateMutation.mutate({
      paymentUid: rejectTarget.paymentUid,
      action: 'REJECT',
      reason: rejectReason.trim(),
    });
  }, [rejectTarget, rejectReason, validateMutation]);

  const onSortApply = useCallback((field: HistorySortField, order: 'asc' | 'desc') => {
    setSortField(field);
    setSortOrder(order);
  }, []);

  const renderHistoryItem = useCallback(
    ({ item }: { item: PaymentHistoryListItemVm }) => {
      const isCashProofAction =
        item.method === 'CASH' &&
        (item.status === 'PENDING' || item.status === 'PROCESSING') &&
        !item.cashAutoValidated &&
        item.memberUserUid !== userUid;
      const isTraceablePayment =
        !isCashProofAction &&
        item.method !== 'SYSTEM' &&
        (item.status === 'PENDING' || item.status === 'PROCESSING');

      return (
        <PaymentHistoryCard
          item={item}
          currentUserUid={userUid}
          onPressDetails={() => openTontine(item.tontineUid)}
          onPressReceiptSummary={() => setReceiptItem(item)}
          primaryActionLabel={
            isCashProofAction
              ? 'Soumettre la preuve'
              : isTraceablePayment
                ? 'Suivre'
                : undefined
          }
          onPressPrimaryAction={
            isCashProofAction
              ? () => openCashProof(item)
              : isTraceablePayment
                ? () => openPaymentStatus(item)
                : undefined
          }
        />
      );
    },
    [openCashProof, openPaymentStatus, openTontine, userUid]
  );

  const renderCashItem = useCallback(
    ({ item }: { item: OrganizerCashPendingAction }) => {
      const isBusy = actioningPaymentUid === item.paymentUid;
      return (
        <CashOrganizerCard
          row={item}
          onPressCard={() => setCashDetail(item)}
          onValidate={() => confirmApprove(item)}
          onReject={() => startReject(item)}
          busy={isBusy}
          busyAction={isBusy ? actioningDecision : null}
        />
      );
    },
    [actioningDecision, actioningPaymentUid, confirmApprove, startReject]
  );

  const contributionsHeader = useMemo(
    () => (
      <View style={styles.headerContent}>
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Paiements</Text>
          <Text style={styles.pageSubtitle}>
            {nextPaymentForUi ? 'Prochaine cotisation a regler' : 'Historique de mes cotisations'}
          </Text>
        </View>

        {nextPaymentLoading ? (
          <SkeletonBlock width="100%" height={168} borderRadius={20} />
        ) : nextPaymentForUi ? (
          <View style={styles.nextCard}>
            <View style={styles.nextCardHeader}>
              <View style={styles.nextCardTitleWrap}>
                <Text style={styles.nextCardEyebrow}>Prochaine priorite</Text>
                <Text style={styles.nextCardTitle}>{nextPaymentForUi.tontineName}</Text>
                <Text style={styles.nextCardMeta}>Cycle {nextPaymentForUi.cycleNumber}</Text>
              </View>
              <View style={[styles.urgencyBadge, { backgroundColor: nextPaymentMeta.bg }]}>
                <Text style={[styles.urgencyBadgeText, { color: nextPaymentMeta.color }]}>
                  {nextPaymentMeta.label}
                </Text>
              </View>
            </View>

            <Text style={styles.nextCardAmount}>
              {formatFcfa(nextPaymentForUi.totalAmountDue ?? nextPaymentForUi.totalDue)}
            </Text>
            <Text style={styles.nextCardAmountHint}>Total a regler</Text>

            <View style={styles.nextCardMetrics}>
              <View style={styles.nextMetric}>
                <Text style={styles.nextMetricLabel}>Reste cotisation</Text>
                <Text style={styles.nextMetricValue}>
                  {formatFcfa(nextPaymentForUi.amountRemaining ?? nextPaymentForUi.amountDue)}
                </Text>
              </View>
              <View style={styles.nextMetric}>
                <Text style={styles.nextMetricLabel}>Penalite</Text>
                <Text
                  style={[
                    styles.nextMetricValue,
                    (nextPaymentForUi.penaltyAmount ?? 0) > 0 ? styles.nextMetricValueDanger : null,
                  ]}
                >
                  {formatFcfa(nextPaymentForUi.penaltyAmount)}
                </Text>
              </View>
              <View style={styles.nextMetric}>
                <Text style={styles.nextMetricLabel}>Echeance</Text>
                <Text style={styles.nextMetricValue}>{nextPaymentForUi.dueDate}</Text>
              </View>
            </View>

            <View style={styles.nextCardInfo}>
              <Ionicons name="information-circle-outline" size={18} color={nextPaymentMeta.color} />
              <Text style={[styles.nextCardInfoText, { color: nextPaymentMeta.color }]}>
                {nextPaymentMeta.helper}
              </Text>
            </View>

            {typeof nextPaymentForUi.amountPaid === 'number' && nextPaymentForUi.amountPaid > 0 ? (
              <View style={styles.nextCardInfo}>
                <Ionicons name="wallet-outline" size={18} color={BLUE} />
                <Text style={[styles.nextCardInfoText, { color: BLUE }]}>
                  Deja verse : {formatFcfa(nextPaymentForUi.amountPaid)}
                </Text>
              </View>
            ) : null}

            <View style={styles.nextCardActions}>
              <Pressable style={styles.nextPrimaryBtn} onPress={openPaymentFlow}>
                <Text style={styles.nextPrimaryBtnText}>Payer maintenant</Text>
              </Pressable>
              {nextPaymentActionItem ? (
                <Pressable style={styles.nextSecondaryBtn} onPress={followCurrentPayment}>
                  <Text style={styles.nextSecondaryBtnText}>Suivre le paiement</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.emptyPriorityCard}>
            <Ionicons name="checkmark-circle-outline" size={24} color={GREEN} />
            <View style={styles.emptyPriorityContent}>
              <Text style={styles.emptyPriorityTitle}>Aucune cotisation urgente</Text>
              <Text style={styles.emptyPriorityText}>
                Vous pouvez consulter votre historique et vos paiements recents ci-dessous.
              </Text>
            </View>
          </View>
        )}

        {nextPaymentErrorMessage ? (
          <View style={styles.errorBanner}>
            <Ionicons
              name={
                nextPaymentErrorValue != null &&
                classifyApiQueryError(nextPaymentErrorValue) === 'rate_limited'
                  ? 'time-outline'
                  : 'cloud-offline-outline'
              }
              size={22}
              color={RED}
            />
            <Text style={styles.errorBannerText}>{nextPaymentErrorMessage}</Text>
            <Pressable style={styles.retryBtn} onPress={() => void refetchNextPayment()}>
              <Text style={styles.retryBtnText}>Reessayer</Text>
            </Pressable>
          </View>
        ) : null}

        <PaymentSummaryGrid
          totalVersé={summary.totalVerse}
          totalPénalités={summary.totalPenalites}
          ponctualitéPct={summary.taux}
          enAttente={summary.enAttente}
          scopeHint="Indicateurs calcules sur les cotisations deja chargees dans cette vue."
        />

        <PaymentHistoryToolbar
          periodLabel={periodToolbarLabel}
          statusLabel={statusToolbarLabel}
          onOpenFilters={() => setFiltersOpen(true)}
          onSortPress={() => setSortOpen(true)}
        />

        {historyErrorMessage ? (
          <View style={styles.errorBanner}>
            <Ionicons
              name={
                historyErrorValue != null &&
                classifyApiQueryError(historyErrorValue) === 'rate_limited'
                  ? 'time-outline'
                  : 'cloud-offline-outline'
              }
              size={22}
              color={RED}
            />
            <Text style={styles.errorBannerText}>{historyErrorMessage}</Text>
            <Pressable style={styles.retryBtn} onPress={() => void refetchHistory()}>
              <Text style={styles.retryBtnText}>Reessayer</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    ),
    [
      periodToolbarLabel,
      statusToolbarLabel,
      followCurrentPayment,
      historyErrorMessage,
      historyErrorValue,
      nextPaymentForUi,
      nextPaymentActionItem,
      nextPaymentErrorMessage,
      nextPaymentErrorValue,
      nextPaymentLoading,
      nextPaymentMeta.bg,
      nextPaymentMeta.color,
      nextPaymentMeta.helper,
      nextPaymentMeta.label,
      openPaymentFlow,
      refetchHistory,
      refetchNextPayment,
      summary.enAttente,
      summary.taux,
      summary.totalPenalites,
      summary.totalVerse,
    ]
  );

  const cashListHeader = useMemo(
    () => (
      <View style={styles.headerContent}>
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Paiements</Text>
          <Text style={styles.pageSubtitle}>Validation des cotisations cash de vos tontines</Text>
        </View>

        <View style={styles.queueCard}>
          <View style={styles.queueCardHeader}>
            <View style={styles.queueTitleWrap}>
              <Text style={styles.queueTitle}>Validations espèces</Text>
              <Text style={styles.queueSubtitle}>
                {cashSummary.count === 0
                  ? 'Aucune demande en attente'
                  : `${cashSummary.count} en attente`}
              </Text>
            </View>
            {cashSummary.count > 0 ? (
              <View style={styles.cashCountBadge}>
                <Text style={styles.cashCountText}>
                  {cashSummary.count > 99 ? '99+' : cashSummary.count}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.queueMetricsRow}>
            <QueueMetric label="A valider" value={String(cashSummary.count)} />
            <QueueMetric
              label="Montant en attente"
              value={formatFcfa(cashSummary.totalAmount)}
              tone={cashSummary.totalAmount > 0 ? 'danger' : 'default'}
            />
            <QueueMetric
              label="Plus ancienne demande"
              value={formatDateTime(cashSummary.oldestSubmittedAt)}
              tone={cashSummary.oldestSubmittedAt ? 'success' : 'default'}
            />
          </View>
        </View>

        {pendingErrorMessage ? (
          <View style={styles.errorBanner}>
            <Ionicons
              name={
                pendingErrorValue != null &&
                classifyApiQueryError(pendingErrorValue) === 'rate_limited'
                  ? 'time-outline'
                  : 'cloud-offline-outline'
              }
              size={22}
              color={RED}
            />
            <Text style={styles.errorBannerText}>{pendingErrorMessage}</Text>
            <Pressable style={styles.retryBtn} onPress={() => void refetchPending()}>
              <Text style={styles.retryBtnText}>Reessayer</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    ),
    [
      cashSummary.count,
      cashSummary.oldestSubmittedAt,
      cashSummary.totalAmount,
      pendingErrorMessage,
      pendingErrorValue,
      refetchPending,
    ]
  );

  const historyEmpty = useCallback(() => {
    if (historyError && historyItems.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={64} color={RED} />
          <Text style={styles.emptyText}>
            {historyErrorMessage ?? 'Historique indisponible'}
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Ionicons name="receipt-outline" size={64} color="#8E8E93" />
        <Text style={styles.emptyText}>
          {statusFilter != null ||
          periodPreset !== 'all' ||
          methodFilter !== 'all' ||
          roleFilter !== 'all'
            ? 'Aucun paiement pour ces filtres'
            : 'Aucune cotisation enregistree'}
        </Text>
      </View>
    );
  }, [
    historyError,
    historyErrorMessage,
    historyItems.length,
    methodFilter,
    periodPreset,
    roleFilter,
    statusFilter,
  ]);

  const cashEmpty = useCallback(() => {
    if (pendingError) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="cloud-offline-outline" size={64} color={RED} />
          <Text style={styles.emptyText}>
            {pendingErrorMessage ?? 'Impossible de charger les demandes.'}
          </Text>
          <Pressable style={styles.retryBtn} onPress={() => void refetchPending()}>
            <Text style={styles.retryBtnText}>Reessayer</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Ionicons name="checkmark-done-outline" size={64} color={GREEN} />
        <Text style={styles.emptyText}>Aucune validation especes en attente</Text>
      </View>
    );
  }, [pendingError, pendingErrorMessage, refetchPending]);

  const footerLoader = useCallback(
    () =>
      isFetchingNextPage ? (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={GREEN} />
        </View>
      ) : null,
    [isFetchingNextPage]
  );

  if (showHistorySkeleton) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.skeletonContent}>
          <SkeletonBlock width="70%" height={28} borderRadius={8} />
          <SkeletonBlock width="58%" height={18} borderRadius={8} />
          <SkeletonBlock width="100%" height={168} borderRadius={20} />
          <SkeletonBlock width="100%" height={128} borderRadius={16} />
          <SkeletonBlock width="100%" height={136} borderRadius={16} />
          <SkeletonBlock width="100%" height={136} borderRadius={16} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {hasOrganizerRoleInTontines ? (
        <PaymentsSegmentedControl value={segment} onChange={setSegment} />
      ) : null}

      {segment === 'contributions' || !hasOrganizerRoleInTontines ? (
        <SectionList
          sections={contributionsSections}
          keyExtractor={(item) => item.uid}
          renderItem={renderHistoryItem}
          renderSectionHeader={({ section }) => (
            <SectionHeading title={section.title} subtitle={section.subtitle} />
          )}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={contributionsHeader}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isFetching || nextPaymentFetching || tontinesFetching}
              onRefresh={refreshContributions}
              tintColor={GREEN}
            />
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={historyEmpty}
          ListFooterComponent={footerLoader}
        />
      ) : (
        <SectionList
          sections={cashSections}
          keyExtractor={(item) => item.paymentUid}
          renderItem={renderCashItem}
          renderSectionHeader={({ section }) => (
            <View style={styles.groupHeader}>
              <Text style={styles.groupTitle}>{section.group.tontineName}</Text>
              <Text style={styles.groupSubtitle}>
                {section.group.count} demande(s) · {formatFcfa(section.group.totalAmount)}
              </Text>
            </View>
          )}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={cashListHeader}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={pendingLoading || pendingFetching}
              onRefresh={refreshCashValidations}
              tintColor={GREEN}
            />
          }
          ListEmptyComponent={
            pendingLoading && cashSections.length === 0 ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="large" color={GREEN} />
              </View>
            ) : (
              cashEmpty
            )
          }
        />
      )}

      <PaymentFiltersModal
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        periodPreset={periodPreset}
        customFrom={customFrom}
        customTo={customTo}
        statusFilter={statusFilter}
        methodFilter={methodFilter}
        roleFilter={roleFilter}
        onApply={(p) => {
          setPeriodPreset(p.periodPreset);
          setCustomFrom(p.customFrom);
          setCustomTo(p.customTo);
          setStatusFilter(p.statusFilter);
          setMethodFilter(p.methodFilter);
          setRoleFilter(p.roleFilter);
        }}
      />

      <PaymentSortModal
        visible={sortOpen}
        onClose={() => setSortOpen(false)}
        sortField={sortField}
        sortOrder={sortOrder}
        onApply={onSortApply}
      />

      <PaymentReceiptSummaryModal
        visible={receiptItem != null}
        onClose={() => setReceiptItem(null)}
        item={receiptItem}
      />

      <CashOrganizerDetailModal
        visible={cashDetail != null}
        onClose={() => {
          if (!validateMutation.isPending) {
            setCashDetail(null);
          }
        }}
        row={cashDetail}
        onValidate={() => {
          if (cashDetail) confirmApprove(cashDetail);
        }}
        onReject={() => {
          if (cashDetail) startReject(cashDetail);
        }}
        busy={validateMutation.isPending}
        busyAction={
          cashDetail != null && actioningPaymentUid === cashDetail.paymentUid
            ? actioningDecision
            : null
        }
      />

      <Modal visible={rejectTarget != null} transparent animationType="fade">
        <View style={styles.rejectBackdrop}>
          <View style={styles.rejectBox}>
            <Text style={styles.rejectTitle}>Motif du refus</Text>
            <TextInput
              style={styles.rejectInput}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Ex : montant incorrect, recu illisible..."
              placeholderTextColor="#9CA3AF"
              multiline
            />
            <View style={styles.rejectRow}>
              <Pressable
                style={styles.rejectCancel}
                disabled={validateMutation.isPending}
                onPress={() => {
                  setRejectTarget(null);
                  setRejectReason('');
                }}
              >
                <Text style={styles.rejectCancelText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={styles.rejectOk}
                onPress={submitReject}
                disabled={validateMutation.isPending}
              >
                {validateMutation.isPending && actioningDecision === 'REJECT' ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.rejectOkText}>Confirmer le refus</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    flexGrow: 1,
  },
  headerContent: {
    paddingTop: 20,
    gap: 12,
    marginBottom: 8,
  },
  pageHeader: {
    gap: 4,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  pageSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },
  nextCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  nextCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  nextCardTitleWrap: {
    flex: 1,
    gap: 4,
  },
  nextCardEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: GREEN,
    textTransform: 'uppercase',
  },
  nextCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  nextCardMeta: {
    fontSize: 13,
    color: '#6B7280',
  },
  urgencyBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  urgencyBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  nextCardAmount: {
    fontSize: 30,
    fontWeight: '900',
    color: GREEN,
  },
  nextCardAmountHint: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: -8,
  },
  nextCardMetrics: {
    flexDirection: 'row',
    gap: 12,
  },
  nextMetric: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  nextMetricLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  nextMetricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  nextMetricValueDanger: {
    color: RED,
  },
  nextCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nextCardInfoText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  nextCardActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  nextPrimaryBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextPrimaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  nextSecondaryBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextSecondaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  emptyPriorityCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  emptyPriorityContent: {
    flex: 1,
    gap: 4,
  },
  emptyPriorityTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  emptyPriorityText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  queueCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  queueCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  queueTitleWrap: {
    flex: 1,
    gap: 2,
  },
  queueTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  queueSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  queueMetricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  queueMetric: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  queueMetricLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  queueMetricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  queueMetricValueDanger: {
    color: RED,
  },
  queueMetricValueSuccess: {
    color: GREEN,
  },
  sectionHeading: {
    paddingTop: 12,
    paddingBottom: 6,
    gap: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  groupHeader: {
    backgroundColor: '#EEF6F1',
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    marginBottom: 6,
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  groupSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: '#4B5563',
  },
  errorBanner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
  },
  errorBannerText: {
    flex: 1,
    minWidth: 120,
    fontSize: 14,
    color: '#991B1B',
    fontWeight: '600',
  },
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: RED,
  },
  retryBtnText: {
    color: RED,
    fontWeight: '700',
  },
  cashCountBadge: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  cashCountText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  footerLoader: {
    padding: 16,
    alignItems: 'center',
  },
  skeletonContent: {
    padding: 20,
    gap: 12,
  },
  rejectBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  rejectBox: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
  },
  rejectTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  rejectInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  rejectRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 16,
  },
  rejectCancel: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  rejectCancelText: {
    color: '#6B7280',
    fontWeight: '600',
  },
  rejectOk: {
    backgroundColor: RED,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  rejectOkText: {
    color: '#FFF',
    fontWeight: '700',
  },
});
