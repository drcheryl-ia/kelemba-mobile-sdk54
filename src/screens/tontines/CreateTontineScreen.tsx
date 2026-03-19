import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import type { RootState } from '@/store/store';
import { selectAccountType } from '@/store/authSlice';
import { createTontine } from '@/api/tontinesApi';
import { parseApiError } from '@/api/errors/errorHandler';
import { logger } from '@/utils/logger';
import { parseFcfa, formatFcfa } from '@/utils/formatters';
import type { CreateTontineDto } from '@/api/types/api.types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateTontine'>;

const step1Schema = z.object({
  name: z
    .string()
    .min(3, 'Le nom doit contenir au moins 3 caractères')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères'),
  amountPerShare: z
    .number({ invalid_type_error: 'Montant requis' })
    .int('Le montant doit être un entier FCFA')
    .min(500, 'Minimum 500 FCFA par part'),
  frequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY']),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu : YYYY-MM-DD')
    .refine(
      (val) => new Date(val) > new Date(),
      'La date de début doit être dans le futur'
    ),
});

const step2Schema = z
  .object({
    penaltyType: z.enum(['FIXED', 'PERCENTAGE']),
    penaltyValue: z
      .number()
      .int()
      .min(0, 'La valeur de pénalité doit être positive'),
    gracePeriodDays: z.number().int().min(0).max(7),
    suspensionAfterDays: z.number().int().min(1).max(30),
  })
  .refine(
    (data) =>
      !(data.penaltyType === 'PERCENTAGE' && data.penaltyValue > 100),
    { message: 'Le pourcentage ne peut pas dépasser 100 %', path: ['penaltyValue'] }
  );

const step3Schema = z.object({
  rotationType: z.enum(['RANDOM', 'MANUAL']),
});

const fullSchema = step1Schema.merge(step2Schema).merge(step3Schema);

type FormData = z.infer<typeof fullSchema>;

const STEP1_FIELDS = ['name', 'amountPerShare', 'frequency', 'startDate'] as const;
const STEP2_FIELDS = ['penaltyType', 'penaltyValue', 'gracePeriodDays', 'suspensionAfterDays'] as const;
const STEP3_FIELDS = ['rotationType'] as const;

function formatDateToDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const TOMORROW = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d;
})();

function getTomorrowISO(): string {
  const y = TOMORROW.getFullYear();
  const m = String(TOMORROW.getMonth() + 1).padStart(2, '0');
  const day = String(TOMORROW.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const CreateTontineScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const accountType = useSelector(selectAccountType);

  const [step, setStep] = useState(1);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    trigger,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(fullSchema),
    defaultValues: {
      name: '',
      amountPerShare: 500,
      frequency: 'MONTHLY',
      startDate: getTomorrowISO(),
      penaltyType: 'FIXED',
      penaltyValue: 0,
      gracePeriodDays: 0,
      suspensionAfterDays: 7,
      rotationType: 'RANDOM',
    },
  });

  const frequency = watch('frequency');
  const penaltyType = watch('penaltyType');
  const startDate = watch('startDate');

  useEffect(() => {
    if (accountType !== 'ORGANISATEUR') {
      Alert.alert(
        t('createTontine.accessDeniedTitle', 'Accès réservé'),
        t('createTontine.accessDeniedMessage', 'Seuls les organisateurs peuvent créer des tontines.'),
        [{ text: t('common.back'), onPress: () => navigation.goBack() }]
      );
    }
  }, [accountType, navigation, t]);

  const handleNext = useCallback(async () => {
    const fields =
      step === 1
        ? STEP1_FIELDS
        : step === 2
          ? STEP2_FIELDS
          : STEP3_FIELDS;
    const valid = await trigger([...fields]);
    if (valid) setStep((s) => Math.min(4, s + 1));
  }, [step, trigger]);

  const handleCancel = useCallback(() => {
    Alert.alert(
      t('createTontine.cancelTitle', 'Annuler'),
      t('createTontine.cancelMessage', 'Êtes-vous sûr de vouloir quitter ? Les données seront perdues.'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('createTontine.quit', 'Quitter'), style: 'destructive', onPress: () => navigation.goBack() },
      ]
    );
  }, [navigation, t]);

  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    const payload: CreateTontineDto = {
      name: data.name,
      amountPerShare: Math.round(data.amountPerShare),
      frequency: data.frequency,
      startDate: data.startDate,
      rotationMode: data.rotationType,
      rules: {
        penaltyType: data.penaltyType,
        penaltyValue: data.penaltyValue,
        gracePeriodDays: data.gracePeriodDays,
        suspensionAfterDays: data.suspensionAfterDays,
      },
    };

    try {
      const tontine = await createTontine(payload);
      queryClient.invalidateQueries({ queryKey: ['tontines'] });
      navigation.replace('TontineDetails', { tontineUid: tontine.uid });
    } catch (err: unknown) {
      const apiErr = parseApiError(err);
      logger.error('CreateTontine submit failed', { code: apiErr.code });

      if (apiErr.httpStatus === 400 && apiErr.details) {
        const details = apiErr.details as Record<string, string[]>;
        for (const [field, messages] of Object.entries(details)) {
          const msg = Array.isArray(messages) ? messages[0] : String(messages);
          setError(field as keyof FormData, { message: msg });
        }
        return;
      }
      if (apiErr.httpStatus === 403) {
        setSubmitError(t('createTontine.errorKyc', 'KYC requis pour créer une tontine.'));
        return;
      }
      if (apiErr.httpStatus === 409) {
        setSubmitError(t('createTontine.errorNameExists', 'Ce nom de tontine existe déjà.'));
        return;
      }
      setSubmitError(t('register.errorNetwork', 'Vérifiez votre connexion et réessayez.'));
    }
  };

  const onDateChange = (_: unknown, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const y = selectedDate.getFullYear();
      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const d = String(selectedDate.getDate()).padStart(2, '0');
      setValue('startDate', `${y}-${m}-${d}`);
    }
  };

  if (accountType !== 'ORGANISATEUR') {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={handleCancel}
            style={styles.headerBackButton}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Ionicons name="arrow-back" size={24} color="#1A6B3C" />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {t('createTontine.screenTitle', 'Création de Tontine')} | Kelemba
          </Text>
          <Pressable
            style={styles.headerHelpButton}
            hitSlop={12}
            onPress={() =>
              Alert.alert(
                t('common.help', 'Aide'),
                t('createTontine.helpMessage', 'Remplissez les étapes pour créer votre tontine. Le nombre de tours est calculé automatiquement selon les parts des membres.')
              )
            }
            accessibilityRole="button"
            accessibilityLabel={t('common.help', 'Aide')}
          >
            <Ionicons name="help-circle-outline" size={24} color="#6B7280" />
          </Pressable>
        </View>
        <View style={styles.progressContainer}>
          {[1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                i === step && styles.progressDotActive,
                i < step && styles.progressDotCompleted,
              ]}
            />
          ))}
        </View>
        <Text style={styles.stepLabel}>
          {t('createTontine.stepLabel', 'Étape')} {step} / 4
        </Text>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {submitError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{submitError}</Text>
            </View>
          )}

          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.sectionTitle}>{t('createTontine.nameLabel', 'Nom de la tontine')}</Text>
              <Text style={styles.sectionSubtitle}>{t('createTontine.namePlaceholder', 'Ex : Tontine Solidarité Bangui')}</Text>
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[styles.input, styles.inputPremium, errors.name && styles.inputError]}
                    placeholder={t('createTontine.namePlaceholder', 'Ex : Tontine Solidarité Bangui')}
                    placeholderTextColor="#9CA3AF"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    autoCapitalize="words"
                  />
                )}
              />
              {errors.name && <Text style={styles.fieldError}>{errors.name.message}</Text>}

              <Text style={styles.sectionTitle}>{t('createTontine.amountLabel', 'Montant par part')}</Text>
              <Text style={styles.sectionSubtitle}>{t('createTontine.amountHint', 'Minimum 500 FCFA')}</Text>
              <Controller
                control={control}
                name="amountPerShare"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View style={[styles.amountInputWrapper, errors.amountPerShare && styles.inputError]}>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="500"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      onBlur={onBlur}
                      onChangeText={(txt) => onChange(parseFcfa(txt) || 0)}
                      value={value ? String(value) : ''}
                    />
                    <View style={styles.amountSuffix}>
                      <Text style={styles.amountSuffixText}>FCFA</Text>
                    </View>
                  </View>
                )}
              />
              {errors.amountPerShare && <Text style={styles.fieldError}>{errors.amountPerShare.message}</Text>}

              <Text style={styles.sectionTitle}>{t('createTontine.frequencyLabel', 'Fréquence')}</Text>
              <Text style={styles.sectionSubtitle}>{t('createTontine.frequencyHint', 'Choisissez la périodicité des cotisations')}</Text>
              <View style={styles.frequencyRow}>
                {(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const).map((f) => (
                  <Controller
                    key={f}
                    control={control}
                    name="frequency"
                    render={({ field: { onChange, value } }) => (
                      <Pressable
                        style={[styles.freqCard, value === f && styles.freqCardActive]}
                        onPress={() => onChange(f)}
                      >
                        <Text style={[styles.freqCardText, value === f && styles.freqCardTextActive]}>
                          {t(`createTontine.freq${f}`, f)}
                        </Text>
                      </Pressable>
                    )}
                  />
                ))}
              </View>

              <Text style={styles.sectionTitle}>{t('createTontine.startDateLabel', 'Date de début')}</Text>
              <Text style={styles.sectionSubtitle}>{t('createTontine.startDateHint', 'Date du premier tour')}</Text>
              <Controller
                control={control}
                name="startDate"
                render={({ field: { value } }) => (
                  <Pressable
                    style={[styles.input, styles.inputPremium, styles.dateButton, errors.startDate && styles.inputError]}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                    <Text style={[styles.dateText, value ? {} : styles.datePlaceholder]}>
                      {value ? formatDateToDisplay(value) : 'JJ/MM/AAAA'}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  </Pressable>
                )}
              />
              {showDatePicker && (
                <DateTimePicker
                  value={startDate ? new Date(startDate) : TOMORROW}
                  mode="date"
                  minimumDate={TOMORROW}
                  onChange={onDateChange}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                />
              )}
              {errors.startDate && <Text style={styles.fieldError}>{errors.startDate.message}</Text>}

              <View style={styles.summaryCard}>
                <View style={styles.summaryCardIcon}>
                  <Ionicons name="wallet-outline" size={28} color={KELEMBA_GREEN} />
                </View>
                <Text style={styles.summaryCardTitle}>{t('createTontine.summaryCardTitle', 'Récapitulatif')}</Text>
                <Text style={styles.summaryCardAmount}>{formatFcfa(watch('amountPerShare'))}</Text>
                <Text style={styles.summaryCardHint}>{t('createTontine.toursCalculatedAuto', 'Nombre de tours calculé automatiquement selon les parts actives')}</Text>
                <Text style={styles.summaryCardHint}>{t('createTontine.onePartOneRotation', '1 part = 1 passage dans la rotation')}</Text>
                <Text style={styles.summaryCardHint}>{t('createTontine.multiPartsCotise', 'Un membre avec plusieurs parts cotise et reçoit plusieurs fois')}</Text>
                <Text style={styles.summaryCardExample}>
                  {t('createTontine.contributionExample', 'Exemple par tour')} : 1 part = {formatFcfa(watch('amountPerShare'))}, 2 parts = {formatFcfa((watch('amountPerShare') || 0) * 2)}, 3 parts = {formatFcfa((watch('amountPerShare') || 0) * 3)}
                </Text>
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.sectionTitle}>{t('createTontine.penaltyTypeLabel', 'Type de pénalité')}</Text>
              <Text style={styles.sectionSubtitle}>{t('createTontine.penaltyHint', 'En cas de retard de paiement')}</Text>
              <View style={styles.toggleRow}>
                <Controller
                  control={control}
                  name="penaltyType"
                  render={({ field: { onChange, value } }) => (
                    <>
                      <Pressable
                        style={[styles.toggleCard, value === 'FIXED' && styles.toggleCardActive]}
                        onPress={() => onChange('FIXED')}
                      >
                        <Text style={[styles.toggleCardText, value === 'FIXED' && styles.toggleCardTextActive]}>
                          {t('createTontine.penaltyFixed', 'Montant fixe (FCFA)')}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.toggleCard, value === 'PERCENTAGE' && styles.toggleCardActive]}
                        onPress={() => onChange('PERCENTAGE')}
                      >
                        <Text style={[styles.toggleCardText, value === 'PERCENTAGE' && styles.toggleCardTextActive]}>
                          {t('createTontine.penaltyPercentage', 'Pourcentage par jour (%)')}
                        </Text>
                      </Pressable>
                    </>
                  )}
                />
              </View>

              <Text style={styles.sectionTitle}>{t('createTontine.penaltyValueLabel', 'Valeur')}</Text>
              <Text style={styles.sectionSubtitle}>{penaltyType === 'FIXED' ? 'Montant en FCFA' : 'Pourcentage par jour'}</Text>
              <Controller
                control={control}
                name="penaltyValue"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View style={[styles.penaltyValueWrapper, errors.penaltyValue && styles.inputError]}>
                    <TextInput
                      style={styles.penaltyValueInput}
                      placeholder="0"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      onBlur={onBlur}
                      onChangeText={(txt) => onChange(parseInt(txt, 10) || 0)}
                      value={value !== undefined ? String(value) : ''}
                    />
                    <View style={styles.penaltyValueSuffix}>
                      <Text style={styles.penaltyValueSuffixText}>
                        {penaltyType === 'FIXED' ? 'FCFA' : '%'}
                      </Text>
                    </View>
                  </View>
                )}
              />
              {errors.penaltyValue && <Text style={styles.fieldError}>{errors.penaltyValue.message}</Text>}

              <Text style={styles.sectionTitle}>
                {t('createTontine.gracePeriodLabel', 'Délai de grâce avant pénalité')}
              </Text>
              <Text style={styles.sectionSubtitle}>{t('createTontine.gracePeriodHint', 'jour(s)')}</Text>
              <Controller
                control={control}
                name="gracePeriodDays"
                render={({ field: { onChange, value } }) => (
                  <View style={styles.stepperRow}>
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <Pressable
                        key={n}
                        style={[styles.stepperChipPremium, value === n && styles.stepperChipPremiumActive]}
                        onPress={() => onChange(n)}
                      >
                        <Text style={[styles.stepperChipText, value === n && styles.stepperChipTextActive]}>
                          {n}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              />

              <Text style={styles.sectionTitle}>
                {t('createTontine.suspensionLabel', 'Suspension automatique après')}
              </Text>
              <Text style={styles.sectionSubtitle}>{t('createTontine.suspensionHint', 'jour(s) de retard')}</Text>
              <Controller
                control={control}
                name="suspensionAfterDays"
                render={({ field: { onChange, value } }) => (
                  <View style={styles.stepperRow}>
                    {[1, 3, 5, 7, 10, 14, 21, 30].map((n) => (
                      <Pressable
                        key={n}
                        style={[styles.stepperChipPremium, value === n && styles.stepperChipPremiumActive]}
                        onPress={() => onChange(n)}
                      >
                        <Text style={[styles.stepperChipText, value === n && styles.stepperChipTextActive]}>
                          {n}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              />
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.sectionTitle}>{t('createTontine.rotationLabel', 'Ordre de rotation')}</Text>
              <Text style={styles.sectionSubtitle}>{t('createTontine.rotationHint', "Comment déterminer l'ordre des bénéficiaires")}</Text>
              <Controller
                control={control}
                name="rotationType"
                render={({ field: { onChange, value } }) => (
                  <View style={styles.rotationCards}>
                    <Pressable
                      style={[styles.rotationCardPremium, value === 'RANDOM' && styles.rotationCardPremiumActive]}
                      onPress={() => onChange('RANDOM')}
                    >
                      <View style={[styles.rotationCardIcon, value === 'RANDOM' && styles.rotationCardIconActive]}>
                        <Ionicons
                          name="shuffle"
                          size={28}
                          color={value === 'RANDOM' ? '#FFFFFF' : KELEMBA_GREEN}
                        />
                      </View>
                      <Text style={[styles.rotationTitle, value === 'RANDOM' && styles.rotationTitleActive]}>
                        {t('createTontine.rotationRandom', 'Tirage au sort automatique')}
                      </Text>
                      <Text style={styles.rotationDesc}>
                        {t('createTontine.rotationRandomDesc', "L'ordre est tiré au sort lors du démarrage de la tontine")}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.rotationCardPremium, value === 'MANUAL' && styles.rotationCardPremiumActive]}
                      onPress={() => onChange('MANUAL')}
                    >
                      <View style={[styles.rotationCardIcon, value === 'MANUAL' && styles.rotationCardIconActive]}>
                        <Ionicons
                          name="list"
                          size={28}
                          color={value === 'MANUAL' ? '#FFFFFF' : KELEMBA_GREEN}
                        />
                      </View>
                      <Text style={[styles.rotationTitle, value === 'MANUAL' && styles.rotationTitleActive]}>
                        {t('createTontine.rotationManual', 'Ordre manuel')}
                      </Text>
                      <Text style={styles.rotationDesc}>
                        {t('createTontine.rotationManualDesc', "Vous définirez l'ordre après avoir invité vos membres")}
                      </Text>
                      <View style={styles.badgePremium}>
                        <Text style={styles.badgePremiumText}>
                          {t('createTontine.configurableAfter', 'Configurable après création')}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                )}
              />
            </View>
          )}

          {step === 4 && (
            <View style={styles.stepContent}>
              <Text style={styles.recapTitle}>{t('createTontine.summaryParams', 'Paramètres')}</Text>
              <View style={styles.summaryCardBlock}>
                <SummaryRow label={t('createTontine.nameLabel')} value={watch('name')} />
                <SummaryRow label={t('createTontine.amountLabel')} value={formatFcfa(watch('amountPerShare'))} />
                <SummaryRow label={t('createTontine.frequencyLabel')} value={t(`createTontine.freq${watch('frequency')}`)} />
                <SummaryRow label={t('createTontine.startDateLabel')} value={watch('startDate') ? formatDateToDisplay(watch('startDate')) : '—'} isLast />
              </View>
              <Text style={styles.recapTitle}>{t('createTontine.summaryRules', 'Règles')}</Text>
              <View style={styles.summaryCardBlock}>
                <SummaryRow
                  label={t('createTontine.penaltyTypeLabel')}
                  value={watch('penaltyType') === 'FIXED' ? t('createTontine.penaltyFixed') : t('createTontine.penaltyPercentage')}
                />
                <SummaryRow label={t('createTontine.penaltyValueLabel')} value={`${watch('penaltyValue')} ${watch('penaltyType') === 'FIXED' ? 'FCFA' : '%'}`} />
                <SummaryRow label={t('createTontine.gracePeriodLabel')} value={`${watch('gracePeriodDays')} jour(s)`} />
                <SummaryRow label={t('createTontine.suspensionLabel')} value={`${watch('suspensionAfterDays')} jour(s)`} isLast />
              </View>
              <Text style={styles.recapTitle}>{t('createTontine.summaryRotation', 'Rotation')}</Text>
              <View style={styles.summaryCardBlock}>
                <SummaryRow
                  label={t('createTontine.rotationLabel')}
                  value={watch('rotationType') === 'RANDOM' ? t('createTontine.rotationRandom') : t('createTontine.rotationManual')}
                  isLast
                />
              </View>
              <Pressable
                style={[styles.submitButtonPremium, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSubmit(onSubmit)}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel={t('createTontine.createButton', 'Créer la tontine')}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitTextPremium}>{t('createTontine.createButton', 'Créer la tontine')}</Text>
                )}
              </Pressable>
            </View>
          )}

          {step < 4 && (
            <View style={styles.navRow}>
              <Pressable
                style={styles.prevButton}
                onPress={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1}
              >
                <Text style={[styles.prevText, step === 1 && styles.prevTextDisabled]}>
                  {t('common.back')}
                </Text>
              </Pressable>
              <Pressable
                style={styles.nextButton}
                onPress={handleNext}
                accessibilityRole="button"
                accessibilityLabel={t('common.next')}
              >
                <Text style={styles.nextText}>{t('common.next')}</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

function SummaryRow({
  label,
  value,
  isLast,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.summaryRow, isLast && styles.summaryRowLast]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const KELEMBA_GREEN = '#1A6B3C';
const KELEMBA_GREEN_LIGHT = '#E8F5EE';
const BORDER_RADIUS = 16;
const BORDER_RADIUS_SM = 12;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBackButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: KELEMBA_GREEN_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: KELEMBA_GREEN,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  headerHelpButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  progressDotActive: {
    width: 24,
    borderRadius: 4,
    backgroundColor: KELEMBA_GREEN,
  },
  progressDotCompleted: {
    backgroundColor: KELEMBA_GREEN_LIGHT,
  },
  stepLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 10,
    textAlign: 'center',
    fontWeight: '500',
  },
  keyboardView: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 48,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    padding: 14,
    borderRadius: BORDER_RADIUS_SM,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#D0021B',
    fontWeight: '500',
  },
  stepContent: {
    gap: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: KELEMBA_GREEN,
    marginTop: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS_SM,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputPremium: {
    minHeight: 52,
    borderRadius: BORDER_RADIUS,
  },
  inputError: {
    borderColor: '#D0021B',
  },
  amountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  amountInput: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    minHeight: 52,
  },
  amountSuffix: {
    backgroundColor: KELEMBA_GREEN_LIGHT,
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 52,
    justifyContent: 'center',
  },
  amountSuffixText: {
    fontSize: 14,
    fontWeight: '700',
    color: KELEMBA_GREEN,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateText: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  datePlaceholder: {
    color: '#9CA3AF',
    fontWeight: '400',
  },
  suffix: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  fieldError: {
    fontSize: 12,
    color: '#D0021B',
    marginTop: 4,
  },
  frequencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  freqCard: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS,
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  freqCardActive: {
    backgroundColor: KELEMBA_GREEN_LIGHT,
    borderColor: KELEMBA_GREEN,
  },
  freqCardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  freqCardTextActive: {
    color: KELEMBA_GREEN,
  },
  summaryCard: {
    backgroundColor: KELEMBA_GREEN_LIGHT,
    borderRadius: BORDER_RADIUS,
    padding: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(26, 107, 60, 0.15)',
  },
  summaryCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  summaryCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: KELEMBA_GREEN,
    marginBottom: 4,
  },
  summaryCardAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: KELEMBA_GREEN,
    marginBottom: 12,
  },
  summaryCardHint: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 4,
  },
  summaryCardExample: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
    marginTop: 8,
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  toggleCard: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: BORDER_RADIUS,
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  toggleCardActive: {
    backgroundColor: KELEMBA_GREEN_LIGHT,
    borderColor: KELEMBA_GREEN,
  },
  toggleCardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  toggleCardTextActive: {
    color: KELEMBA_GREEN,
  },
  penaltyValueWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  penaltyValueInput: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1C1C1E',
    minHeight: 52,
  },
  penaltyValueSuffix: {
    backgroundColor: KELEMBA_GREEN_LIGHT,
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 52,
    justifyContent: 'center',
  },
  penaltyValueSuffixText: {
    fontSize: 14,
    fontWeight: '700',
    color: KELEMBA_GREEN,
  },
  stepperRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  stepperChipPremium: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS_SM,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  stepperChipPremiumActive: {
    backgroundColor: KELEMBA_GREEN_LIGHT,
    borderColor: KELEMBA_GREEN,
  },
  stepperChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  stepperChipActive: {
    backgroundColor: '#1A6B3C',
    borderColor: '#1A6B3C',
  },
  stepperChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  stepperChipTextActive: {
    color: KELEMBA_GREEN,
  },
  rotationCards: {
    gap: 16,
  },
  rotationCardPremium: {
    padding: 20,
    borderRadius: BORDER_RADIUS,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  rotationCardPremiumActive: {
    borderColor: KELEMBA_GREEN,
    backgroundColor: KELEMBA_GREEN_LIGHT,
  },
  rotationCardIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: KELEMBA_GREEN_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  rotationCardIconActive: {
    backgroundColor: KELEMBA_GREEN,
  },
  rotationTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 6,
  },
  rotationTitleActive: {
    color: KELEMBA_GREEN,
  },
  rotationDesc: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  badgePremium: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(26, 107, 60, 0.3)',
  },
  badgePremiumText: {
    fontSize: 12,
    fontWeight: '600',
    color: KELEMBA_GREEN,
  },
  recapTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: KELEMBA_GREEN,
    marginTop: 16,
    marginBottom: 12,
  },
  summaryCardBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  summaryBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS,
    padding: 16,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  summaryRowLast: {
    borderBottomWidth: 0,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  submitButtonPremium: {
    backgroundColor: KELEMBA_GREEN,
    minHeight: 56,
    borderRadius: BORDER_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitTextPremium: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 28,
    gap: 16,
  },
  prevButton: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: BORDER_RADIUS_SM,
    backgroundColor: '#F5F5F5',
  },
  prevText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  prevTextDisabled: {
    color: '#BDBDBD',
  },
  nextButton: {
    flex: 1,
    minHeight: 52,
    backgroundColor: KELEMBA_GREEN,
    borderRadius: BORDER_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  nextText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
