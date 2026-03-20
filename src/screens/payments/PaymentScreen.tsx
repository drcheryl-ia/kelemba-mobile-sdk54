/**
 * Écran de paiement complet — 4 étapes séquentielles.
 * Étape 1 : Détail cotisation (montant + pénalités)
 * Étape 2 : Sélection moyen de paiement
 * Étape 3 : Récapitulatif avant confirmation
 * Étape 4 : Saisie PIN → appel API initiate
 */
import React, { useState, useCallback, useEffect } from 'react';
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
import { selectUserUid, selectUserPhone } from '@/store/authSlice';
import { initiatePayment } from '@/api/paymentApi';
import { parseApiError } from '@/api/errors/errorHandler';
import { ApiErrorCode } from '@/api/errors/errorCodes';
import { logger } from '@/utils/logger';
import { formatFcfa } from '@/utils/formatters';
import { PinPad } from '@/components/auth';
import { CONSTANTS } from '@/config/constants';
import type { PaymentMethod } from '@/types/payment';
import { maskPhone } from '@/utils/formatters';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentScreen'>;

const PAYMENT_METHODS: {
  id: PaymentMethod;
  label: string;
  icon: string;
  color: string;
}[] = [
  { id: 'ORANGE_MONEY', label: 'Orange Money', icon: 'phone-portrait-outline', color: '#F5A623' },
  { id: 'TELECEL_MONEY', label: 'Telecel Money', icon: 'phone-portrait-outline', color: '#0055A5' },
];

const RCA_PHONE_REGEX = /^\+236\d{8}$/;

export const PaymentScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
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

  const totalAmount = baseAmount + penaltyAmount;
  const [step, setStep] = useState(1);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [useProfilePhone, setUseProfilePhone] = useState(true);
  const [alternatePhone, setAlternatePhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [pinValue, setPinValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    if (!userPhone && useProfilePhone) {
      setUseProfilePhone(false);
    }
  }, [userPhone, useProfilePhone]);

  const paymentPhone = useProfilePhone ? (userPhone ?? '') : alternatePhone;
  const canProceedStep2 =
    selectedMethod &&
    (useProfilePhone ? RCA_PHONE_REGEX.test(userPhone ?? '') : RCA_PHONE_REGEX.test(alternatePhone));

  const handleNext = useCallback(() => {
    if (step === 2) {
      if (!useProfilePhone && !RCA_PHONE_REGEX.test(alternatePhone)) {
        setPhoneError(t('payment.phoneInvalid', 'Numéro RCA invalide (+236 suivi de 8 chiffres)'));
        return;
      }
      setPhoneError(null);
    }
    if (step < 4) setStep(step + 1);
  }, [step, useProfilePhone, alternatePhone, t]);

  const handleBack = useCallback(() => {
    if (step > 1) {
      setStep(step - 1);
      setPinValue('');
      setPinError(null);
      setPhoneError(null);
    } else {
      navigation.goBack();
    }
  }, [step, navigation]);

  const handleMethodSelect = useCallback((method: PaymentMethod) => {
    setSelectedMethod(method);
  }, []);

  const verifyPinAndPay = useCallback(
    async (_enteredPin: string) => {
      if (!selectedMethod || totalAmount < 500) return;

    setIsSubmitting(true);
    setPinError(null);

    const idempotencyKey = crypto.randomUUID();
    try {
      const { uid } = await initiatePayment({
        cycleUid,
        amount: totalAmount,
        method: selectedMethod,
        idempotencyKey,
      });
      queryClient.invalidateQueries({ queryKey: ['cycle', 'current', tontineUid] });
      queryClient.invalidateQueries({ queryKey: ['members', tontineUid] });
      if (userUid) {
        queryClient.invalidateQueries({ queryKey: ['nextPayment', userUid] });
      }
      queryClient.invalidateQueries({ queryKey: ['payments', 'history'] });

      (navigation as { navigate: (name: string, params: object) => void }).navigate(
        'PaymentStatusScreen',
        {
          paymentUid: uid,
          tontineUid,
          tontineName,
          amount: totalAmount,
          method: selectedMethod,
        }
      );
    } catch (err: unknown) {
      const apiErr = parseApiError(err);
      if (apiErr.httpStatus === 403 && apiErr.code === ApiErrorCode.KYC_NOT_VERIFIED) {
        Alert.alert(
          t('payment.kycRequired', 'KYC requis'),
          t('payment.kycMessage', 'Veuillez compléter votre vérification d\'identité.'),
          [{ text: t('common.ok') }]
        );
      } else if (apiErr.httpStatus === 409) {
        const isDuplicate = apiErr.code === ApiErrorCode.PAYMENT_DUPLICATE;
        Alert.alert(
          isDuplicate
            ? t('payment.alreadyPaidTitle', 'Cotisation déjà réglée')
            : t('payment.inProgress', 'Paiement en cours'),
          isDuplicate
            ? t(
                'payment.alreadyPaidMessage',
                "Votre cotisation pour ce cycle a déjà été enregistrée. L'historique et le score ne seront pas modifiés."
              )
            : t('payment.inProgressMessage', 'Un paiement est déjà en cours pour ce cycle.'),
          [
            {
              text: t('common.ok'),
              onPress: isDuplicate
                ? () => {
                    queryClient.invalidateQueries({ queryKey: ['tontines'] });
                    queryClient.invalidateQueries({ queryKey: ['nextPayment'] });
                    navigation.goBack();
                  }
                : undefined,
            },
          ]
        );
      } else if (apiErr.httpStatus === 400) {
        Alert.alert(t('common.error'), apiErr.message, [{ text: t('common.ok') }]);
      } else {
        Alert.alert(
          t('common.error'),
          t('register.errorNetwork', 'Vérifiez votre connexion et réessayez.'),
          [{ text: t('common.ok') }]
        );
      }
      logger.error('PaymentScreen initiatePayment failed', { code: apiErr.code });
    } finally {
      setIsSubmitting(false);
    }
  },
    [
      selectedMethod,
      totalAmount,
      cycleUid,
      tontineUid,
      userUid,
      queryClient,
      navigation,
      t,
    ]
  );

  const handlePinComplete = useCallback(
    (value: string) => {
      void verifyPinAndPay(value);
    },
    [verifyPinAndPay]
  );

  const pinLength = CONSTANTS.PIN_LENGTH ?? 6;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
        </Pressable>
        <Text style={styles.headerTitle}>
          {t('payment.title', 'Paiement')} — {t('payment.step', 'Étape')} {step}/4
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Étape 1 — Détail cotisation */}
        {step === 1 && (
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>
              {t('payment.detailTitle', 'Cotisation')} Cycle {cycleNumber} — {tontineName}
            </Text>
            <View style={styles.amountBlock}>
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>{t('payment.baseAmount', 'Montant de base')}</Text>
                <Text style={styles.amountValue}>{formatFcfa(baseAmount)}</Text>
              </View>
              {penaltyAmount > 0 && (
                <View style={styles.amountRow}>
                  <Text style={[styles.amountLabel, styles.penaltyLabel]}>
                    {t('payment.penalty', 'Retard')}
                    {penaltyDays != null ? ` (${penaltyDays} j)` : ''} → +{formatFcfa(penaltyAmount)}
                  </Text>
                </View>
              )}
              <View style={[styles.amountRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>{t('payment.total', 'Total à payer')}</Text>
                <Text style={styles.totalValue}>{formatFcfa(totalAmount)}</Text>
              </View>
            </View>
            <Pressable style={styles.primaryBtn} onPress={handleNext}>
              <Text style={styles.primaryBtnText}>{t('common.continue', 'Continuer')}</Text>
            </Pressable>
          </View>
        )}

        {/* Étape 2 — Moyen de paiement + numéro */}
        {step === 2 && (
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>
              {t('payment.methodTitle', 'Choisir le moyen de paiement')}
            </Text>
            {PAYMENT_METHODS.map((m) => (
              <View key={m.id} style={styles.methodCardWrapper}>
                <Pressable
                  style={[
                    styles.methodCard,
                    selectedMethod === m.id && styles.methodCardSelected,
                  ]}
                  onPress={() => handleMethodSelect(m.id)}
                >
                  <Ionicons
                    name={m.icon as keyof typeof Ionicons.glyphMap}
                    size={28}
                    color={selectedMethod === m.id ? m.color : '#6B7280'}
                  />
                  <Text
                    style={[
                      styles.methodLabel,
                      selectedMethod === m.id && styles.methodLabelSelected,
                    ]}
                  >
                    {m.label}
                  </Text>
                  {selectedMethod === m.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#1A6B3C" />
                  )}
                </Pressable>
                {selectedMethod === m.id && (
                  <View style={styles.phoneOptions}>
                    <Text style={styles.phoneProfileLabel}>
                      {t('payment.phoneProfile', 'Numéro lié au profil')} :{' '}
                      {userPhone ? maskPhone(userPhone) : '—'}
                    </Text>
                    <Pressable
                      style={styles.radioRow}
                      onPress={() => {
                        setUseProfilePhone(true);
                        setAlternatePhone('');
                        setPhoneError(null);
                      }}
                    >
                      <View
                        style={[
                          styles.radio,
                          useProfilePhone && styles.radioSelected,
                        ]}
                      />
                      <Text style={styles.radioLabel}>
                        {t('payment.useProfilePhone', 'Utiliser ce numéro')}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.radioRow}
                      onPress={() => setUseProfilePhone(false)}
                    >
                      <View
                        style={[
                          styles.radio,
                          !useProfilePhone && styles.radioSelected,
                        ]}
                      />
                      <Text style={styles.radioLabel}>
                        {t('payment.useOtherPhone', 'Utiliser un autre numéro')}
                      </Text>
                    </Pressable>
                    {!useProfilePhone && (
                      <TextInput
                        style={[styles.phoneInput, phoneError && styles.phoneInputError]}
                        placeholder="+23675100010"
                        placeholderTextColor="#9CA3AF"
                        value={alternatePhone}
                        onChangeText={(v) => {
                          setAlternatePhone(v);
                          setPhoneError(null);
                        }}
                        keyboardType="phone-pad"
                        autoCapitalize="none"
                      />
                    )}
                  </View>
                )}
              </View>
            ))}
            {phoneError && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={20} color="#D0021B" />
                <Text style={styles.errorText}>{phoneError}</Text>
              </View>
            )}
            <Pressable
              style={[styles.primaryBtn, !canProceedStep2 && styles.primaryBtnDisabled]}
              onPress={handleNext}
              disabled={!canProceedStep2}
            >
              <Text style={styles.primaryBtnText}>{t('common.continue', 'Continuer')}</Text>
            </Pressable>
          </View>
        )}

        {/* Étape 3 — Récapitulatif */}
        {step === 3 && selectedMethod && (
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>
              {t('payment.summaryTitle', 'Récapitulatif')}
            </Text>
            <View style={styles.summaryBlock}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('payment.tontine', 'Tontine')}</Text>
                <Text style={styles.summaryValue}>{tontineName}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('payment.cycle', 'Cycle')}</Text>
                <Text style={styles.summaryValue}>{cycleNumber}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('payment.method', 'Moyen')}</Text>
                <Text style={styles.summaryValue}>
                  {PAYMENT_METHODS.find((x) => x.id === selectedMethod)?.label ?? selectedMethod}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('payment.phoneNumber', 'Numéro de paiement')}</Text>
                <Text style={styles.summaryValue}>{paymentPhone ? maskPhone(paymentPhone) : '—'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('payment.baseAmount', 'Montant de base')}</Text>
                <Text style={styles.summaryValue}>{formatFcfa(baseAmount)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('payment.penalty', 'Pénalités')}</Text>
                <Text style={styles.summaryValue}>
                  {penaltyAmount > 0 ? formatFcfa(penaltyAmount) : t('payment.none', 'Aucune')}
                </Text>
              </View>
              <View style={[styles.summaryRow, styles.summaryTotal]}>
                <Text style={styles.totalLabel}>{t('payment.total', 'Total')}</Text>
                <Text style={styles.totalValue}>{formatFcfa(totalAmount)}</Text>
              </View>
            </View>
            <Pressable style={styles.primaryBtn} onPress={handleNext}>
              <Text style={styles.primaryBtnText}>
                {t('payment.confirmAndPay', 'Confirmer et payer')}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Étape 4 — Saisie PIN */}
        {step === 4 && selectedMethod && (
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>
              {t('payment.pinTitle', 'Saisissez votre PIN')}
            </Text>
            <Text style={styles.pinSubtitle}>
              {t('payment.pinSubtitle', 'Entrez votre PIN de sécurité pour valider le paiement')}
            </Text>
            {pinError && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={20} color="#D0021B" />
                <Text style={styles.errorText}>{pinError}</Text>
              </View>
            )}
            <PinPad
              value={pinValue}
              onChange={setPinValue}
              onComplete={handlePinComplete}
              digitLength={pinLength}
            />
            {isSubmitting && (
              <View style={styles.loaderOverlay}>
                <ActivityIndicator size="large" color="#1A6B3C" />
                <Text style={styles.loaderText}>{t('payment.processing', 'Traitement...')}</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  stepCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  detailValue: {
    fontSize: 14,
    color: '#6B7280',
  },
  amountBlock: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  amountLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  amountValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  penaltyLabel: {
    color: '#92400E',
  },
  penaltyValue: {
    color: '#D0021B',
  },
  totalRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A6B3C',
  },
  methodCardWrapper: {
    marginBottom: 16,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  phoneOptions: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  phoneProfileLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  radioSelected: {
    borderColor: '#1A6B3C',
    backgroundColor: '#1A6B3C',
  },
  radioLabel: {
    fontSize: 14,
    color: '#1A1A2E',
    fontWeight: '500',
  },
  phoneInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1A1A2E',
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  phoneInputError: {
    borderColor: '#D0021B',
  },
  methodCardSelected: {
    borderColor: '#1A6B3C',
    backgroundColor: '#E8F5EE',
  },
  methodLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  methodLabelSelected: {
    color: '#1A6B3C',
  },
  summaryBlock: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  summaryTotal: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  primaryBtn: {
    backgroundColor: '#1A6B3C',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pinSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#D0021B',
    fontWeight: '600',
  },
  loaderOverlay: {
    marginTop: 24,
    alignItems: 'center',
    gap: 12,
  },
  loaderText: {
    fontSize: 14,
    color: '#6B7280',
  },
});
