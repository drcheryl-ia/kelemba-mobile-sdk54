/**
 * PaymentScreen — flux de paiement adaptatif selon le mode.
 *
 * CASH        : Étape 1 (détail) → Étape 2 (récap) → Étape 3 (confirmation)
 * Orange/Tel  : Étape 1 (détail) → Étape 2 (méthode+n°) → Étape 3 (récap) → Étape 4 (PIN)
 *
 * Garanties fintech :
 *   — idempotency-key UUID v4 généré une seule fois au montage (useRef)
 *   — un seul appel POST /payments/initiate (disabled après première soumission)
 *   — invalidation React Query complète après COMPLETED
 *   — gestion exhaustive de tous les codes d'erreur backend
 */
import React, {
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';
import {
  selectCurrentUser,
  selectUserPhone,
  selectUserUid,
} from '@/store/authSlice';
import { initiateCashPayment } from '@/api/cashPaymentApi';
import { initiatePayment } from '@/api/paymentApi';
import { parseApiError } from '@/api/errors/errorHandler';
import { ApiErrorCode } from '@/api/errors/errorCodes';
import { logger } from '@/utils/logger';
import { formatFcfa, maskPhone } from '@/utils/formatters';
import { PinPad } from '@/components/auth';
import { CONSTANTS } from '@/config/constants';
import type { MobileMoneyMethod, PaymentMethod } from '@/types/payment';
import { useTontineMembers } from '@/hooks/useTontineMembers';
import {
  getCashMethodSublabel,
  getCashSelectionInfoText,
  getCashSummaryInfoText,
  getTontineCreatorName,
  isTontineCreatorMember,
  resolvePaymentSubmissionMode,
} from '@/utils/paymentFlow';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentScreen'>;

type FlowMode = 'CASH' | 'MOBILE_MONEY';

interface PaymentMethodConfig {
  id: PaymentMethod;
  label: string;
  sublabel: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  badge?: string;
  flow: FlowMode;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const RCA_PHONE_REGEX = /^\+236\d{8}$/;
const PIN_LENGTH = CONSTANTS.PIN_LENGTH ?? 6;

const METHODS: PaymentMethodConfig[] = [
  {
    id: 'CASH',
    label: 'Espèces',
    sublabel: "Remise en main propre à l'organisateur",
    icon: 'cash-outline',
    color: '#1A6B3C',
    badge: 'Disponible',
    flow: 'CASH',
  },
  {
    id: 'ORANGE_MONEY',
    label: 'Orange Money',
    sublabel: 'Paiement mobile (réseau Orange)',
    icon: 'phone-portrait-outline',
    color: '#F5A623',
    flow: 'MOBILE_MONEY',
  },
  {
    id: 'TELECEL_MONEY',
    label: 'Telecel Money',
    sublabel: 'Paiement mobile (réseau Telecel)',
    icon: 'phone-portrait-outline',
    color: '#0055A5',
    flow: 'MOBILE_MONEY',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Générer un UUID v4 compatible React Native (sans dépendance externe) */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function resolveErrorMessage(
  err: unknown,
  t: (k: string, fb: string) => string
): { title: string; message: string; isFinal: boolean } {
  const apiErr = parseApiError(err);
  switch (apiErr.code) {
    case ApiErrorCode.PAYMENT_DUPLICATE:
      return {
        title: t('payment.alreadyPaidTitle', 'Cotisation déjà réglée'),
        message: t(
          'payment.alreadyPaidMessage',
          'Votre cotisation pour ce cycle a déjà été enregistrée.'
        ),
        isFinal: true,
      };
    case ApiErrorCode.PAYMENT_FAILED:
      return {
        title: t('payment.failedTitle', 'Paiement refusé'),
        message: t(
          'payment.failedMessage',
          "L'opérateur a refusé la transaction. Vérifiez votre solde."
        ),
        isFinal: false,
      };
    case ApiErrorCode.PROVIDER_UNAVAILABLE:
      return {
        title: t('payment.providerUnavailable', 'Service indisponible'),
        message: t(
          'payment.providerUnavailableMessage',
          'Le service de paiement est temporairement indisponible. Réessayez.'
        ),
        isFinal: false,
      };
    case ApiErrorCode.INSUFFICIENT_FUNDS:
      return {
        title: t('payment.insufficientFunds', 'Solde insuffisant'),
        message: t(
          'payment.insufficientFundsMessage',
          'Votre solde Mobile Money est insuffisant pour ce paiement.'
        ),
        isFinal: false,
      };
    case ApiErrorCode.KYC_NOT_VERIFIED:
      return {
        title: t('payment.kycRequired', 'KYC requis'),
        message: t(
          'payment.kycMessage',
          "Veuillez compléter votre vérification d'identité avant de payer."
        ),
        isFinal: true,
      };
    case ApiErrorCode.NETWORK_ERROR:
    case ApiErrorCode.TIMEOUT:
      return {
        title: t('common.networkError', 'Erreur réseau'),
        message: t(
          'register.errorNetwork',
          'Vérifiez votre connexion et réessayez.'
        ),
        isFinal: false,
      };
    default:
      return {
        title: t('common.error', 'Erreur'),
        message:
          apiErr.message ||
          t('register.errorNetwork', 'Vérifiez votre connexion.'),
        isFinal: false,
      };
  }
}

// ─── Composant ────────────────────────────────────────────────────────────────

export const PaymentScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const currentUser = useSelector((state: RootState) => selectCurrentUser(state));
  const userUid = useSelector((state: RootState) => selectUserUid(state));
  const userPhone = useSelector((state: RootState) => selectUserPhone(state));

  const {
    cycleUid,
    tontineUid,
    tontineName,
    baseAmount,
    penaltyAmount,
    penaltyDays,
    cycleNumber,
  } = route.params;
  const { members } = useTontineMembers(tontineUid);

  const totalAmount = baseAmount + (penaltyAmount ?? 0);

  // idempotency-key générée une seule fois pour toute la durée de l'écran
  const idempotencyKey = useRef<string>(generateUUID());
  // Verrou pour éviter un double-submit
  const hasSubmitted = useRef(false);

  // ── État principal ─────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [useProfilePhone, setUseProfilePhone] = useState(true);
  const [alternatePhone, setAlternatePhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pinValue, setPinValue] = useState('');

  const isTontineCreator = useMemo(
    () => isTontineCreatorMember(members, userUid),
    [members, userUid]
  );
  const tontineCreatorName = useMemo(() => getTontineCreatorName(members), [members]);
  const paymentMethods = useMemo(
    () =>
      METHODS.map((method) =>
        method.id === 'CASH'
          ? { ...method, sublabel: getCashMethodSublabel(isTontineCreator) }
          : method
      ),
    [isTontineCreator]
  );
  const selectedConfig = useMemo(
    () => paymentMethods.find((method) => method.id === selectedMethod) ?? null,
    [paymentMethods, selectedMethod]
  );

  const isCash = selectedMethod === 'CASH';
  const isMobileMoney =
    selectedMethod === 'ORANGE_MONEY' || selectedMethod === 'TELECEL_MONEY';
  const cashSelectionInfoText = useMemo(
    () => getCashSelectionInfoText(isTontineCreator),
    [isTontineCreator]
  );
  const cashSummaryInfoText = useMemo(
    () => getCashSummaryInfoText(formatFcfa(totalAmount), isTontineCreator),
    [isTontineCreator, totalAmount]
  );

  // Nombre d'étapes selon le mode
  const totalSteps = isCash ? 3 : 4;

  const paymentPhone = useMemo(() => {
    if (isCash) return null;
    return useProfilePhone ? (userPhone ?? '') : alternatePhone;
  }, [isCash, useProfilePhone, userPhone, alternatePhone]);

  const canProceedStep2 = useMemo(() => {
    if (!selectedMethod) return false;
    if (isCash) return true;
    return useProfilePhone
      ? RCA_PHONE_REGEX.test(userPhone ?? '')
      : RCA_PHONE_REGEX.test(alternatePhone);
  }, [selectedMethod, isCash, useProfilePhone, userPhone, alternatePhone]);
  const invalidatePaymentQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['cycle', 'current', tontineUid] });
    queryClient.invalidateQueries({ queryKey: ['members', tontineUid] });
    queryClient.invalidateQueries({ queryKey: ['nextPayment'] });
    queryClient.invalidateQueries({ queryKey: ['tontines'] });
  }, [queryClient, tontineUid]);

  // ── Navigation entre étapes ────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    if (step > 1) {
      setStep((s) => s - 1);
      setPinValue('');
      setPhoneError(null);
    } else {
      navigation.goBack();
    }
  }, [step, navigation]);

  const handleNext = useCallback(() => {
    if (step === 2 && !isCash) {
      const phone = useProfilePhone ? (userPhone ?? '') : alternatePhone;
      if (!RCA_PHONE_REGEX.test(phone)) {
        setPhoneError(
          t('payment.phoneInvalid', 'Format invalide : +236 suivi de 8 chiffres')
        );
        return;
      }
      setPhoneError(null);
    }
    setStep((s) => Math.min(s + 1, totalSteps));
  }, [step, isCash, useProfilePhone, userPhone, alternatePhone, totalSteps, t]);

  // ── Soumission du paiement ─────────────────────────────────────────────────

  const submitPayment = useCallback(async () => {
    if (hasSubmitted.current || isSubmitting) return;
    if (!selectedMethod) return;

    hasSubmitted.current = true;
    setIsSubmitting(true);

    try {
      const submissionMode = resolvePaymentSubmissionMode(selectedMethod, isTontineCreator);

      if (submissionMode !== 'MOBILE_MONEY') {
        const receiverName = isTontineCreator
          ? currentUser?.fullName?.trim() || tontineCreatorName || 'Organisateur'
          : tontineCreatorName || 'Organisateur';
        const result = await initiateCashPayment({
          cycleUid,
          amount: totalAmount,
          idempotencyKey: idempotencyKey.current,
          receiverName,
        });
        invalidatePaymentQueries();

        if (submissionMode === 'CASH_CREATOR') {
          (navigation as unknown as { navigate: (name: string, params: object) => void }).navigate(
            'PaymentStatusScreen',
            {
              paymentUid: result.paymentUid,
              tontineUid,
              tontineName,
              amount: totalAmount,
              method: 'CASH',
              initialStatus: 'COMPLETED',
            }
          );
          return;
        }

        (navigation as unknown as { navigate: (n: string, p: object) => void }).navigate(
          'CashProofScreen',
          {
            paymentUid: result.paymentUid,
            tontineUid,
            tontineName,
            amount: totalAmount,
          }
        );
        return;
      }

      const mobileMoneyMethod = selectedMethod as MobileMoneyMethod;
      const result = await initiatePayment({
        cycleUid,
        amount: totalAmount,
        method: mobileMoneyMethod,
        idempotencyKey: idempotencyKey.current,
      });
      const initialStatus = result.status;
      invalidatePaymentQueries();

      // Orange / Telecel : COMPLETED immédiat → invalider agrégats
      if (initialStatus === 'COMPLETED') {
        queryClient.invalidateQueries({ queryKey: ['score', 'me'] });
        queryClient.invalidateQueries({ queryKey: ['payments', 'history'] });
      }

      (navigation as unknown as { navigate: (name: string, params: object) => void }).navigate(
        'PaymentStatusScreen',
        {
          paymentUid: result.uid,
          tontineUid,
          tontineName,
          amount: totalAmount,
          method: selectedMethod,
          initialStatus,
        }
      );
    } catch (err: unknown) {
      hasSubmitted.current = false;
      const apiErr = parseApiError(err);
      const { title, message, isFinal } = resolveErrorMessage(err, t);
      const submissionMode = resolvePaymentSubmissionMode(selectedMethod, isTontineCreator);

      logger.error('[PaymentScreen] payment submission failed', {
        method: selectedMethod,
        code: apiErr.code,
      });

      if (
        apiErr.httpStatus === 409 &&
        apiErr.code !== ApiErrorCode.PAYMENT_DUPLICATE &&
        submissionMode !== 'CASH_CREATOR'
      ) {
        Alert.alert(
          t('payment.inProgress', 'Paiement en cours'),
          t(
            'payment.inProgressMessage',
            'Un paiement est déjà en cours pour ce cycle.'
          ),
          [{ text: t('common.ok', 'OK') }]
        );
        return;
      }

      Alert.alert(title, message, [
        {
          text: t('common.ok', 'OK'),
          onPress:
            apiErr.code === ApiErrorCode.PAYMENT_DUPLICATE
              ? () => {
                  queryClient.invalidateQueries({ queryKey: ['tontines'] });
                  queryClient.invalidateQueries({ queryKey: ['nextPayment'] });
                  navigation.goBack();
                }
              : isFinal
                ? () => {
                    navigation.goBack();
                  }
                : undefined,
        },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isSubmitting,
    selectedMethod,
    cycleUid,
    totalAmount,
    tontineUid,
    tontineName,
    isTontineCreator,
    currentUser,
    tontineCreatorName,
    queryClient,
    invalidatePaymentQueries,
    navigation,
    t,
  ]);

  const handlePinComplete = useCallback(
    (pin: string) => {
      if (pin.length === PIN_LENGTH) {
        void submitPayment();
      }
    },
    [submitPayment]
  );

  // ── Rendu ─────────────────────────────────────────────────────────────────

  const stepLabel = isCash ? `Étape ${step} sur 3` : `Étape ${step} sur 4`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Retour')}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {tontineName}
          </Text>
          <Text style={styles.headerStep}>{stepLabel}</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* Barre de progression */}
      <View style={styles.progressBar}>
        <View
          style={[styles.progressFill, { width: `${(step / totalSteps) * 100}%` }]}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ══════════════════════════════════════════════════════════════
            ÉTAPE 1 — Détail de la cotisation (commun à tous les modes)
        ══════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Détail de la cotisation</Text>
            <Text style={styles.stepSubtitle}>
              Cycle {cycleNumber} — {tontineName}
            </Text>

            <View style={styles.amountCard}>
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>Cotisation de base</Text>
                <Text style={styles.amountValue}>{formatFcfa(baseAmount)}</Text>
              </View>
              {(penaltyAmount ?? 0) > 0 && (
                <View style={styles.amountRow}>
                  <View>
                    <Text style={[styles.amountLabel, styles.penaltyText]}>
                      Pénalité de retard
                    </Text>
                    {penaltyDays != null && penaltyDays > 0 && (
                      <Text style={styles.penaltyDays}>
                        {penaltyDays} jour{penaltyDays > 1 ? 's' : ''} de retard
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.amountValue, styles.penaltyText]}>
                    + {formatFcfa(penaltyAmount ?? 0)}
                  </Text>
                </View>
              )}
              <View style={styles.divider} />
              <View style={styles.amountRow}>
                <Text style={styles.totalLabel}>Total à payer</Text>
                <Text style={styles.totalValue}>{formatFcfa(totalAmount)}</Text>
              </View>
            </View>

            <View style={styles.infoBlock}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#0055A5" />
              <Text style={styles.infoText}>
                Paiement sécurisé. Un identifiant unique garantit qu'aucun doublon ne
                sera débité même en cas d'interruption réseau.
              </Text>
            </View>

            <Pressable style={styles.primaryBtn} onPress={handleNext}>
              <Text style={styles.primaryBtnText}>Choisir le mode de paiement</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════
            ÉTAPE 2 — Sélection méthode + numéro (Mobile Money)
                    ou déjà récapitulatif (CASH)
        ══════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Mode de paiement</Text>
            <Text style={styles.stepSubtitle}>
              Choisissez comment régler votre cotisation
            </Text>

            {paymentMethods.map((method) => {
              const isSelected = selectedMethod === method.id;
              return (
                <View key={method.id}>
                  <Pressable
                    style={[
                      styles.methodCard,
                      isSelected && styles.methodCardSelected,
                      isSelected && { borderColor: method.color },
                    ]}
                    onPress={() => {
                      setSelectedMethod(method.id);
                      setPhoneError(null);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                  >
                    <View
                      style={[
                        styles.methodIcon,
                        { backgroundColor: `${method.color}18` },
                      ]}
                    >
                      <Ionicons name={method.icon} size={26} color={method.color} />
                    </View>

                    <View style={styles.methodInfo}>
                      <View style={styles.methodLabelRow}>
                        <Text style={styles.methodLabel}>{method.label}</Text>
                        {method.badge && (
                          <View
                            style={[
                              styles.methodBadge,
                              { backgroundColor: `${method.color}20` },
                            ]}
                          >
                            <Text style={[styles.methodBadgeText, { color: method.color }]}>
                              {method.badge}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.methodSublabel}>{method.sublabel}</Text>
                    </View>

                    <View
                      style={[
                        styles.radioOuter,
                        isSelected && {
                          borderColor: method.color,
                          backgroundColor: method.color,
                        },
                      ]}
                    >
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </Pressable>

                  {/* Saisie numéro — uniquement Mobile Money sélectionné */}
                  {isSelected && method.flow === 'MOBILE_MONEY' && (
                    <View style={styles.phoneSection}>
                      <Text style={styles.phoneSectionTitle}>
                        Numéro {method.label}
                      </Text>

                      <Pressable
                        style={styles.phoneOptionRow}
                        onPress={() => {
                          setUseProfilePhone(true);
                          setPhoneError(null);
                        }}
                      >
                        <View
                          style={[
                            styles.radioOuter,
                            useProfilePhone && {
                              borderColor: method.color,
                              backgroundColor: method.color,
                            },
                          ]}
                        >
                          {useProfilePhone && <View style={styles.radioInner} />}
                        </View>
                        <View>
                          <Text style={styles.phoneOptionLabel}>
                            Mon numéro enregistré
                          </Text>
                          <Text style={styles.phoneOptionValue}>
                            {userPhone ? maskPhone(userPhone) : 'Non renseigné'}
                          </Text>
                        </View>
                      </Pressable>

                      <Pressable
                        style={styles.phoneOptionRow}
                        onPress={() => setUseProfilePhone(false)}
                      >
                        <View
                          style={[
                            styles.radioOuter,
                            !useProfilePhone && {
                              borderColor: method.color,
                              backgroundColor: method.color,
                            },
                          ]}
                        >
                          {!useProfilePhone && <View style={styles.radioInner} />}
                        </View>
                        <Text style={styles.phoneOptionLabel}>
                          Utiliser un autre numéro
                        </Text>
                      </Pressable>

                      {!useProfilePhone && (
                        <TextInput
                          style={[
                            styles.phoneInput,
                            phoneError && styles.phoneInputError,
                          ]}
                          placeholder="+23675 XX XX XX"
                          placeholderTextColor="#9CA3AF"
                          value={alternatePhone}
                          onChangeText={(v) => {
                            setAlternatePhone(v);
                            setPhoneError(null);
                          }}
                          keyboardType="phone-pad"
                          autoCapitalize="none"
                          autoCorrect={false}
                          maxLength={13}
                        />
                      )}
                      {phoneError && (
                        <Text style={styles.phoneError}>{phoneError}</Text>
                      )}
                    </View>
                  )}

                  {/* Info CASH sélectionné */}
                  {isSelected && method.flow === 'CASH' && (
                    <View style={styles.cashInfo}>
                      <Ionicons
                        name="information-circle-outline"
                        size={16}
                        color="#1A6B3C"
                      />
                      <Text style={styles.cashInfoText}>
                        {cashSelectionInfoText}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}

            <Pressable
              style={[styles.primaryBtn, !canProceedStep2 && styles.primaryBtnDisabled]}
              onPress={handleNext}
              disabled={!canProceedStep2}
            >
              <Text style={styles.primaryBtnText}>Continuer</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════
            ÉTAPE 3 — Récapitulatif avant paiement
        ══════════════════════════════════════════════════════════════ */}
        {step === 3 && selectedConfig && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Récapitulatif</Text>
            <Text style={styles.stepSubtitle}>
              Vérifiez les informations avant de confirmer
            </Text>

            <View style={styles.summaryCard}>
              <SummaryRow label="Tontine" value={tontineName} />
              <SummaryRow label="Cycle" value={`Cycle ${cycleNumber}`} />
              <SummaryRow
                label="Mode de paiement"
                value={selectedConfig.label}
                valueColor={selectedConfig.color}
              />
              {!isCash && paymentPhone && (
                <SummaryRow label="Numéro" value={maskPhone(paymentPhone)} />
              )}
              <SummaryRow label="Cotisation de base" value={formatFcfa(baseAmount)} />
              {(penaltyAmount ?? 0) > 0 && (
                <SummaryRow
                  label="Pénalité"
                  value={`+ ${formatFcfa(penaltyAmount ?? 0)}`}
                  valueColor="#D0021B"
                />
              )}
              <View style={styles.summaryDivider} />
              <SummaryRow label="Total" value={formatFcfa(totalAmount)} bold />
            </View>

            {/* Bloc informatif selon le mode */}
            {isCash && (
              <View style={styles.modeInfoCard}>
                <Ionicons name="cash-outline" size={22} color="#1A6B3C" />
                <View style={styles.modeInfoContent}>
                  <Text style={styles.modeInfoTitle}>Paiement en espèces</Text>
                  <Text style={styles.modeInfoBody}>
                    {cashSummaryInfoText}
                  </Text>
                </View>
              </View>
            )}

            {isMobileMoney && (
              <View style={styles.modeInfoCard}>
                <Ionicons
                  name="phone-portrait-outline"
                  size={22}
                  color={selectedConfig.color}
                />
                <View style={styles.modeInfoContent}>
                  <Text style={styles.modeInfoTitle}>
                    Paiement {selectedConfig.label}
                  </Text>
                  <Text style={styles.modeInfoBody}>
                    Une demande de confirmation sera envoyée sur votre téléphone. Vous
                    serez redirigé vers un écran de suivi en temps réel.
                  </Text>
                </View>
              </View>
            )}

            {/* CTA */}
            {isCash ? (
              <Pressable
                style={[
                  styles.primaryBtn,
                  styles.cashConfirmBtn,
                  isSubmitting && styles.primaryBtnDisabled,
                ]}
                onPress={() => {
                  void submitPayment();
                }}
                disabled={isSubmitting}
                accessibilityRole="button"
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.primaryBtnText}>
                      Confirmer — {formatFcfa(totalAmount)} en espèces
                    </Text>
                  </>
                )}
              </Pressable>
            ) : (
              <Pressable style={styles.primaryBtn} onPress={handleNext}>
                <Text style={styles.primaryBtnText}>
                  Saisir le code de confirmation
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </Pressable>
            )}
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════
            ÉTAPE 4 — PIN (Mobile Money uniquement)
        ══════════════════════════════════════════════════════════════ */}
        {step === 4 && selectedConfig && isMobileMoney && (
          <View style={styles.stepContainer}>
            <View style={styles.pinHeader}>
              <View
                style={[
                  styles.pinIconCircle,
                  { backgroundColor: `${selectedConfig.color}18` },
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={32}
                  color={selectedConfig.color}
                />
              </View>
              <Text style={styles.stepTitle}>Code de sécurité</Text>
              <Text style={styles.stepSubtitle}>
                Saisissez votre code PIN Kelemba pour autoriser le paiement de{' '}
                <Text style={{ fontWeight: '700', color: '#1A1A2E' }}>
                  {formatFcfa(totalAmount)}
                </Text>{' '}
                via {selectedConfig.label}
              </Text>
            </View>

            <View style={styles.pinMethodBadge}>
              <Ionicons
                name={selectedConfig.icon}
                size={16}
                color={selectedConfig.color}
              />
              <Text style={[styles.pinMethodText, { color: selectedConfig.color }]}>
                {selectedConfig.label}
                {paymentPhone ? ` — ${maskPhone(paymentPhone)}` : ''}
              </Text>
            </View>

            <PinPad
              value={pinValue}
              onChange={setPinValue}
              onComplete={handlePinComplete}
              digitLength={PIN_LENGTH}
            />

            {isSubmitting && (
              <View style={styles.submittingOverlay}>
                <ActivityIndicator size="large" color="#1A6B3C" />
                <Text style={styles.submittingText}>
                  Envoi de la demande de paiement…
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Sous-composant SummaryRow ────────────────────────────────────────────────

function SummaryRow({
  label,
  value,
  valueColor,
  bold = false,
}: {
  label: string;
  value: string;
  valueColor?: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        style={[
          styles.summaryValue,
          bold && styles.summaryValueBold,
          valueColor ? { color: valueColor } : null,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  headerStep: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  headerRight: {
    width: 44,
  },
  progressBar: {
    height: 3,
    backgroundColor: '#E5E7EB',
  },
  progressFill: {
    height: 3,
    backgroundColor: '#1A6B3C',
    borderRadius: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 48,
  },
  stepContainer: {
    gap: 16,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 2,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 4,
  },
  // ── Carte montant ──────────────────────────────────────────────────────────
  amountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  amountLabel: {
    fontSize: 15,
    color: '#6B7280',
  },
  amountValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  penaltyText: {
    color: '#D0021B',
  },
  penaltyDays: {
    fontSize: 12,
    color: '#D0021B',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A6B3C',
  },
  // ── Info block ─────────────────────────────────────────────────────────────
  infoBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 14,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  // ── Carte méthode ──────────────────────────────────────────────────────────
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    gap: 14,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  methodCardSelected: {
    borderWidth: 2,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodInfo: {
    flex: 1,
    gap: 4,
  },
  methodLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  methodLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  methodBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  methodBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  methodSublabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  // ── Section téléphone ──────────────────────────────────────────────────────
  phoneSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginTop: 4,
    gap: 12,
  },
  phoneSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  phoneOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  phoneOptionLabel: {
    fontSize: 14,
    color: '#1A1A2E',
    fontWeight: '500',
  },
  phoneOptionValue: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  phoneInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1A1A2E',
  },
  phoneInputError: {
    borderColor: '#D0021B',
  },
  phoneError: {
    fontSize: 12,
    color: '#D0021B',
    marginTop: -4,
  },
  // ── Info CASH sélectionné ──────────────────────────────────────────────────
  cashInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#E8F5EE',
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  cashInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#1A6B3C',
    lineHeight: 18,
  },
  // ── Récapitulatif ──────────────────────────────────────────────────────────
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A2E',
  },
  summaryValueBold: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A6B3C',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  // ── Bloc info mode ─────────────────────────────────────────────────────────
  modeInfoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modeInfoContent: {
    flex: 1,
    gap: 6,
  },
  modeInfoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  modeInfoBody: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  // ── CTA ───────────────────────────────────────────────────────────────────
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1A6B3C',
    borderRadius: 14,
    paddingVertical: 16,
    minHeight: 56,
    shadowColor: '#1A6B3C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  cashConfirmBtn: {
    backgroundColor: '#1A6B3C',
  },
  primaryBtnDisabled: {
    opacity: 0.55,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // ── PIN ───────────────────────────────────────────────────────────────────
  pinHeader: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  pinIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinMethodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pinMethodText: {
    fontSize: 14,
    fontWeight: '600',
  },
  submittingOverlay: {
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
  },
  submittingText: {
    fontSize: 14,
    color: '#6B7280',
  },
});
