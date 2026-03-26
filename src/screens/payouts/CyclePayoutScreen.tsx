/**
 * Flux organisateur — versement de la cagnotte (POST CYCLES.PAYOUT).
 * Hors ligne → refus. Biométrie (si dispo) + PIN → POST step-up-token → POST payout avec securityConfirmationToken.
 * Idempotence UUID v4 conservée jusqu’à succès ou nouvelle tentative explicite.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { issueCyclePayoutStepUpToken, postCyclePayout } from '@/api/cyclePayoutApi';
import { getErrorMessageForCode } from '@/api/errors';
import { ApiError } from '@/api/errors/ApiError';
import { ApiErrorCode } from '@/api/errors/errorCodes';
import { parseApiError } from '@/api/errors/errorHandler';
import { logger } from '@/utils/logger';
import { formatFcfa } from '@/utils/formatters';
import { PinPad } from '@/components/auth';
import { CONSTANTS } from '@/config/constants';
import { useNetwork } from '@/hooks/useNetwork';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { usePaymentPolling } from '@/hooks/usePaymentPolling';
import type { CyclePayoutPaymentMethod } from '@/types/cyclePayout';
import type { PaymentStatus } from '@/types/domain.types';
import { spacing } from '@/theme/spacing';
import { CyclePayoutMethodCard } from '@/screens/payouts/components/CyclePayoutMethodCard';

const PIN_LENGTH = CONSTANTS.PIN_LENGTH ?? 6;

/** Design tokens Kelemba — CLAUDE.md */
const COLOR_PRIMARY = '#1A6B3C';
const COLOR_DANGER = '#D0021B';
const COLOR_INK = '#111827';
const COLOR_MUTED = '#6B7280';

const PAYOUT_METHODS = ['ORANGE_MONEY', 'TELECEL_MONEY', 'CASH'] as const;

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type Props = NativeStackScreenProps<RootStackParamList, 'CyclePayoutScreen'>;

type Phase =
  | 'form'
  | 'pin'
  | 'security_loading'
  | 'processing'
  | 'success'
  | 'failed';

function resolvePayoutUiError(err: ApiError, lang: 'fr' | 'sango'): string {
  if (
    err.code === ApiErrorCode.VALIDATION_ERROR ||
    err.code === ApiErrorCode.SECURITY_CONFIRMATION_INVALID ||
    err.code === ApiErrorCode.SECURITY_CONFIRMATION_REQUIRED
  ) {
    return err.message;
  }
  return getErrorMessageForCode(err, lang);
}

export const CyclePayoutScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t, i18n } = useTranslation();
  const lang: 'fr' | 'sango' = i18n.language === 'sango' ? 'sango' : 'fr';

  const {
    tontineUid,
    tontineName,
    cycleUid,
    cycleNumber,
    beneficiaryName,
    netAmount,
  } = route.params;

  const queryClient = useQueryClient();
  const { isConnected } = useNetwork();
  const { isAvailable: bioAvailable, authenticate: bioAuth } = useBiometricAuth();

  const [method, setMethod] = useState<CyclePayoutPaymentMethod>('ORANGE_MONEY');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [receiverName, setReceiverName] = useState(beneficiaryName);
  const [cashConfirmed, setCashConfirmed] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [paymentUidPoll, setPaymentUidPoll] = useState<string | null>(null);
  const [skipPoll, setSkipPoll] = useState(true);
  const [externalRef, setExternalRef] = useState<string | null>(null);
  const [pinValue, setPinValue] = useState('');

  const idempotencyKeyRef = useRef<string>(generateUUID());
  const submittedRef = useRef(false);

  const invalidateAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['cycle', 'current', tontineUid] });
    void queryClient.invalidateQueries({ queryKey: ['tontine', tontineUid] });
    void queryClient.invalidateQueries({ queryKey: ['tontines'] });
    void queryClient.invalidateQueries({ queryKey: ['tontines', 'active'] });
    void queryClient.invalidateQueries({ queryKey: ['nextPayment'] });
    void queryClient.invalidateQueries({ queryKey: ['score', 'me'] });
    void queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
    void queryClient.invalidateQueries({ queryKey: ['members', tontineUid] });
    void queryClient.invalidateQueries({ queryKey: ['report', tontineUid] });
    void queryClient.invalidateQueries({ queryKey: ['cycle', 'completion', cycleUid] });
    void queryClient.invalidateQueries({ queryKey: ['payments', 'pending'] });
  }, [queryClient, tontineUid, cycleUid]);

  const payoutMutation = useMutation({
    mutationFn: ({ token }: { token: string }) =>
      postCyclePayout(cycleUid, {
        paymentMethod: method,
        idempotencyKey: idempotencyKeyRef.current,
        securityConfirmationToken: token,
        receiverPhone:
          method !== 'CASH' && receiverPhone.trim() !== ''
            ? receiverPhone.trim()
            : undefined,
        receiverName: receiverName.trim() !== '' ? receiverName.trim() : undefined,
        cashConfirmed: method === 'CASH' ? cashConfirmed : undefined,
      }),
    onSuccess: (data) => {
      const d = data as Record<string, unknown>;
      const rawUid = data.paymentUid ?? d.paymentId ?? d.uid;
      const uidStr =
        rawUid != null && String(rawUid).length > 0 ? String(rawUid) : '';
      const refRaw = data.externalRef ?? d.txnId ?? d.transactionId ?? d.reference;
      const ref = refRaw != null ? String(refRaw) : null;
      setExternalRef(ref);
      const st = data.status as PaymentStatus | undefined;
      if (uidStr.length >= 10) {
        setPaymentUidPoll(uidStr);
        const terminal = st === 'COMPLETED';
        setSkipPoll(terminal);
        if (terminal) {
          setPhase('success');
          invalidateAll();
        } else {
          setPhase('processing');
        }
      } else {
        setPhase('success');
        invalidateAll();
      }
    },
    onError: (err: unknown) => {
      const apiErr = parseApiError(err);
      setErrorMsg(resolvePayoutUiError(apiErr, lang));
      setPhase('failed');
      submittedRef.current = false;
      logger.error('[CyclePayoutScreen] payout failed', { code: apiErr.code });
    },
  });

  const poll = usePaymentPolling(
    paymentUidPoll ?? '',
    skipPoll || !paymentUidPoll || paymentUidPoll.length < 5
  );

  React.useEffect(() => {
    if (phase !== 'processing' || !paymentUidPoll || skipPoll) return;
    if (poll.status === 'COMPLETED') {
      setPhase('success');
      invalidateAll();
    }
    if (poll.status === 'FAILED' || poll.status === 'REFUNDED') {
      setPhase('failed');
      setErrorMsg(t('cyclePayout.failedPoll'));
    }
    if (poll.isTimeout) {
      setPhase('failed');
      setErrorMsg(t('cyclePayout.failedTimeout'));
    }
  }, [phase, paymentUidPoll, skipPoll, poll.status, poll.isTimeout, invalidateAll, t]);

  const continueCtaLabel = useMemo(() => {
    if (method === 'ORANGE_MONEY') return t('cyclePayout.ctaOrange');
    if (method === 'TELECEL_MONEY') return t('cyclePayout.ctaTelecel');
    return t('cyclePayout.ctaCash');
  }, [method, t]);

  const handleContinueToPin = () => {
    if (isConnected === false) {
      Alert.alert(
        t('cyclePayout.offlineTitle'),
        t('cyclePayout.offlineMessage')
      );
      return;
    }
    if (method === 'CASH' && !cashConfirmed) {
      Alert.alert(
        t('cyclePayout.cashConfirmAlertTitle'),
        t('cyclePayout.cashConfirmAlertMessage')
      );
      return;
    }
    setPhase('pin');
  };

  const handlePinComplete = async (pin: string) => {
    if (pin.length !== PIN_LENGTH) return;
    if (submittedRef.current) return;
    if (isConnected === false) {
      Alert.alert(
        t('cyclePayout.offlineTitle'),
        t('cyclePayout.offlineMessage')
      );
      return;
    }
    if (bioAvailable) {
      const ok = await bioAuth();
      if (!ok) {
        Alert.alert(
          t('cyclePayout.biometricDeniedTitle'),
          t('cyclePayout.biometricDeniedMessage')
        );
        return;
      }
    }
    submittedRef.current = true;
    setErrorMsg(null);
    setPhase('security_loading');
    logger.info('[CyclePayout] organizer payout step-up started', { cycleUid });

    try {
      const token = await issueCyclePayoutStepUpToken(cycleUid, pin);
      logger.info('[CyclePayout] step-up token obtained');
      setPinValue('');
      setPhase('processing');
      payoutMutation.mutate({ token });
    } catch (e: unknown) {
      const apiErr = parseApiError(e);
      setErrorMsg(resolvePayoutUiError(apiErr, lang));
      setPhase('failed');
      submittedRef.current = false;
      logger.error('[CyclePayout] step-up failed', { code: apiErr.code });
    }
  };

  const handleClose = () => {
    void invalidateAll();
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('cyclePayout.backA11y')}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t('cyclePayout.title')}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {phase === 'form' && (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.tontineName}>{tontineName}</Text>
          <Text style={styles.meta}>
            {t('cyclePayout.headerMeta', {
              cycle: String(cycleNumber),
              name: beneficiaryName,
            })}
          </Text>

          <View
            style={styles.amountCard}
            accessible
            accessibilityLabel={`${t('cyclePayout.amountLabel')}, ${formatFcfa(netAmount)}`}
          >
            <Text style={styles.amountLabel}>{t('cyclePayout.amountLabel')}</Text>
            <Text style={styles.amountValue}>{formatFcfa(netAmount)}</Text>
          </View>

          <Text style={styles.sectionTitle}>{t('cyclePayout.sectionTitle')}</Text>
          <Text style={styles.sectionHint}>{t('cyclePayout.sectionHint')}</Text>

          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t('cyclePayout.sectionTitle')}
          >
            {PAYOUT_METHODS.map((m) => (
              <CyclePayoutMethodCard
                key={m}
                method={m}
                selected={method === m}
                title={
                  m === 'ORANGE_MONEY'
                    ? t('cyclePayout.methodOrange')
                    : m === 'TELECEL_MONEY'
                      ? t('cyclePayout.methodTelecel')
                      : t('cyclePayout.methodCash')
                }
                subtitle={
                  m === 'ORANGE_MONEY'
                    ? t('cyclePayout.orangeSubtitle')
                    : m === 'TELECEL_MONEY'
                      ? t('cyclePayout.telecelSubtitle')
                      : t('cyclePayout.cashSubtitle')
                }
                badge={
                  m === 'ORANGE_MONEY'
                    ? t('cyclePayout.orangeBadge')
                    : m === 'TELECEL_MONEY'
                      ? t('cyclePayout.telecelBadge')
                      : t('cyclePayout.cashBadge')
                }
                onSelect={() => setMethod(m)}
              />
            ))}
          </View>

          {method === 'ORANGE_MONEY' && (
            <View style={styles.field}>
              <Text style={styles.label}>{t('cyclePayout.phoneOrangeLabel')}</Text>
              <TextInput
                style={styles.input}
                value={receiverPhone}
                onChangeText={setReceiverPhone}
                placeholder={t('cyclePayout.phoneOrangePlaceholder')}
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoComplete="tel"
                textContentType="telephoneNumber"
                accessibilityLabel={t('cyclePayout.phoneOrangeLabel')}
                accessibilityHint={t('cyclePayout.phoneOrangeHelper')}
              />
              <Text style={styles.helper}>{t('cyclePayout.phoneOrangeHelper')}</Text>
            </View>
          )}

          {method === 'TELECEL_MONEY' && (
            <View style={styles.field}>
              <Text style={styles.label}>{t('cyclePayout.phoneTelecelLabel')}</Text>
              <TextInput
                style={styles.input}
                value={receiverPhone}
                onChangeText={setReceiverPhone}
                placeholder={t('cyclePayout.phoneTelecelPlaceholder')}
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoComplete="tel"
                textContentType="telephoneNumber"
                accessibilityLabel={t('cyclePayout.phoneTelecelLabel')}
                accessibilityHint={t('cyclePayout.phoneTelecelHelper')}
              />
              <Text style={styles.helper}>{t('cyclePayout.phoneTelecelHelper')}</Text>
            </View>
          )}

          {method === 'CASH' && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>{t('cyclePayout.receiverNameCashLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={receiverName}
                  onChangeText={setReceiverName}
                  placeholder={t('cyclePayout.receiverNameCashPlaceholder')}
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="words"
                  accessibilityLabel={t('cyclePayout.receiverNameCashLabel')}
                  accessibilityHint={t('cyclePayout.receiverNameCashHelper')}
                />
                <Text style={styles.helper}>{t('cyclePayout.receiverNameCashHelper')}</Text>
              </View>
              <View style={styles.cashRow}>
                <Text style={styles.cashLabel}>{t('cyclePayout.cashConfirmLabel')}</Text>
                <Switch
                  value={cashConfirmed}
                  onValueChange={setCashConfirmed}
                  trackColor={{ false: '#E5E7EB', true: `${COLOR_PRIMARY}88` }}
                  thumbColor={cashConfirmed ? COLOR_PRIMARY : '#F3F4F6'}
                  accessibilityLabel={t('cyclePayout.cashConfirmLabel')}
                />
              </View>
            </>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.primaryBtnPressed,
            ]}
            onPress={handleContinueToPin}
            accessibilityRole="button"
            accessibilityLabel={continueCtaLabel}
          >
            <Text style={styles.primaryBtnText} numberOfLines={2}>
              {continueCtaLabel}
            </Text>
          </Pressable>
        </ScrollView>
      )}

      {phase === 'pin' && (
        <View style={styles.pinWrap}>
          <Text style={styles.pinTitle}>{t('cyclePayout.pinTitle')}</Text>
          <Text style={styles.pinHint}>{t('cyclePayout.pinHint')}</Text>
          <PinPad
            value={pinValue}
            onChange={setPinValue}
            onComplete={handlePinComplete}
            digitLength={PIN_LENGTH}
          />
        </View>
      )}

      {(phase === 'security_loading' || phase === 'processing') && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLOR_PRIMARY} />
          <Text style={styles.procTitle}>
            {phase === 'security_loading'
              ? t('cyclePayout.securityLoading')
              : t('cyclePayout.processing')}
          </Text>
          {externalRef != null && (
            <Text style={styles.refText}>
              {t('payment.reference')} : {externalRef}
            </Text>
          )}
          {!skipPoll && paymentUidPoll && (
            <Text style={styles.pollHint}>
              {t('cyclePayout.pollHint', {
                status: String(poll.status),
                attempts: poll.attempts,
                max: poll.maxAttempts,
              })}
            </Text>
          )}
        </View>
      )}

      {phase === 'success' && (
        <View style={styles.center}>
          <Ionicons name="checkmark-circle" size={64} color={COLOR_PRIMARY} />
          <Text style={styles.procTitle}>{t('cyclePayout.successTitle')}</Text>
          {externalRef != null && (
            <Text style={styles.refText}>
              {t('payment.reference')} : {externalRef}
            </Text>
          )}
          <Text style={styles.hint}>{t('cyclePayout.successHint')}</Text>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel={t('payment.backToTontine')}
          >
            <Text style={styles.primaryBtnText}>{t('payment.backToTontine')}</Text>
          </Pressable>
        </View>
      )}

      {phase === 'failed' && (
        <View style={styles.center}>
          <Ionicons name="alert-circle" size={48} color={COLOR_DANGER} />
          <Text style={styles.errText}>
            {errorMsg ?? t('cyclePayout.failedGeneric')}
          </Text>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => {
              submittedRef.current = false;
              setPinValue('');
              idempotencyKeyRef.current = generateUUID();
              setPhase('form');
            }}
            accessibilityRole="button"
            accessibilityLabel={t('common.retry')}
          >
            <Text style={styles.secondaryBtnText}>{t('common.retry')}</Text>
          </Pressable>
          <Pressable onPress={handleClose} accessibilityRole="button" accessibilityLabel={t('cyclePayout.close')}>
            <Text style={styles.link}>{t('cyclePayout.close')}</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center', color: COLOR_INK },
  scroll: { padding: spacing.md + 4, paddingBottom: spacing.xl + spacing.md },
  tontineName: { fontSize: 22, fontWeight: '800', color: COLOR_INK, letterSpacing: -0.3 },
  meta: { fontSize: 14, color: COLOR_MUTED, marginTop: 6, lineHeight: 20 },
  amountCard: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.md + 4,
    borderRadius: 18,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    shadowColor: '#1A6B3C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  amountLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLOR_MUTED,
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 28,
    fontWeight: '800',
    color: COLOR_PRIMARY,
    letterSpacing: -0.5,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLOR_INK,
    marginBottom: 6,
  },
  sectionHint: {
    fontSize: 13,
    color: COLOR_MUTED,
    lineHeight: 18,
    marginBottom: spacing.sm + 2,
  },
  field: { marginTop: spacing.md },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  helper: {
    fontSize: 12,
    color: COLOR_MUTED,
    marginTop: 6,
    lineHeight: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 16,
    backgroundColor: '#FFF',
    minHeight: spacing.minTouchTarget,
  },
  cashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    gap: 12,
    minHeight: spacing.minTouchTarget,
  },
  cashLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#374151', lineHeight: 20 },
  primaryBtn: {
    marginTop: spacing.lg + 4,
    backgroundColor: COLOR_PRIMARY,
    paddingVertical: 16,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: spacing.minTouchTarget + 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.988 }],
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  pinWrap: { padding: spacing.md + 4, flex: 1 },
  pinTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, color: COLOR_INK },
  pinHint: { fontSize: 14, color: COLOR_MUTED, marginBottom: 20, lineHeight: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  procTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
    color: COLOR_INK,
    paddingHorizontal: spacing.sm,
  },
  refText: { fontSize: 14, color: '#374151', marginTop: 8 },
  pollHint: { fontSize: 12, color: COLOR_MUTED, marginTop: 8 },
  hint: { fontSize: 13, color: COLOR_MUTED, textAlign: 'center', marginTop: 12, lineHeight: 18 },
  errText: { fontSize: 15, color: COLOR_DANGER, textAlign: 'center', marginTop: 12 },
  secondaryBtn: {
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLOR_PRIMARY,
    minHeight: spacing.minTouchTarget,
    justifyContent: 'center',
  },
  secondaryBtnText: { color: COLOR_PRIMARY, fontWeight: '700', fontSize: 16 },
  link: { marginTop: 16, color: '#0055A5', fontWeight: '600', fontSize: 16, minHeight: 44, lineHeight: 44 },
});
