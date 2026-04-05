/**
 * Onglet Dashboard — collecte, paiement, bénéficiaire, validations espèces.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { validateCashPayment } from '@/api/cashPaymentApi';
import { useTontineDetails } from '@/hooks/useTontineDetails';
import { useTontineMembers } from '@/hooks/useTontineMembers';
import { useNextPayment } from '@/hooks/useNextPayment';
import { useTontines } from '@/hooks/useTontines';
import { usePayoutOrganizerState } from '@/hooks/usePayoutOrganizerState';
import { useOrganizerCashPendingForTontine } from '@/hooks/useOrganizerCashPendingForTontine';
import { withNextPaymentPenaltyWaivedForPendingCashValidation } from '@/utils/nextPaymentPenaltyWaive';
import { useContributionHistory } from '@/hooks/useContributionHistory';
import { resolveCurrentCycleMetrics } from '@/utils/currentCycleMetrics';
import { resolveOrganizerPayoutNavigationData } from '@/utils/organizerPayoutNavigation';
import {
  deriveTontinePaymentUiState,
  resolveTontinePaymentContext,
} from '@/utils/tontinePaymentState';
import { parseApiError } from '@/api/errors/errorHandler';
import { getErrorMessageForCode } from '@/api/errors';
import { logger } from '@/utils/logger';
import { PaymentModal } from '@/components/dashboard/modals/PaymentModal';
import { CashValidationCard } from '@/components/payments/CashValidationCard';
import { MemberPaymentStatusList } from '@/components/tontines/MemberPaymentStatusList';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';
import {
  formatFcfa,
  formatFcfaAmount,
  formatDateLong,
  toProgressPct,
} from '@/utils/formatters';
import { getInitials, hashToColor } from '@/utils/avatarUtils';
import type { RootStackParamList } from '@/navigation/types';
import { selectUserUid } from '@/store/authSlice';
import type { RootState } from '@/store/store';
import Svg, { Path } from 'react-native-svg';
import type { CyclePayoutPaymentMethod } from '@/types/cyclePayout';

const PAYOUT_METHODS: readonly CyclePayoutPaymentMethod[] = [
  'ORANGE_MONEY',
  'TELECEL_MONEY',
  'CASH',
] as const;

function payoutMethodLabel(m: CyclePayoutPaymentMethod): string {
  if (m === 'ORANGE_MONEY') return 'Orange Money';
  if (m === 'TELECEL_MONEY') return 'Telecel Money';
  return 'Espèces';
}

export interface DashboardTabProps {
  uid: string;
  isCreator: boolean;
  /** Bascule l’onglet Membres (ex. depuis « Voir les N autres »). */
  onGoToMembersTab?: () => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  uid,
  isCreator,
  onGoToMembersTab,
}) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const userUid = useSelector((s: RootState) => selectUserUid(s));
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payoutModalVisible, setPayoutModalVisible] = useState(false);
  const [payoutModalMethod, setPayoutModalMethod] =
    useState<CyclePayoutPaymentMethod>('ORANGE_MONEY');
  const [busyCashUid, setBusyCashUid] = useState<string | null>(null);
  const payoutLock = useRef(false);

  const {
    tontine,
    currentCycle,
    isLoading: loadingDetail,
    refetch: refetchDetail,
  } = useTontineDetails(uid);
  const { members, refetch: refetchMembers } = useTontineMembers(uid);
  const { tontines: myTontines } = useTontines();
  const { nextPayment } = useNextPayment();
  const { items: cashHistoryWaive } = useContributionHistory(undefined, {
    methodFilter: 'CASH',
    sortField: 'date',
    sortOrder: 'desc',
  });
  const nextPaymentAdj = useMemo(
    () =>
      withNextPaymentPenaltyWaivedForPendingCashValidation(
        nextPayment,
        cashHistoryWaive
      ),
    [nextPayment, cashHistoryWaive]
  );

  const listItem = useMemo(
    () => myTontines.find((t) => t.uid === uid) ?? null,
    [myTontines, uid]
  );

  const { items: cashItems, refetch: refetchCash } =
    useOrganizerCashPendingForTontine(uid, isCreator);

  const payoutStateQ = usePayoutOrganizerState(currentCycle?.uid, {
    enabled: Boolean(isCreator && currentCycle?.uid),
  });

  const metrics = useMemo(
    () =>
      resolveCurrentCycleMetrics({
        currentCycle,
        amountPerShare: tontine?.amountPerShare ?? 0,
        members,
      }),
    [currentCycle, tontine?.amountPerShare, members]
  );

  /** Versement cagnotte : strictement selon l’API (collecte 100 % + flag serveur). */
  const showPayoutCta = useMemo(
    () =>
      isCreator &&
      currentCycle?.status === 'ACTIVE' &&
      payoutStateQ.data?.canOrganizerTriggerPayout === true &&
      payoutStateQ.data?.isCollectionComplete === true,
    [isCreator, currentCycle?.status, payoutStateQ.data]
  );

  const beneficiaryMember = useMemo(() => {
    if (!currentCycle?.beneficiaryMembershipUid) return null;
    return members.find((m) => m.uid === currentCycle.beneficiaryMembershipUid) ?? null;
  }, [currentCycle, members]);

  const isMyTurnNow = Boolean(
    userUid &&
      beneficiaryMember &&
      beneficiaryMember.userUid === userUid &&
      currentCycle?.status === 'ACTIVE'
  );

  const paymentCtx = useMemo(() => {
    if (!listItem) return null;
    return resolveTontinePaymentContext(listItem);
  }, [listItem]);

  const paymentUi = useMemo(
    () => (listItem != null ? deriveTontinePaymentUiState(listItem) : null),
    [listItem]
  );

  const hasPaymentDue = useMemo(() => {
    if (nextPaymentAdj?.tontineUid === uid) {
      const total = nextPaymentAdj.totalDue ?? nextPaymentAdj.totalAmountDue ?? 0;
      return total > 0;
    }
    return paymentUi?.needsPaymentAttention === true;
  }, [nextPaymentAdj, uid, paymentUi]);

  const totalAmountDue = useMemo(() => {
    if (nextPaymentAdj?.tontineUid === uid) {
      return Math.round(
        nextPaymentAdj.totalDue ?? nextPaymentAdj.totalAmountDue ?? 0
      );
    }
    if (paymentCtx != null && paymentUi?.needsPaymentAttention === true) {
      return Math.round(paymentCtx.totalDue ?? 0);
    }
    return 0;
  }, [nextPaymentAdj, uid, paymentCtx, paymentUi]);

  const penaltyAmount = useMemo(() => {
    if (nextPaymentAdj?.tontineUid === uid) {
      return Math.round(nextPaymentAdj.penaltyAmount ?? 0);
    }
    return Math.round(paymentCtx?.penaltyAmount ?? 0);
  }, [nextPaymentAdj, uid, paymentCtx]);

  const baseAmount = useMemo(() => {
    if (nextPaymentAdj?.tontineUid === uid) {
      return Math.round(nextPaymentAdj.amountDue ?? 0);
    }
    return Math.max(0, totalAmountDue - penaltyAmount);
  }, [nextPaymentAdj, uid, totalAmountDue, penaltyAmount]);

  const urgency = useMemo(() => {
    if (paymentUi?.uiStatus === 'OVERDUE') return 'OVERDUE' as const;
    return 'DUE' as const;
  }, [paymentUi]);

  const cycleLabel = useMemo(() => {
    const n = currentCycle?.cycleNumber ?? 0;
    const freq = tontine?.frequency;
    const f =
      freq === 'MONTHLY'
        ? 'Mensuelle'
        : freq === 'WEEKLY'
          ? 'Hebdo'
          : freq === 'DAILY'
            ? 'Quotidienne'
            : freq === 'BIWEEKLY'
              ? 'Bimensuelle'
              : '';
    return f ? `Cycle ${n} · ${f}` : `Cycle ${n}`;
  }, [currentCycle, tontine]);

  const daysToExpected = useMemo(() => {
    if (!currentCycle?.expectedDate) return null;
    const d = new Date(currentCycle.expectedDate);
    if (Number.isNaN(d.getTime())) return null;
    return Math.ceil((d.getTime() - Date.now()) / 86400000);
  }, [currentCycle]);

  const overdueDaysHint = useMemo(() => {
    if (daysToExpected == null) return null;
    return daysToExpected < 0 ? Math.abs(daysToExpected) : null;
  }, [daysToExpected]);

  const activeMembersCount = useMemo(
    () => members.filter((m) => m.membershipStatus === 'ACTIVE').length,
    [members]
  );

  const onRefresh = useCallback(() => {
    void refetchDetail();
    void refetchMembers();
    void payoutStateQ.refetch();
    void refetchCash();
  }, [refetchDetail, refetchMembers, payoutStateQ, refetchCash]);

  const handlePayoutPress = useCallback(
    async (paymentMethod?: CyclePayoutPaymentMethod) => {
      if (!currentCycle || !tontine || payoutLock.current) return;
      payoutLock.current = true;
      try {
        const result = await resolveOrganizerPayoutNavigationData(currentCycle.uid, {
          kind: 'detail',
          tontineUid: uid,
          tontineName: tontine.name,
          currentCycle: {
            uid: currentCycle.uid,
            cycleNumber: currentCycle.cycleNumber,
            beneficiaryMembershipUid: currentCycle.beneficiaryMembershipUid,
          },
          members,
        });
        if (!result.ok) {
          Alert.alert(
            'Versement',
            "Le versement n'est pas possible pour l'instant."
          );
          return;
        }
        navigation.navigate('CyclePayoutScreen', {
          ...result.payload,
          ...(paymentMethod ? { initialPaymentMethod: paymentMethod } : {}),
        });
      } catch (err: unknown) {
        const apiError = parseApiError(err);
        Alert.alert('Erreur', getErrorMessageForCode(apiError, 'fr'));
      } finally {
        payoutLock.current = false;
      }
    },
    [currentCycle, tontine, uid, members, navigation]
  );

  const onConfirmPayoutModal = useCallback(() => {
    setPayoutModalVisible(false);
    void handlePayoutPress(payoutModalMethod);
  }, [handlePayoutPress, payoutModalMethod]);

  const cashMutation = useMutation({
    mutationFn: (vars: {
      paymentUid: string;
      action: 'APPROVE' | 'REJECT';
      rejectionReason?: string;
    }) =>
      validateCashPayment(
        vars.paymentUid,
        vars.action,
        vars.rejectionReason
      ),
    onMutate: (v) => setBusyCashUid(v.paymentUid),
    onSettled: () => setBusyCashUid(null),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['payments', 'cash', 'organizer', 'pending-actions'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['payments', 'cash', 'organizer', 'pending-count'],
      });
      void refetchCash();
    },
    onError: (err: unknown) => {
      logger.error('[DashboardTab] cash validation', err);
      Alert.alert('Erreur', "L'action n'a pas pu être enregistrée.");
    },
  });

  const refreshing = loadingDetail && !tontine;

  if (!tontine) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (tontine.status === 'COMPLETED') {
    const punct =
      listItem?.tontinePunctualityRate != null &&
      Number.isFinite(listItem.tontinePunctualityRate)
        ? `${Math.round(listItem.tontinePunctualityRate)} %`
        : '—';
    const endIso = tontine.closedAt ?? undefined;
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollInner}
        refreshControl={
          <RefreshControl
            refreshing={loadingDetail}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        <Text style={styles.sectionTitle}>Tontine terminée</Text>
        <View style={styles.card}>
          <Text style={styles.recapLine}>
            {tontine.startDate
              ? `Début : ${formatDateLong(String(tontine.startDate).split('T')[0])}`
              : 'Début : —'}
          </Text>
          {endIso ? (
            <Text style={styles.recapLine}>
              Fin : {formatDateLong(String(endIso).split('T')[0])}
            </Text>
          ) : (
            <Text style={styles.recapLine}>Fin : —</Text>
          )}
          <Text style={styles.recapLine}>
            {tontine.totalCycles} cycle{tontine.totalCycles > 1 ? 's' : ''} · Ponctualité :{' '}
            {punct}
          </Text>
          <Text style={styles.recapHint}>
            Historique des paiements disponible dans l’onglet Paiements (lecture seule).
          </Text>
        </View>
      </ScrollView>
    );
  }

  const collected = Math.round(
    payoutStateQ.data?.grossCollectedAmount ?? metrics.collected
  );
  const expected = Math.round(
    currentCycle?.totalExpected ??
      currentCycle?.totalAmount ??
      metrics.expected
  );
  const collectPct =
    expected > 0
      ? Math.min(100, Math.round((collected / expected) * 100))
      : toProgressPct(currentCycle?.collectionProgress);

  const netPayout = Math.round(
    payoutStateQ.data?.netPayoutAmount ??
      metrics.beneficiaryNetAmount ??
      0
  );

  const beneficiaryDisplayName =
    payoutStateQ.data?.beneficiaryName ?? beneficiaryMember?.fullName ?? '—';

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollInner}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        <Text style={styles.sectionTitle}>Collecte du cycle courant</Text>
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>
              Collecte du cycle {currentCycle?.cycleNumber ?? '—'}
            </Text>
          </View>
          <View style={styles.progressRow}>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${collectPct}%` }]} />
            </View>
          </View>
          <Text style={styles.muted}>
            {formatFcfaAmount(collected)} / {formatFcfaAmount(expected)} FCFA
          </Text>
          {daysToExpected != null ? (
            <Text style={styles.mutedSmall}>
              {daysToExpected >= 0
                ? `Échéance : dans ${daysToExpected} j`
                : `Échéance dépassée de ${Math.abs(daysToExpected)} j`}
            </Text>
          ) : null}
          {showPayoutCta ? (
            <View style={styles.payoutCtaWrap}>
              <TouchableOpacity
                style={styles.payoutCta}
                onPress={() => setPayoutModalVisible(true)}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel={`Payer la cagnotte de ${formatFcfa(netPayout)} à ${beneficiaryDisplayName}`}
              >
                <View style={styles.flex1}>
                  <Text style={styles.payoutCtaTitle}>Payer la cagnotte</Text>
                  <Text style={styles.payoutCtaSub}>
                    Bénéficiaire : {beneficiaryDisplayName ?? '—'}
                  </Text>
                </View>
                <View style={styles.payoutAmtCol}>
                  <Text style={styles.payoutAmtNum}>
                    {formatFcfaAmount(netPayout)}
                  </Text>
                  <Text style={styles.payoutAmtUnit}>FCFA</Text>
                </View>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M9 18l6-6-6-6"
                    stroke="rgba(255,255,255,0.85)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <MemberPaymentStatusList
          members={members}
          beneficiaryMembershipUid={currentCycle?.beneficiaryMembershipUid}
          overdueDaysHint={overdueDaysHint}
          onPressViewAll={
            activeMembersCount > 3 && onGoToMembersTab
              ? onGoToMembersTab
              : undefined
          }
        />

        <Text style={styles.sectionTitle}>Mon statut de paiement</Text>
        {hasPaymentDue && currentCycle ? (
          <View style={styles.card}>
            <View style={styles.payRow}>
              <View style={styles.flex1}>
                <Text
                  style={[
                    styles.statusPill,
                    { color: urgency === 'OVERDUE' ? COLORS.danger : COLORS.secondaryText },
                  ]}
                >
                  {urgency === 'OVERDUE' ? 'EN RETARD' : 'À PAYER'}
                </Text>
                <Text style={styles.payAmt}>
                  {formatFcfaAmount(totalAmountDue)} à payer
                </Text>
                {penaltyAmount > 0 ? (
                  <Text style={styles.penaltyHint}>
                    dont {formatFcfaAmount(penaltyAmount)} de pénalité
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => setPaymentOpen(true)}
                style={[
                  styles.payBtn,
                  { backgroundColor: urgency === 'OVERDUE' ? COLORS.danger : COLORS.primary },
                ]}
              >
                <Text style={styles.payBtnText}>Payer</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.paidRow}>
              <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
              <Text style={styles.paidText}>
                Cotisation du cycle {currentCycle?.cycleNumber ?? '—'} payée ✓
              </Text>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Bénéficiaire</Text>
        <View style={styles.card}>
          <View style={styles.benRow}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: hashToColor(beneficiaryDisplayName) },
              ]}
            >
              <Text style={styles.avatarTxt}>
                {getInitials(beneficiaryDisplayName)}
              </Text>
            </View>
            <View style={styles.flex1}>
              <Text style={styles.benName}>{beneficiaryDisplayName}</Text>
              <Text style={styles.muted}>
                Reçoit {formatFcfaAmount(netPayout)} ce cycle
              </Text>
            </View>
            <Text style={styles.pct}>{collectPct}%</Text>
          </View>
          {isMyTurnNow ? (
            <View style={styles.myTurnBanner}>
              <Text style={styles.myTurnBannerText}>
                C'est votre tour ! · {formatFcfaAmount(netPayout)}
              </Text>
            </View>
          ) : null}
        </View>

        {isCreator && cashItems.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Validations espèces en attente</Text>
            <View style={styles.amberCard}>
              {cashItems.slice(0, 3).map((item) => (
                <CashValidationCard
                  key={item.paymentUid}
                  item={item}
                  onApprove={(paymentUid) =>
                    cashMutation.mutate({ paymentUid, action: 'APPROVE' })
                  }
                  onReject={(paymentUid, reason) =>
                    cashMutation.mutate({
                      paymentUid,
                      action: 'REJECT',
                      rejectionReason: reason,
                    })
                  }
                  isApproving={busyCashUid === item.paymentUid && cashMutation.isPending}
                  isRejecting={busyCashUid === item.paymentUid && cashMutation.isPending}
                />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      <Modal
        visible={payoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPayoutModalVisible(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={[StyleSheet.absoluteFill, styles.modalDim]}
            onPress={() => setPayoutModalVisible(false)}
            accessibilityLabel="Fermer"
          />
          <View style={styles.modalCard} pointerEvents="box-none">
            <Text style={styles.modalTitle}>
              Verser {formatFcfa(netPayout)} à {beneficiaryDisplayName} ?
            </Text>
            <Text style={styles.modalSub}>Méthode de versement</Text>
            {PAYOUT_METHODS.map((m) => (
              <Pressable
                key={m}
                onPress={() => setPayoutModalMethod(m)}
                style={[
                  styles.methodRow,
                  payoutModalMethod === m && styles.methodRowOn,
                ]}
              >
                <Text
                  style={[
                    styles.methodRowText,
                    payoutModalMethod === m && styles.methodRowTextOn,
                  ]}
                >
                  {payoutMethodLabel(m)}
                </Text>
              </Pressable>
            ))}
            <TouchableOpacity
              style={styles.modalConfirm}
              onPress={onConfirmPayoutModal}
              activeOpacity={0.9}
            >
              <Text style={styles.modalConfirmText}>Confirmer avec PIN</Text>
            </TouchableOpacity>
            <Pressable
              onPress={() => setPayoutModalVisible(false)}
              style={styles.modalCancel}
            >
              <Text style={styles.modalCancelText}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {currentCycle && hasPaymentDue ? (
        <PaymentModal
          visible={paymentOpen}
          onClose={() => setPaymentOpen(false)}
          tontineName={tontine.name}
          cycleLabel={cycleLabel}
          totalAmountDue={totalAmountDue}
          penaltyAmount={penaltyAmount}
          cycleUid={currentCycle.uid}
          tontineUid={uid}
          cycleNumber={currentCycle.cycleNumber}
          paymentBaseAmount={baseAmount}
          urgency={urgency}
          onPaymentSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ['nextPayment'] });
            void queryClient.invalidateQueries({ queryKey: ['tontines'] });
          }}
        />
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollInner: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray500,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    padding: 14,
    marginBottom: 16,
  },
  recapLine: {
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 8,
    lineHeight: 20,
  },
  recapHint: {
    fontSize: 12,
    color: COLORS.gray500,
    marginTop: 4,
    lineHeight: 18,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  progressRow: { marginBottom: 6 },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primaryLight,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: COLORS.primary },
  muted: { fontSize: 11, color: COLORS.gray500, marginTop: 4 },
  mutedSmall: { fontSize: 10, color: COLORS.gray500, marginTop: 4 },
  payoutCtaWrap: { marginHorizontal: 14, marginBottom: 12, marginTop: 4 },
  payoutCta: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    padding: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  payoutCtaTitle: { fontSize: 13, fontWeight: '500', color: COLORS.white },
  payoutCtaSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  payoutAmtCol: { alignItems: 'flex-end' },
  payoutAmtNum: { fontSize: 16, fontWeight: '500', color: COLORS.white },
  payoutAmtUnit: { fontSize: 9, color: 'rgba(255,255,255,0.7)' },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalDim: { backgroundColor: 'rgba(0,0,0,0.45)' },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 18,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    zIndex: 2,
    elevation: 4,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalSub: {
    fontSize: 12,
    color: COLORS.gray500,
    marginBottom: 8,
    fontWeight: '500',
  },
  methodRow: {
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  methodRowOn: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  methodRowText: { fontSize: 14, color: COLORS.textPrimary, textAlign: 'center' },
  methodRowTextOn: { fontWeight: '600', color: COLORS.primaryDark },
  modalConfirm: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  modalConfirmText: { color: COLORS.white, fontWeight: '600', fontSize: 15 },
  modalCancel: { paddingVertical: 12, alignItems: 'center' },
  modalCancelText: { color: COLORS.gray500, fontSize: 14 },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  flex1: { flex: 1, minWidth: 0 },
  statusPill: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  payAmt: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  penaltyHint: { fontSize: 11, color: COLORS.secondaryText, marginTop: 2 },
  payBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  payBtnText: { color: COLORS.white, fontWeight: '600', fontSize: 14 },
  paidRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  paidText: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '500' },
  benRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { fontSize: 14, fontWeight: '500', color: COLORS.white },
  benName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  pct: { fontSize: 16, fontWeight: '600', color: COLORS.primary },
  myTurnBanner: {
    marginTop: 12,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
    padding: 10,
  },
  myTurnBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primaryDark,
    textAlign: 'center',
  },
  amberCard: {
    backgroundColor: COLORS.secondaryBg,
    borderRadius: RADIUS.lg,
    padding: 8,
    borderWidth: 0.5,
    borderColor: COLORS.secondaryText,
  },
});
