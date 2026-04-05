/**
 * Carte héro accueil — carousel horizontal (pages) + points de pagination.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Alert,
  FlatList,
  useWindowDimensions,
  AccessibilityInfo,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import Svg, { Path } from 'react-native-svg';
import { rejectInvitation } from '@/api/tontinesApi';
import { navigationRef } from '@/navigation/navigationRef';
import { PaymentModal } from '@/components/dashboard/modals/PaymentModal';
import { CashValidationModal } from '@/components/dashboard/modals/CashValidationModal';
import { SkeletonPulse } from '@/components/common/SkeletonPulse';
import { COLORS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/spacing';
import { formatFcfa, formatFcfaAmount } from '@/utils/formatters';
import { logger } from '@/utils/logger';
import { selectUserUid } from '@/store/authSlice';
import type { RootState } from '@/store/store';
import type { HeroCardPage as HeroCardPageModel } from '@/types/dashboard.types';

const PAYOUT_BLUE = '#185FA5';
const PAYOUT_BLUE_BORDER = '#B5D4F4';
const HORIZONTAL_MARGIN = 32;
const GAP = 10;

export interface HomeHeroCardProps {
  pages: HeroCardPageModel[];
  isLoading: boolean;
  onPaymentInitiated: (
    tontineUid: string,
    cycleUid: string,
    opts?: { cycleLabel?: string; amount?: number }
  ) => void;
}

function navigateTontineDetail(uid: string | undefined, isCreator: boolean): void {
  if (!uid || !navigationRef.isReady()) return;
  navigationRef.navigate('TontineDetails', { tontineUid: uid, isCreator });
}

function navigateTontineRotation(uid: string | undefined): void {
  if (!uid || !navigationRef.isReady()) return;
  navigationRef.navigate('TontineRotation', { tontineUid: uid });
}

function navigateCashValidation(): void {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate('MainTabs', {
    screen: 'Payments',
    params: { initialSegment: 'cashValidations' },
  });
}

function navigateContract(
  uid: string | undefined,
  name: string | undefined,
  mode: 'INVITE_ACCEPT' | 'JOIN_REQUEST'
): void {
  if (!uid || !navigationRef.isReady()) return;
  navigationRef.navigate('TontineContractSignature', {
    mode,
    tontineUid: uid,
    tontineName: name,
  });
}

function PaymentDueActionStrip(props: {
  variant: 'OVERDUE' | 'DUE';
  tontineUid?: string;
  isCreator?: boolean;
  onPayerMaintenant: () => void;
}): React.ReactElement {
  const accent =
    props.variant === 'OVERDUE' ? COLORS.dangerText : COLORS.primary;
  return (
    <View style={styles.paymentStripRow}>
      <Pressable
        onPress={props.onPayerMaintenant}
        style={({ pressed }) => [
          styles.paymentStripCell,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Payer maintenant"
      >
        <Text
          style={[styles.paymentStripLabel, { color: accent }]}
          numberOfLines={1}
        >
          Payer maintenant
        </Text>
      </Pressable>
      <View style={styles.paymentStripSep} />
      <Pressable
        onPress={() => navigateTontineRotation(props.tontineUid)}
        style={({ pressed }) => [
          styles.paymentStripCell,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Voir la rotation"
      >
        <Text
          style={[styles.paymentStripLabel, { color: COLORS.gray700 }]}
          numberOfLines={1}
        >
          Rotation
        </Text>
      </Pressable>
      <View style={styles.paymentStripSep} />
      <Pressable
        onPress={() =>
          navigateTontineDetail(props.tontineUid, props.isCreator === true)
        }
        style={({ pressed }) => [
          styles.paymentStripCell,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Détails de la tontine"
      >
        <Text
          style={[styles.paymentStripLabel, { color: COLORS.gray700 }]}
          numberOfLines={1}
        >
          Détails
        </Text>
      </Pressable>
    </View>
  );
}

function CashPendingListStrip(): React.ReactElement {
  return (
    <Pressable
      onPress={navigateCashValidation}
      style={({ pressed }) => [styles.cashListStrip, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Voir la liste complète des validations"
    >
      <Text style={styles.cashListStripText}>Voir liste complète →</Text>
    </Pressable>
  );
}

function buildPageLabel(
  page: HeroCardPageModel,
  activeIndex: number,
  total: number
): string {
  const n = activeIndex + 1;
  const head = `Rappel ${n} sur ${total}`;
  switch (page.variant) {
    case 'OVERDUE':
      return `${head}: Cotisation en retard pour ${page.tontineName ?? ''}`;
    case 'DUE':
      return `${head}: Paiement dû pour ${page.tontineName ?? ''}`;
    case 'PAYOUT_IN_PROGRESS':
    case 'PAYOUT_READY':
      return `${head}: Action cagnotte pour ${page.payoutTontineName ?? ''}`;
    case 'CASH_PENDING':
      return `${head}: ${page.cashPendingCount ?? 0} validations en attente`;
    case 'INVITATION_PENDING':
      return `${head}: Invitation de ${page.firstInvitationName ?? ''}`;
    case 'PAYMENT_PENDING_VALIDATION':
      return `${head}: Versement en attente pour ${page.paymentPendingTontineName ?? ''}`;
    case 'NEUTRAL':
      return 'Aucune action requise';
    default:
      return '';
  }
}

export const HomeHeroCardSkeleton: React.FC = () => (
  <View
    style={styles.wrapOuter}
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
  >
    <View style={styles.cardOuter} accessibilityRole="none">
      <View style={styles.skeletonRow}>
        <SkeletonPulse width={44} height={44} borderRadius={12} />
        <View style={styles.skeletonCenter}>
          <SkeletonPulse width={100} height={10} borderRadius={4} />
          <SkeletonPulse width={160} height={14} borderRadius={4} />
          <SkeletonPulse width={120} height={10} borderRadius={4} />
        </View>
        <View style={styles.skeletonRight}>
          <SkeletonPulse width={60} height={18} borderRadius={4} />
          <SkeletonPulse width={52} height={28} borderRadius={8} />
        </View>
      </View>
    </View>
  </View>
);

function ProgressRow(props: {
  color: string;
  pulse?: boolean;
}): React.ReactElement {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!props.pulse) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [opacity, props.pulse]);

  return (
    <View style={styles.progressTrack}>
      <Animated.View
        style={[
          styles.progressFill,
          { backgroundColor: props.color, opacity: props.pulse ? opacity : 1 },
        ]}
      />
    </View>
  );
}

function PayoutSpinnerIcon(): React.ReactElement {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 3v3M12 18v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M3 12h3M18 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"
          stroke={PAYOUT_BLUE}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

function CardInner(props: { children: React.ReactNode }): React.ReactElement {
  return <View style={styles.cardInner}>{props.children}</View>;
}

function AccordionLine(props: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  labelColor: string;
  onPress: () => void;
  showLeftSep?: boolean;
}): React.ReactElement {
  return (
    <Pressable
      onPress={props.onPress}
      style={[styles.accordionBtn, props.showLeftSep && styles.accordionSep]}
      accessibilityRole="button"
    >
      <Ionicons name={props.icon} size={14} color={props.iconColor} />
      <Text style={[styles.accordionLabel, { color: props.labelColor }]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

function PaymentPendingClockIcon(): React.ReactElement {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 8v4l3 2M12 22a10 10 0 100-20 10 10 0 000 20z"
        stroke="#185FA5"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function PaymentPendingPulseDot(): React.ReactElement {
  const pulseOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOpacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [pulseOpacity]);

  return (
    <Animated.View
      style={[
        styles.pendingDot,
        { opacity: pulseOpacity },
      ]}
    />
  );
}

function PaginationDots(props: {
  count: number;
  activeIndex: number;
  onDotPress: (i: number) => void;
}): React.ReactElement {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: props.count }).map((_, i) => (
        <Pressable
          key={i}
          onPress={() => props.onDotPress(i)}
          accessibilityLabel={`Page ${i + 1} sur ${props.count}`}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <View
            style={[
              styles.dot,
              i === props.activeIndex ? styles.dotActive : styles.dotIdle,
            ]}
          />
        </Pressable>
      ))}
    </View>
  );
}

function HeroCardPageInner(props: {
  page: HeroCardPageModel;
  onRequestPaymentModal: (page: HeroCardPageModel) => void;
  onRequestCashModal: () => void;
}): React.ReactElement {
  const { page: state } = props;

  const queryClient = useQueryClient();
  const userUid = useSelector((s: RootState) => selectUserUid(s));

  const onDeclineInvitation = useCallback(
    (tontineUid: string) => {
      Alert.alert(
        "Refuser l'invitation ?",
        "Vous ne recevrez plus de notification pour cette tontine.",
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Refuser',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                try {
                  await rejectInvitation(tontineUid);
                  if (userUid != null) {
                    await queryClient.invalidateQueries({
                      queryKey: ['tontines', userUid],
                    });
                    await queryClient.invalidateQueries({
                      queryKey: ['invitationsReceived', userUid],
                    });
                  }
                } catch (err: unknown) {
                  logger.error('[HomeHeroCard] rejectInvitation failed', {
                    tontineUid,
                    err,
                  });
                }
              })();
            },
          },
        ]
      );
    },
    [queryClient, userUid]
  );

  const primaryA11y = useMemo(() => {
    const v = state.variant;
    if (v === 'OVERDUE') {
      const amt = state.amountDue ?? 0;
      const late = state.daysLate ?? 0;
      return `Payer ${formatFcfa(amt)} pour ${state.tontineName ?? ''}, en retard de ${late} jour${late > 1 ? 's' : ''}`;
    }
    if (v === 'DUE') {
      const amt = state.amountDue ?? 0;
      const d = state.daysLate ?? 0;
      const nm = state.tontineName ?? '';
      if (d === 0) {
        return `Payer ${formatFcfa(amt)} pour ${nm}, dû aujourd'hui`;
      }
      if (d === 1) {
        return `Payer ${formatFcfa(amt)} pour ${nm}, dû demain`;
      }
      return `Payer ${formatFcfa(amt)} pour ${nm}, dû dans ${d} jours`;
    }
    if (v === 'PAYOUT_READY') {
      const amt = state.payoutAmount ?? 0;
      const ben = state.payoutBeneficiaryName ?? '—';
      return `Verser la cagnotte de ${formatFcfa(amt)} FCFA à ${ben}`;
    }
    if (v === 'CASH_PENDING') {
      const n = state.cashPendingCount ?? 0;
      return `Valider ${n} paiement${n > 1 ? 's' : ''} espèces en attente`;
    }
    if (v === 'INVITATION_PENDING') {
      return `Voir l'invitation pour ${state.firstInvitationName ?? ''}`;
    }
    if (v === 'PAYOUT_IN_PROGRESS') {
      return 'Voir les détails du versement en cours';
    }
    if (v === 'PAYMENT_PENDING_VALIDATION') {
      return `Versement en attente pour ${state.paymentPendingTontineName ?? ''}`;
    }
    return '';
  }, [state]);

  if (state.variant === 'NEUTRAL') {
    return (
      <View style={styles.cardOuter} accessibilityRole="none">
        <View style={styles.neutralRow}>
          <View style={styles.neutralIcon}>
            <Ionicons name="checkmark-circle" size={28} color="#1A6B3C" />
          </View>
          <View style={styles.neutralTextWrap}>
            <Text style={styles.neutralTitle}>Tout est sous contrôle</Text>
            <Text style={styles.neutralSub}>
              Aucune action requise · Vos tontines sont à jour
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (state.variant === 'PAYOUT_IN_PROGRESS') {
    return (
      <View style={styles.cardOuter} accessibilityRole="none">
        <CardInner>
          <View style={[styles.iconBox, { backgroundColor: COLORS.accentLight }]}>
            <PayoutSpinnerIcon />
          </View>
          <View style={styles.centerCol}>
            <Text style={[styles.eyebrow, { color: PAYOUT_BLUE }]}>
              Versement en cours…
            </Text>
            <Text style={styles.title}>Cagnotte en transit</Text>
            <Text style={styles.sub} numberOfLines={2}>
              {state.payoutTontineName} ·{' '}
              {state.payoutBeneficiaryName ?? 'Bénéficiaire'}
            </Text>
            <ProgressRow color={PAYOUT_BLUE} pulse />
          </View>
          <View style={styles.rightCol}>
            {state.payoutAmount != null && state.payoutAmount > 0 ? (
              <View style={styles.amountRow}>
                <Text style={[styles.amountLg, { color: PAYOUT_BLUE }]}>
                  {formatFcfaAmount(Math.round(state.payoutAmount))}
                </Text>
                <Text style={styles.fcfaUnit}>FCFA</Text>
              </View>
            ) : (
              <View style={{ height: 24 }} />
            )}
            <Pressable
              onPress={() =>
                navigateTontineDetail(state.payoutTontineUid, true)
              }
              style={({ pressed }) => [
                styles.btnDetails,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={primaryA11y}
            >
              <Text style={styles.btnDetailsText}>Détails</Text>
            </Pressable>
          </View>
        </CardInner>
      </View>
    );
  }

  if (state.variant === 'PAYOUT_READY') {
    return (
      <View style={styles.cardOuter} accessibilityRole="none">
        <CardInner>
          <View style={[styles.iconBox, { backgroundColor: COLORS.accentLight }]}>
            <Ionicons name="wallet-outline" size={22} color={COLORS.accentDark} />
          </View>
          <View style={styles.centerCol}>
            <Text style={[styles.eyebrow, { color: COLORS.accentDark }]}>
              Collecte complète · Action requise
            </Text>
            <Text style={styles.title}>Verser la cagnotte</Text>
            <Text style={styles.sub} numberOfLines={2}>
              {state.payoutTontineName} · Bénéficiaire :{' '}
              {state.payoutBeneficiaryName ?? '—'}
            </Text>
            <ProgressRow color={COLORS.primary} />
          </View>
          <View style={styles.rightCol}>
            {state.payoutAmount != null && state.payoutAmount > 0 ? (
              <View style={styles.amountRow}>
                <Text style={[styles.amountLg, { color: COLORS.accent }]}>
                  {formatFcfaAmount(Math.round(state.payoutAmount))}
                </Text>
                <Text style={styles.fcfaUnit}>FCFA</Text>
              </View>
            ) : (
              <View style={{ height: 24 }} />
            )}
            <Pressable
              onPress={() =>
                navigateTontineDetail(state.payoutTontineUid, true)
              }
              style={({ pressed }) => [
                styles.btnPrimarySolid,
                { backgroundColor: COLORS.accent },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={primaryA11y}
            >
              <Text style={styles.btnPrimarySolidText}>Verser</Text>
            </Pressable>
          </View>
        </CardInner>
      </View>
    );
  }

  if (state.variant === 'PAYMENT_PENDING_VALIDATION') {
    const amt = state.paymentPendingAmount;
    return (
      <View style={styles.cardOuter} accessibilityRole="none">
        <CardInner>
          <View style={[styles.iconBox, { backgroundColor: COLORS.accentLight }]}>
            <PaymentPendingClockIcon />
          </View>
          <View style={styles.centerCol}>
            <Text style={[styles.eyebrow, { color: '#185FA5' }]}>
              Versement en attente de validation
            </Text>
            <Text style={styles.title} numberOfLines={1}>
              {state.paymentPendingTontineName}
            </Text>
            <Text style={styles.sub} numberOfLines={2}>
              {state.paymentPendingCycleLabel ?? ''}
            </Text>
            <View style={styles.pendingBadgeRow}>
              <PaymentPendingPulseDot />
              <Text style={styles.pendingBadgeText}>
                En attente de confirmation opérateur
              </Text>
            </View>
          </View>
          <View style={styles.rightCol}>
            {amt != null && amt > 0 ? (
              <View style={styles.amountRow}>
                <Text style={[styles.amountLg, { color: '#185FA5' }]}>
                  {formatFcfaAmount(Math.round(amt))}
                </Text>
                <Text style={styles.fcfaUnit}>FCFA</Text>
              </View>
            ) : (
              <View style={{ height: 24 }} />
            )}
            <Pressable
              onPress={() =>
                navigateTontineDetail(
                  state.tontineUid,
                  state.isCreator === true
                )
              }
              style={({ pressed }) => [
                styles.btnPendingDetails,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Détails du versement"
            >
              <Text style={styles.btnPendingDetailsText}>Détails</Text>
            </Pressable>
          </View>
        </CardInner>
      </View>
    );
  }

  if (state.variant === 'OVERDUE') {
    const subLine = `${state.cycleLabel ?? ''}${
      state.hasPenaltyIncluded === true ? ' · Pénalité incluse' : ''
    }`;
    const openPayment = (): void => {
      props.onRequestPaymentModal(state);
    };
    return (
      <View style={styles.cardOuter} accessibilityRole="none">
        <Pressable
          onPress={openPayment}
          style={({ pressed }) => [pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={primaryA11y}
        >
          <CardInner>
            <View
              style={[
                styles.iconBox,
                {
                  backgroundColor: COLORS.dangerLight,
                  borderWidth: 0.5,
                  borderColor: COLORS.dangerText,
                },
              ]}
            >
              <Ionicons name="time-outline" size={22} color={COLORS.dangerText} />
            </View>
            <View style={styles.centerCol}>
              <Text style={[styles.eyebrow, { color: COLORS.dangerText }]}>
                Cotisation en retard · {state.daysLate ?? 0} jour
                {(state.daysLate ?? 0) > 1 ? 's' : ''}
              </Text>
              <Text style={styles.title} numberOfLines={1}>
                {state.tontineName}
              </Text>
              <Text style={styles.sub} numberOfLines={2}>
                {subLine}
              </Text>
            </View>
            <View style={styles.rightCol}>
              <View style={styles.amountRow}>
                <Text style={[styles.amountLg, { color: COLORS.danger }]}>
                  {formatFcfaAmount(Math.round(state.amountDue ?? 0))}
                </Text>
                <Text style={styles.fcfaUnit}>FCFA</Text>
              </View>
              <View
                style={[styles.btnPrimarySolid, { backgroundColor: COLORS.danger }]}
              >
                <Text style={styles.btnPrimarySolidText}>Payer</Text>
              </View>
            </View>
          </CardInner>
        </Pressable>
        <PaymentDueActionStrip
          variant="OVERDUE"
          tontineUid={state.tontineUid}
          isCreator={state.isCreator}
          onPayerMaintenant={openPayment}
        />
      </View>
    );
  }

  if (state.variant === 'DUE') {
    const d = state.daysLate ?? 0;
    const abs = Math.abs(d);
    let eyebrow: string;
    if (d === 0) {
      eyebrow = "Paiement dû · Aujourd'hui";
    } else if (d === -1) {
      eyebrow = 'Paiement dû · Demain';
    } else {
      eyebrow = `Paiement dû · dans ${abs} jour${abs > 1 ? 's' : ''}`;
    }

    const openPayment = (): void => {
      props.onRequestPaymentModal(state);
    };

    return (
      <View style={styles.cardOuter} accessibilityRole="none">
        <Pressable
          onPress={openPayment}
          style={({ pressed }) => [pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={primaryA11y}
        >
          <CardInner>
            <View
              style={[
                styles.iconBox,
                {
                  backgroundColor: COLORS.secondaryBg,
                  borderWidth: 0.5,
                  borderColor: COLORS.secondaryText,
                },
              ]}
            >
              <Ionicons name="time-outline" size={22} color={COLORS.secondaryText} />
            </View>
            <View style={styles.centerCol}>
              <Text style={[styles.eyebrow, { color: COLORS.secondaryText }]}>
                {eyebrow}
              </Text>
              <Text style={styles.title} numberOfLines={1}>
                {state.tontineName}
              </Text>
              <Text style={styles.sub} numberOfLines={2}>
                {state.cycleLabel ?? ''}
              </Text>
            </View>
            <View style={styles.rightCol}>
              <View style={styles.amountRow}>
                <Text style={[styles.amountLg, { color: COLORS.primary }]}>
                  {formatFcfaAmount(Math.round(state.amountDue ?? 0))}
                </Text>
                <Text style={styles.fcfaUnit}>FCFA</Text>
              </View>
              <View
                style={[styles.btnPrimarySolid, { backgroundColor: COLORS.primary }]}
              >
                <Text style={styles.btnPrimarySolidText}>Payer</Text>
              </View>
            </View>
          </CardInner>
        </Pressable>
        <PaymentDueActionStrip
          variant="DUE"
          tontineUid={state.tontineUid}
          isCreator={state.isCreator}
          onPayerMaintenant={openPayment}
        />
      </View>
    );
  }

  if (state.variant === 'CASH_PENDING') {
    const n = state.cashPendingCount ?? 0;
    const title =
      n > 1 ? `${n} paiements espèces` : `${n} paiement espèces`;
    const sub = state.cashTontineNamesHint ?? state.tontineName ?? '';

    return (
      <View style={styles.cardOuter} accessibilityRole="none">
        <CardInner>
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor: COLORS.secondaryBg,
                borderWidth: 0.5,
                borderColor: '#633806',
              },
            ]}
          >
            <Ionicons name="cube-outline" size={22} color="#633806" />
          </View>
          <View style={styles.centerCol}>
            <Text style={[styles.eyebrow, { color: '#633806' }]}>
              En attente de validation
            </Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.sub} numberOfLines={2}>
              {sub}
            </Text>
          </View>
          <View style={styles.rightCol}>
            <View style={styles.roundBadge}>
              <Text style={styles.roundBadgeText}>{n}</Text>
            </View>
            <Pressable
              onPress={() => props.onRequestCashModal()}
              style={({ pressed }) => [
                styles.btnPrimarySolid,
                { backgroundColor: COLORS.secondary },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={primaryA11y}
            >
              <Text style={[styles.btnPrimarySolidText, { color: '#412402' }]}>
                Valider
              </Text>
            </Pressable>
          </View>
        </CardInner>
        <CashPendingListStrip />
      </View>
    );
  }

  if (state.variant === 'INVITATION_PENDING') {
    const uid = state.firstInvitationTontineUid;
    const mode = state.firstInvitationMode ?? 'INVITE_ACCEPT';
    const name = state.firstInvitationName;

    const sub =
      state.firstInvitationAmount != null &&
      state.firstInvitationMemberCount != null
        ? `${formatFcfa(state.firstInvitationAmount)} / part · ${state.firstInvitationMemberCount} membres`
        : '';

    return (
      <View style={styles.cardOuter} accessibilityRole="none">
        <CardInner>
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor: '#EEEDFE',
                borderWidth: 0.5,
                borderColor: '#534AB7',
              },
            ]}
          >
            <Ionicons name="person-add-outline" size={22} color="#534AB7" />
          </View>
          <View style={styles.centerCol}>
            <Text style={[styles.eyebrow, { color: '#534AB7' }]}>
              Invitation reçue
            </Text>
            <Text style={styles.title} numberOfLines={1}>
              {state.firstInvitationName}
            </Text>
            {sub ? <Text style={styles.sub}>{sub}</Text> : null}
          </View>
          <View style={styles.rightCol}>
            <View style={{ height: 36 }} />
            <Pressable
              onPress={() => navigateContract(uid, name, mode)}
              style={({ pressed }) => [
                styles.btnPrimarySolid,
                { backgroundColor: '#534AB7' },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={primaryA11y}
            >
              <Text style={styles.btnPrimarySolidText}>Voir</Text>
            </Pressable>
          </View>
        </CardInner>

        <View style={styles.inviteStrip}>
          <AccordionLine
            icon="checkmark"
            iconColor={COLORS.primary}
            label="Accepter"
            labelColor={COLORS.primary}
            onPress={() => navigateContract(uid, name, mode)}
          />
          <AccordionLine
            showLeftSep
            icon="close"
            iconColor={COLORS.gray500}
            label="Refuser"
            labelColor={COLORS.gray500}
            onPress={() => {
              if (uid) onDeclineInvitation(uid);
            }}
          />
          <AccordionLine
            showLeftSep
            icon="document-text-outline"
            iconColor={COLORS.gray500}
            label="Contrat"
            labelColor={COLORS.gray500}
            onPress={() => navigateContract(uid, name, mode)}
          />
        </View>
      </View>
    );
  }

  return <View />;
}

/** Mémo : évite les re-renders si la même page (référence) est recyclée par la FlatList. */
const HeroCardPageMemo = React.memo(HeroCardPageInner);

export const HomeHeroCard: React.FC<HomeHeroCardProps> = ({
  pages,
  isLoading,
  onPaymentInitiated,
}) => {
  const queryClient = useQueryClient();
  const userUid = useSelector((s: RootState) => selectUserUid(s));
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - HORIZONTAL_MARGIN;
  const itemStride = cardWidth + GAP;

  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<HeroCardPageModel>>(null);
  const [paymentModalPage, setPaymentModalPage] =
    useState<HeroCardPageModel | null>(null);
  const [cashModalVisible, setCashModalVisible] = useState(false);

  const openPaymentModal = useCallback((page: HeroCardPageModel) => {
    setPaymentModalPage(page);
  }, []);

  const closePaymentModal = useCallback(() => {
    setPaymentModalPage(null);
  }, []);

  const openCashModal = useCallback(() => {
    setCashModalVisible(true);
  }, []);

  const handleCashValidationComplete = useCallback(() => {
    if (userUid != null) {
      void queryClient.invalidateQueries({ queryKey: ['tontines', userUid] });
      void queryClient.invalidateQueries({ queryKey: ['nextPayment', userUid] });
    } else {
      void queryClient.invalidateQueries({ queryKey: ['tontines'] });
      void queryClient.invalidateQueries({ queryKey: ['nextPayment'] });
    }
  }, [queryClient, userUid]);

  useEffect(() => {
    setActiveIndex(0);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [pages.length]);

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = e.nativeEvent.contentOffset.x;
      const index = Math.round(offset / itemStride);
      const clamped = Math.min(Math.max(index, 0), Math.max(0, pages.length - 1));
      setActiveIndex(clamped);
      const p = pages[clamped];
      if (p != null) {
        const label = buildPageLabel(p, clamped, pages.length);
        if (label.length > 0) {
          AccessibilityInfo.announceForAccessibility(label);
        }
      }
    },
    [itemStride, pages]
  );

  const scrollToIndex = useCallback(
    (index: number) => {
      const max = Math.max(0, pages.length - 1);
      const i = Math.min(Math.max(index, 0), max);
      flatListRef.current?.scrollToIndex({ index: i, animated: true });
    },
    [pages.length]
  );

  const renderItem = useCallback(
    ({ item }: { item: HeroCardPageModel }) => (
      <View style={{ width: cardWidth }}>
        <HeroCardPageMemo
          page={item}
          onRequestPaymentModal={openPaymentModal}
          onRequestCashModal={openCashModal}
        />
      </View>
    ),
    [cardWidth, openCashModal, openPaymentModal]
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<HeroCardPageModel> | null | undefined, index: number) => ({
      length: itemStride,
      offset: itemStride * index,
      index,
    }),
    [itemStride]
  );

  const keyExtractor = useCallback((p: HeroCardPageModel) => p.pageKey, []);

  if (isLoading) {
    return <HomeHeroCardSkeleton />;
  }

  return (
    <View style={styles.wrapOuter}>
      <FlatList
        ref={flatListRef}
        data={pages}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled={false}
        showsHorizontalScrollIndicator={false}
        snapToInterval={itemStride}
        snapToAlignment="start"
        decelerationRate="fast"
        ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
        renderItem={renderItem}
        onMomentumScrollEnd={handleScrollEnd}
        getItemLayout={getItemLayout}
        onScrollToIndexFailed={({ index }) => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({
              index,
              animated: true,
            });
          }, 100);
        }}
        accessibilityRole="none"
      />
      {pages.length > 1 ? (
        <PaginationDots
          count={pages.length}
          activeIndex={activeIndex}
          onDotPress={scrollToIndex}
        />
      ) : null}
      {paymentModalPage != null &&
      (paymentModalPage.variant === 'OVERDUE' ||
        paymentModalPage.variant === 'DUE') ? (
        <PaymentModal
          visible
          onClose={closePaymentModal}
          tontineName={paymentModalPage.tontineName ?? ''}
          cycleLabel={paymentModalPage.cycleLabel ?? ''}
          totalAmountDue={Math.round(paymentModalPage.amountDue ?? 0)}
          penaltyAmount={Math.round(paymentModalPage.penaltyAmount ?? 0)}
          cycleUid={paymentModalPage.cycleUid ?? ''}
          tontineUid={paymentModalPage.tontineUid ?? ''}
          cycleNumber={paymentModalPage.cycleNumber ?? 1}
          paymentBaseAmount={
            paymentModalPage.paymentBaseAmount != null
              ? paymentModalPage.paymentBaseAmount
              : Math.max(
                  0,
                  Math.round(paymentModalPage.amountDue ?? 0) -
                    Math.round(paymentModalPage.penaltyAmount ?? 0)
                )
          }
          urgency={
            paymentModalPage.variant === 'OVERDUE' ? 'OVERDUE' : 'DUE'
          }
          onPaymentSuccess={() => {
            const tUid = paymentModalPage.tontineUid;
            const cUid = paymentModalPage.cycleUid;
            if (tUid != null && cUid != null && cUid !== '') {
              onPaymentInitiated(tUid, cUid, {
                cycleLabel: paymentModalPage.cycleLabel,
                amount: paymentModalPage.amountDue,
              });
            }
          }}
        />
      ) : null}
      <CashValidationModal
        visible={cashModalVisible}
        onClose={() => setCashModalVisible(false)}
        onValidationComplete={handleCashValidationComplete}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapOuter: {
    marginTop: SPACING.md,
    marginHorizontal: 16,
  },
  cardOuter: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    overflow: 'hidden',
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: SPACING.md,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: SPACING.md,
  },
  skeletonCenter: {
    flex: 1,
    gap: SPACING.sm,
  },
  skeletonRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '500',
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  sub: {
    fontSize: 11,
    color: COLORS.gray500,
    marginTop: 2,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  amountLg: {
    fontSize: 18,
    fontWeight: '500',
  },
  fcfaUnit: {
    fontSize: 10,
    color: COLORS.gray500,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.gray200,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    width: '100%',
    borderRadius: 2,
  },
  btnDetails: {
    minHeight: 32,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: COLORS.accentLight,
    borderRadius: RADIUS.sm,
    borderWidth: 0.5,
    borderColor: PAYOUT_BLUE_BORDER,
    justifyContent: 'center',
  },
  btnDetailsText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.accentDark,
  },
  btnPendingDetails: {
    minHeight: 32,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: COLORS.accentLight,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: PAYOUT_BLUE_BORDER,
    justifyContent: 'center',
  },
  btnPendingDetailsText: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.accentDark,
  },
  btnPrimarySolid: {
    minHeight: 32,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPrimarySolidText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.white,
  },
  pressed: {
    opacity: 0.92,
  },
  neutralRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  neutralIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A6B3C20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  neutralTextWrap: {
    flex: 1,
    gap: 4,
  },
  neutralTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  neutralSub: {
    fontSize: 12,
    color: COLORS.gray500,
    lineHeight: 18,
  },
  roundBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.secondaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBadgeText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#633806',
  },
  inviteStrip: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: '#F1EFE8',
  },
  accordionBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    gap: 3,
  },
  accordionSep: {
    borderLeftWidth: 0.5,
    borderLeftColor: COLORS.gray200,
  },
  accordionLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  pendingBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primaryLight,
  },
  pendingBadgeText: {
    fontSize: 10,
    color: COLORS.primaryDark,
    fontWeight: '500',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    marginTop: 8,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 16,
    backgroundColor: COLORS.primary,
  },
  dotIdle: {
    width: 6,
    backgroundColor: COLORS.gray200,
  },
  paymentStripRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: 0.5,
    borderTopColor: COLORS.gray100,
  },
  paymentStripCell: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentStripSep: {
    width: 0.5,
    backgroundColor: COLORS.gray100,
  },
  paymentStripLabel: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  cashListStrip: {
    borderTopWidth: 0.5,
    borderTopColor: COLORS.gray100,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cashListStripText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.primary,
  },
});
