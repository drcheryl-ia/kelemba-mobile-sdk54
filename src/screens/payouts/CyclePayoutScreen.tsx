/**
 * Flux organisateur — versement de la cagnotte (POST CYCLES.PAYOUT).
 * Hors ligne → refus. Biométrie (si dispo) + PIN → POST step-up-token → POST payout avec securityConfirmationToken.
 * Idempotence UUID v4 conservée jusqu’à succès ou nouvelle tentative explicite.
 */
import React, { useCallback, useRef, useState } from 'react';
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

const PIN_LENGTH = CONSTANTS.PIN_LENGTH ?? 6;

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

function payoutUiError(err: ApiError): string {
  if (
    err.code === ApiErrorCode.VALIDATION_ERROR ||
    err.code === ApiErrorCode.SECURITY_CONFIRMATION_INVALID ||
    err.code === ApiErrorCode.SECURITY_CONFIRMATION_REQUIRED
  ) {
    return err.message;
  }
  return getErrorMessageForCode(err, 'fr');
}

export const CyclePayoutScreen: React.FC<Props> = ({ navigation, route }) => {
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
      setErrorMsg(payoutUiError(apiErr));
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
      setErrorMsg('Le versement a échoué ou été annulé.');
    }
    if (poll.isTimeout) {
      setPhase('failed');
      setErrorMsg('Délai de confirmation dépassé. Vérifiez l’état de la tontine.');
    }
  }, [phase, paymentUidPoll, skipPoll, poll.status, poll.isTimeout, invalidateAll]);

  const handleContinueToPin = () => {
    if (isConnected === false) {
      Alert.alert('Hors ligne', 'Connectez-vous à Internet pour lancer le versement.');
      return;
    }
    if (method === 'CASH' && !cashConfirmed) {
      Alert.alert(
        'Confirmation requise',
        'Cochez la confirmation pour un versement en espèces.'
      );
      return;
    }
    setPhase('pin');
  };

  const handlePinComplete = async (pin: string) => {
    if (pin.length !== PIN_LENGTH) return;
    if (submittedRef.current) return;
    if (isConnected === false) {
      Alert.alert('Hors ligne', 'Connectez-vous à Internet pour lancer le versement.');
      return;
    }
    if (bioAvailable) {
      const ok = await bioAuth();
      if (!ok) {
        Alert.alert('Biométrie', 'Authentification biométrique refusée.');
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
      setErrorMsg(payoutUiError(apiErr));
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
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}
          accessibilityRole="button" accessibilityLabel="Retour">
          <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Versement cagnotte
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {phase === 'form' && (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.tontineName}>{tontineName}</Text>
          <Text style={styles.meta}>
            Cycle {cycleNumber} · Bénéficiaire : {beneficiaryName}
          </Text>
          <Text style={styles.amount}>Net à verser : {formatFcfa(netAmount)}</Text>

          <Text style={styles.section}>Méthode de versement au bénéficiaire</Text>
          {(['ORANGE_MONEY', 'TELECEL_MONEY', 'CASH'] as const).map((m) => (
            <Pressable
              key={m}
              style={[styles.methodRow, method === m && styles.methodRowOn]}
              onPress={() => setMethod(m)}
            >
              <Text style={styles.methodText}>
                {m === 'ORANGE_MONEY'
                  ? 'Orange Money'
                  : m === 'TELECEL_MONEY'
                    ? 'Telecel Money'
                    : 'Espèces'}
              </Text>
            </Pressable>
          ))}

          {method !== 'CASH' && (
            <View style={styles.field}>
              <Text style={styles.label}>Téléphone bénéficiaire (optionnel)</Text>
              <TextInput
                style={styles.input}
                value={receiverPhone}
                onChangeText={setReceiverPhone}
                placeholder="+236…"
                keyboardType="phone-pad"
                autoCapitalize="none"
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Nom / référence</Text>
            <TextInput
              style={styles.input}
              value={receiverName}
              onChangeText={setReceiverName}
            />
          </View>

          {method === 'CASH' && (
            <View style={styles.cashRow}>
              <Text style={styles.cashLabel}>
                Je confirme le versement espèces à la personne désignée
              </Text>
              <Switch value={cashConfirmed} onValueChange={setCashConfirmed} />
            </View>
          )}

          <Pressable style={styles.primaryBtn} onPress={handleContinueToPin}>
            <Text style={styles.primaryBtnText}>Continuer</Text>
          </Pressable>
        </ScrollView>
      )}

      {phase === 'pin' && (
        <View style={styles.pinWrap}>
          <Text style={styles.pinTitle}>Code PIN à 6 chiffres</Text>
          <Text style={styles.pinHint}>
            Saisissez votre PIN Kelemba pour autoriser le versement organisateur.
          </Text>
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
          <ActivityIndicator size="large" color="#1A6B3C" />
          <Text style={styles.procTitle}>
            {phase === 'security_loading'
              ? 'Confirmation de sécurité…'
              : 'Versement en cours de confirmation…'}
          </Text>
          {externalRef != null && (
            <Text style={styles.refText}>Réf. : {externalRef}</Text>
          )}
          {!skipPoll && paymentUidPoll && (
            <Text style={styles.pollHint}>
              Statut : {poll.status} ({poll.attempts}/{poll.maxAttempts})
            </Text>
          )}
        </View>
      )}

      {phase === 'success' && (
        <View style={styles.center}>
          <Ionicons name="checkmark-circle" size={64} color="#1A6B3C" />
          <Text style={styles.procTitle}>Versement enregistré</Text>
          {externalRef != null && (
            <Text style={styles.refText}>Réf. : {externalRef}</Text>
          )}
          <Text style={styles.hint}>
            La rotation et les prochaines échéances seront mises à jour depuis le serveur.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={handleClose}>
            <Text style={styles.primaryBtnText}>Retour à la tontine</Text>
          </Pressable>
        </View>
      )}

      {phase === 'failed' && (
        <View style={styles.center}>
          <Ionicons name="alert-circle" size={48} color="#D0021B" />
          <Text style={styles.errText}>{errorMsg ?? 'Échec du versement'}</Text>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => {
              submittedRef.current = false;
              setPinValue('');
              idempotencyKeyRef.current = generateUUID();
              setPhase('form');
            }}
          >
            <Text style={styles.secondaryBtnText}>Réessayer</Text>
          </Pressable>
          <Pressable onPress={handleClose}>
            <Text style={styles.link}>Fermer</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  tontineName: { fontSize: 20, fontWeight: '800', color: '#111' },
  meta: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  amount: { fontSize: 18, fontWeight: '700', color: '#1A6B3C', marginVertical: 16 },
  section: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  methodRow: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
    backgroundColor: '#FFF',
  },
  methodRowOn: { borderColor: '#1A6B3C', backgroundColor: '#E8F5EE' },
  methodText: { fontSize: 16, fontWeight: '600' },
  field: { marginTop: 12 },
  label: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFF',
  },
  cashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  cashLabel: { flex: 1, fontSize: 14, color: '#374151' },
  primaryBtn: {
    marginTop: 24,
    backgroundColor: '#D0021B',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  pinWrap: { padding: 20, flex: 1 },
  pinTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  pinHint: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  procTitle: { fontSize: 18, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  refText: { fontSize: 14, color: '#374151', marginTop: 8 },
  pollHint: { fontSize: 12, color: '#6B7280', marginTop: 8 },
  hint: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 12 },
  errText: { fontSize: 15, color: '#D0021B', textAlign: 'center', marginTop: 12 },
  secondaryBtn: {
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1A6B3C',
  },
  secondaryBtnText: { color: '#1A6B3C', fontWeight: '700' },
  link: { marginTop: 16, color: '#0055A5', fontWeight: '600' },
});
