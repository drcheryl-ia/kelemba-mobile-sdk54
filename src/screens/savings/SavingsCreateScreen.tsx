/**
 * Wizard création tontine Épargne — aligné UX sur la création rotative (accent bleu).
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  Switch,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import type { RootState } from '@/store/store';
import { selectAccountType } from '@/store/authSlice';
import { useCreateSavingsTontine } from '@/hooks/useSavings';
import { parseApiError } from '@/api/errors/errorHandler';
import { logger } from '@/utils/logger';
import { parseFcfa, formatFcfa } from '@/utils/formatters';
import type { CreateSavingsTontinePayload } from '@/types/savings.types';
import { WizardProgressBar, WizardFooter } from '@/components/tontineCreate';
import { SavingsScreenHeader } from '@/components/savings';

type Props = NativeStackScreenProps<RootStackParamList, 'SavingsCreateScreen'>;

const savingsStep1Schema = z
  .object({
    name: z.string().min(3).max(100),
    minimumContribution: z.number().int().min(500),
    frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY']),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    unlockDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((d) => new Date(d.unlockDate) > new Date(d.startDate), {
    message: 'La date de déblocage doit être après la date de démarrage',
    path: ['unlockDate'],
  });

/** Étape 2 — règles (bonus, membres, score, pénalité, confidentialité). */
const savingsStep2Schema = z.object({
  bonusRatePercent: z.number().int().min(0).max(20),
  maxMembers: z.number().int().min(0).max(50),
  minScoreRequired: z.number().int().min(0).max(1000),
  earlyExitPenaltyPercent: z.number().int().min(0).max(30),
  isPrivate: z.boolean(),
});

const createSavingsSchema = z
  .object({
    name: z.string().min(3).max(100),
    minimumContribution: z.number().int().min(500),
    frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY']),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    unlockDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    bonusRatePercent: z.number().int().min(0).max(20),
    targetAmountPerMember: z.number().int().min(500).optional(),
    targetAmountGlobal: z.number().int().min(500).optional(),
    maxMembers: z.number().int().min(0).max(50),
    minScoreRequired: z.number().int().min(0).max(1000),
    earlyExitPenaltyPercent: z.number().int().min(0).max(30),
    isPrivate: z.boolean(),
  })
  .refine((d) => new Date(d.unlockDate) > new Date(d.startDate), {
    message: 'La date de déblocage doit être après la date de démarrage',
    path: ['unlockDate'],
  });

type FormData = z.infer<typeof createSavingsSchema>;

function formatDateToDisplay(dateStr: string): string {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getTomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function getDefaultUnlockISO(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 12);
  return d.toISOString().slice(0, 10);
}

const BLUE = '#0055A5';
const BLUE_LIGHT = '#EFF6FF';
const RADIUS = 16;
const RADIUS_SM = 12;

export const SavingsCreateScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const accountType = useSelector((s: RootState) => selectAccountType(s));
  const createMutation = useCreateSavingsTontine();

  const [step, setStep] = useState(1);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showUnlockPicker, setShowUnlockPicker] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    trigger,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(createSavingsSchema),
    defaultValues: {
      name: '',
      minimumContribution: 500,
      frequency: 'MONTHLY',
      startDate: getTomorrowISO(),
      unlockDate: getDefaultUnlockISO(),
      bonusRatePercent: 0,
      targetAmountPerMember: undefined,
      targetAmountGlobal: undefined,
      maxMembers: 0,
      minScoreRequired: 300,
      earlyExitPenaltyPercent: 5,
      isPrivate: false,
    },
  });

  const formValues = watch();

  const step1Valid = useMemo(
    () => savingsStep1Schema.safeParse(formValues).success,
    [
      formValues.name,
      formValues.minimumContribution,
      formValues.frequency,
      formValues.startDate,
      formValues.unlockDate,
    ]
  );
  const step2Valid = useMemo(
    () => savingsStep2Schema.safeParse(formValues).success,
    [
      formValues.bonusRatePercent,
      formValues.maxMembers,
      formValues.minScoreRequired,
      formValues.earlyExitPenaltyPercent,
      formValues.isPrivate,
    ]
  );

  const formValid = useMemo(
    () => createSavingsSchema.safeParse(formValues).success,
    [formValues]
  );

  const nextDisabled = (step === 1 && !step1Valid) || (step === 2 && !step2Valid);

  const submitDisabled = step === 3 && (!formValid || createMutation.isPending);

  useEffect(() => {
    if (accountType !== 'ORGANISATEUR') {
      Alert.alert(
        t('savingsCreate.accessDeniedTitle'),
        t('savingsCreate.accessDeniedMessage'),
        [{ text: t('common.back'), onPress: () => navigation.goBack() }]
      );
    }
  }, [accountType, navigation, t]);

  const handleCancel = useCallback(() => {
    Alert.alert(t('savingsCreate.cancelTitle'), t('savingsCreate.cancelMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('savingsCreate.quit'),
        style: 'destructive',
        onPress: () => navigation.goBack(),
      },
    ]);
  }, [navigation, t]);

  const handleNext = useCallback(async () => {
    const fields =
      step === 1
        ? (['name', 'minimumContribution', 'frequency', 'startDate', 'unlockDate'] as const)
        : step === 2
          ? ([
              'bonusRatePercent',
              'minScoreRequired',
              'earlyExitPenaltyPercent',
              'maxMembers',
              'isPrivate',
            ] as const)
          : [];
    const valid = fields.length ? await trigger([...fields], { shouldFocus: true }) : true;
    if (valid) setStep((s) => Math.min(3, s + 1));
  }, [step, trigger]);

  const onSubmit = async (data: FormData): Promise<void> => {
    setSubmitError(null);
    const payload: CreateSavingsTontinePayload = {
      name: data.name,
      minimumContribution: data.minimumContribution,
      frequency: data.frequency,
      startDate: data.startDate,
      unlockDate: data.unlockDate,
      bonusRatePercent: data.bonusRatePercent,
      minScoreRequired: data.minScoreRequired,
      earlyExitPenaltyPercent: data.earlyExitPenaltyPercent,
      isPrivate: data.isPrivate,
    };
    if (data.targetAmountPerMember != null) payload.targetAmountPerMember = data.targetAmountPerMember;
    if (data.targetAmountGlobal != null) payload.targetAmountGlobal = data.targetAmountGlobal;
    payload.maxMembers = data.maxMembers;

    try {
      const result = (await createMutation.mutateAsync(payload)) as {
        uid?: string;
        tontine?: { uid?: string };
      };
      const uid = result?.uid ?? result?.tontine?.uid;
      if (uid) {
        navigation.replace('SavingsDetailScreen', { tontineUid: uid });
      }
    } catch (err: unknown) {
      const apiErr = parseApiError(err);
      logger.error('SavingsCreate submit failed', { code: apiErr.code });
      if (apiErr.httpStatus === 400 && apiErr.message) {
        setSubmitError(apiErr.message);
      } else if (apiErr.httpStatus === 403) {
        setSubmitError(t('savingsCreate.errorKyc'));
      } else {
        setSubmitError(t('savingsCreate.errorNetwork'));
      }
    }
  };

  const onDateChange = (field: 'startDate' | 'unlockDate') => (_: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartPicker(false);
      setShowUnlockPicker(false);
    }
    if (selectedDate) {
      setValue(field, selectedDate.toISOString().slice(0, 10));
    }
  };

  const stepMeta =
    (
      [
        { title: 'savingsCreate.wizardStep1Title', sub: 'savingsCreate.wizardStep1Subtitle' },
        { title: 'savingsCreate.wizardStep2Title', sub: 'savingsCreate.wizardStep2Subtitle' },
        { title: 'savingsCreate.wizardStep3Title', sub: 'savingsCreate.wizardStep3Subtitle' },
      ] as const
    )[step - 1];

  const freq = watch('frequency');

  if (accountType !== 'ORGANISATEUR') {
    return null;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <SavingsScreenHeader
        title={t('savingsCreate.screenTitle')}
        onBack={handleCancel}
        backAccessibilityLabel={t('common.back')}
        backIcon={<Ionicons name="arrow-back" size={24} color={BLUE} />}
        backPressableStyle={styles.headerBack}
        titleStyle={styles.headerTitle}
        titleNumberOfLines={1}
        headerContainerStyle={styles.savingsHeaderSep}
        rightAction={<View style={styles.headerSpacer} />}
      />
      <WizardProgressBar
        currentStep={step}
        totalSteps={3}
        accentColor={BLUE}
        label={t('savingsCreate.wizardProgressLabel', { current: step, total: 3 })}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {stepMeta ? (
            <View style={styles.wizardHero}>
              <Text style={styles.wizardHeroTitle}>{t(stepMeta.title)}</Text>
              <Text style={styles.wizardHeroSubtitle}>{t(stepMeta.sub)}</Text>
            </View>
          ) : null}

          {step === 1 && (
            <View style={styles.stepBlock}>
              <Text style={styles.fieldLabel}>{t('createTontine.nameLabel')}</Text>
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[styles.input, errors.name && styles.inputErr]}
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder={t('createTontine.namePlaceholder')}
                    placeholderTextColor="#9CA3AF"
                  />
                )}
              />
              {errors.name && <Text style={styles.err}>{errors.name.message}</Text>}

              <Text style={styles.fieldLabel}>{t('savingsCreate.minimumLabel')}</Text>
              <Controller
                control={control}
                name="minimumContribution"
                render={({ field: { onChange, value } }) => (
                  <View style={[styles.amountWrap, errors.minimumContribution && styles.inputErr]}>
                    <TextInput
                      style={styles.amountInput}
                      value={String(value)}
                      onChangeText={(txt) => onChange(parseFcfa(txt) || 0)}
                      keyboardType="numeric"
                      placeholder="500"
                    />
                    <View style={styles.amountSuffix}>
                      <Text style={styles.amountSuffixText}>FCFA</Text>
                    </View>
                  </View>
                )}
              />
              <Text style={styles.hint}>{formatFcfa(formValues.minimumContribution)}</Text>
              {errors.minimumContribution && (
                <Text style={styles.err}>{errors.minimumContribution.message}</Text>
              )}

              <Text style={styles.fieldLabel}>{t('createTontine.frequencyLabel')}</Text>
              <View style={styles.pillRow}>
                {(['WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const).map((f) => (
                  <Pressable
                    key={f}
                    style={[styles.pill, freq === f && styles.pillOn]}
                    onPress={() => setValue('frequency', f)}
                  >
                    <Text style={[styles.pillTxt, freq === f && styles.pillTxtOn]}>
                      {t(`createTontine.freq${f}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>{t('createTontine.startDateLabel')}</Text>
              <Pressable style={styles.dateBtn} onPress={() => setShowStartPicker(true)}>
                <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                <Text style={styles.dateTxt}>{formatDateToDisplay(formValues.startDate)}</Text>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </Pressable>
              {showStartPicker && (
                <DateTimePicker
                  value={new Date(formValues.startDate + 'T12:00:00')}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onDateChange('startDate')}
                  minimumDate={new Date()}
                />
              )}

              <Text style={styles.fieldLabel}>{t('savingsCreate.unlockDateLabel')}</Text>
              <Text style={styles.fieldHint}>{t('savingsCreate.unlockDateHint')}</Text>
              <Pressable style={styles.dateBtn} onPress={() => setShowUnlockPicker(true)}>
                <Ionicons name="lock-open-outline" size={20} color="#6B7280" />
                <Text style={styles.dateTxt}>{formatDateToDisplay(formValues.unlockDate)}</Text>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </Pressable>
              {showUnlockPicker && (
                <DateTimePicker
                  value={new Date(formValues.unlockDate + 'T12:00:00')}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onDateChange('unlockDate')}
                  minimumDate={new Date(formValues.startDate)}
                />
              )}
              {errors.unlockDate && <Text style={styles.err}>{errors.unlockDate.message}</Text>}

              <View style={styles.liveCard}>
                <Text style={styles.liveKicker}>{t('savingsCreate.livePreviewTitle')}</Text>
                <Text style={styles.liveAmount}>{formatFcfa(formValues.minimumContribution)}</Text>
                <Text style={styles.liveSub}>{t('savingsCreate.minimumLabel')}</Text>
                <View style={styles.chipRow}>
                  <View style={styles.chip}>
                    <Ionicons name="pulse-outline" size={14} color={BLUE} />
                    <Text style={styles.chipTxt}>{t('savingsCreate.livePreviewChipFlexible')}</Text>
                  </View>
                  <View style={styles.chip}>
                    <Ionicons name="time-outline" size={14} color={BLUE} />
                    <Text style={styles.chipTxt}>{t('savingsCreate.livePreviewChipUnlock')}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepBlock}>
              <Text style={styles.fieldLabel}>{t('savingsCreate.bonusLabel')}</Text>
              <Text style={styles.fieldHint}>{t('savingsCreate.bonusHint')}</Text>
              <Controller
                control={control}
                name="bonusRatePercent"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={styles.input}
                    value={String(value)}
                    onChangeText={(txt) => onChange(parseInt(txt, 10) || 0)}
                    keyboardType="numeric"
                  />
                )}
              />

              <Text style={styles.fieldLabel}>{t('savingsCreate.maxMembersLabel')}</Text>
              <Text style={styles.fieldHint}>{t('savingsCreate.maxMembersZeroHint')}</Text>
              <Controller
                control={control}
                name="maxMembers"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={styles.input}
                    value={String(value)}
                    onChangeText={(txt) => {
                      const n = parseInt(txt.replace(/\D/g, ''), 10);
                      onChange(Number.isNaN(n) ? 0 : Math.min(50, Math.max(0, n)));
                    }}
                    keyboardType="numeric"
                  />
                )}
              />

              <Text style={styles.fieldLabel}>{t('tontineDetails.scoreLabel')}</Text>
              <Controller
                control={control}
                name="minScoreRequired"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={styles.input}
                    value={String(value)}
                    onChangeText={(txt) => onChange(parseInt(txt, 10) || 300)}
                    keyboardType="numeric"
                  />
                )}
              />

              <Text style={styles.fieldLabel}>{t('savingsCreate.earlyExitLabel')}</Text>
              <Controller
                control={control}
                name="earlyExitPenaltyPercent"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={styles.input}
                    value={String(value)}
                    onChangeText={(txt) => onChange(parseInt(txt, 10) || 5)}
                    keyboardType="numeric"
                  />
                )}
              />

              <Text style={styles.fieldLabel}>{t('savingsCreate.privacyLabel')}</Text>
              <Text style={styles.fieldHint}>{t('savingsCreate.privacyHint')}</Text>
              <View style={styles.switchRow}>
                <Controller
                  control={control}
                  name="isPrivate"
                  render={({ field: { onChange, value } }) => (
                    <Switch
                      value={value}
                      onValueChange={onChange}
                      trackColor={{ false: '#E5E7EB', true: BLUE }}
                    />
                  )}
                />
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepBlock}>
              <Text style={styles.fieldLabel}>{t('savingsCreate.wizardStep3ObjectivesTitle')}</Text>
              <Text style={styles.fieldHint}>{t('savingsCreate.wizardStep3ObjectivesSubtitle')}</Text>

              <Text style={styles.fieldLabel}>{t('savingsCreate.targetMemberLabel')}</Text>
              <Controller
                control={control}
                name="targetAmountPerMember"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={styles.input}
                    value={value != null ? String(value) : ''}
                    onChangeText={(txt) => onChange(txt ? parseInt(txt, 10) : undefined)}
                    keyboardType="numeric"
                    placeholder={t('savingsCreate.optional')}
                    placeholderTextColor="#9CA3AF"
                  />
                )}
              />

              <Text style={styles.fieldLabel}>{t('savingsCreate.targetGlobalLabel')}</Text>
              <Controller
                control={control}
                name="targetAmountGlobal"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={styles.input}
                    value={value != null ? String(value) : ''}
                    onChangeText={(txt) => onChange(txt ? parseInt(txt, 10) : undefined)}
                    keyboardType="numeric"
                    placeholder={t('savingsCreate.optional')}
                    placeholderTextColor="#9CA3AF"
                  />
                )}
              />

              <View style={styles.recapHero}>
                <Text style={styles.recapHeroAmount}>{formatFcfa(formValues.minimumContribution)}</Text>
                <Text style={styles.recapHeroSub}>
                  {t(`createTontine.freq${formValues.frequency}`)} · {t('savingsCreate.unlockDateLabel')}{' '}
                  {formatDateToDisplay(formValues.unlockDate)}
                </Text>
              </View>
              <Text style={styles.recapSection}>{t('savingsCreate.summaryHeroTitle')}</Text>
              <View style={styles.recapCard}>
                <SummaryRow label={t('createTontine.nameLabel')} value={formValues.name} />
                <SummaryRow label={t('savingsCreate.minimumLabel')} value={formatFcfa(formValues.minimumContribution)} />
                <SummaryRow label={t('createTontine.frequencyLabel')} value={t(`createTontine.freq${formValues.frequency}`)} />
                <SummaryRow label={t('createTontine.startDateLabel')} value={formatDateToDisplay(formValues.startDate)} />
                <SummaryRow label={t('savingsCreate.unlockDateLabel')} value={formatDateToDisplay(formValues.unlockDate)} isLast />
              </View>
              <Text style={styles.recapSection}>{t('savingsCreate.wizardStep2Title')}</Text>
              <View style={styles.recapCard}>
                <SummaryRow label={t('savingsCreate.bonusLabel')} value={`${formValues.bonusRatePercent} %`} />
                <SummaryRow label={t('tontineDetails.scoreLabel')} value={String(formValues.minScoreRequired)} />
                <SummaryRow
                  label={t('savingsCreate.earlyExitLabel')}
                  value={`${formValues.earlyExitPenaltyPercent} %`}
                />
                <SummaryRow
                  label={t('savingsCreate.maxMembersLabel')}
                  value={
                    formValues.maxMembers === 0
                      ? t('savingsCreate.maxMembersUnlimited')
                      : String(formValues.maxMembers)
                  }
                />
                <SummaryRow
                  label={t('savingsCreate.privacyLabel')}
                  value={formValues.isPrivate ? t('savingsCreate.yes') : t('savingsCreate.no')}
                  isLast
                />
              </View>
              <Text style={styles.recapSection}>{t('savingsCreate.wizardStep3ObjectivesRecap')}</Text>
              <View style={styles.recapCard}>
                <SummaryRow
                  label={t('savingsCreate.targetMemberLabel')}
                  value={
                    formValues.targetAmountPerMember != null
                      ? formatFcfa(formValues.targetAmountPerMember)
                      : t('savingsCreate.optionalNone')
                  }
                />
                <SummaryRow
                  label={t('savingsCreate.targetGlobalLabel')}
                  value={
                    formValues.targetAmountGlobal != null
                      ? formatFcfa(formValues.targetAmountGlobal)
                      : t('savingsCreate.optionalNone')
                  }
                  isLast
                />
              </View>
              <Text style={styles.recapFoot}>{t('savingsCreate.recapFinalHint')}</Text>
            </View>
          )}

          {submitError ? <Text style={styles.submitErr}>{submitError}</Text> : null}
        </ScrollView>

        <WizardFooter
          showBack={step > 1}
          onBack={() => setStep((s) => Math.max(1, s - 1))}
          onPrimary={() => {
            if (step < 3) {
              void handleNext();
            } else {
              void handleSubmit(onSubmit)();
            }
          }}
          primaryDisabled={step < 3 ? nextDisabled : submitDisabled}
          primaryLabel={step < 3 ? t('common.next') : t('savingsCreate.createButton')}
          backLabel={t('common.back')}
          primaryColor={BLUE}
          primaryLoading={step === 3 && createMutation.isPending}
        />
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
    <View style={[summaryStyles.row, isLast && summaryStyles.rowLast]}>
      <Text style={summaryStyles.lbl}>{label}</Text>
      <Text style={summaryStyles.val}>{value}</Text>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  rowLast: { borderBottomWidth: 0 },
  lbl: { fontSize: 14, color: '#6B7280', flex: 1 },
  val: { fontSize: 15, fontWeight: '600', color: '#111827', flex: 1, textAlign: 'right' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAFA' },
  flex: { flex: 1 },
  savingsHeaderSep: {
    paddingBottom: 8,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerBack: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BLUE_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 0,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: BLUE,
    textAlign: 'center',
  },
  headerSpacer: { width: 44, height: 44 },
  wizardHero: { marginBottom: 12 },
  wizardHeroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.3,
  },
  wizardHeroSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 6, lineHeight: 20 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 24 },
  stepBlock: { gap: 4 },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: BLUE,
    marginTop: 14,
    marginBottom: 6,
  },
  fieldHint: { fontSize: 12, color: '#6B7280', marginBottom: 8, lineHeight: 17 },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS_SM,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    minHeight: 52,
  },
  inputErr: { borderColor: '#D0021B' },
  err: { fontSize: 12, color: '#D0021B', marginTop: 4 },
  hint: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  amountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  amountInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '600',
    minHeight: 52,
    color: '#111827',
  },
  amountSuffix: { backgroundColor: BLUE_LIGHT, paddingHorizontal: 14, minHeight: 52, justifyContent: 'center' },
  amountSuffixText: { fontSize: 13, fontWeight: '700', color: BLUE },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: RADIUS,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pillOn: { backgroundColor: BLUE_LIGHT, borderColor: BLUE },
  pillTxt: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  pillTxtOn: { color: BLUE },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS_SM,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    minHeight: 52,
  },
  dateTxt: { flex: 1, fontSize: 16, color: '#111827', fontWeight: '500' },
  liveCard: {
    marginTop: 16,
    backgroundColor: BLUE_LIGHT,
    borderRadius: RADIUS,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 85, 165, 0.15)',
  },
  liveKicker: {
    fontSize: 11,
    fontWeight: '700',
    color: BLUE,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  liveAmount: { fontSize: 26, fontWeight: '800', color: BLUE },
  liveSub: { fontSize: 12, color: '#6B7280', marginTop: 4, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 85, 165, 0.2)',
  },
  chipTxt: { fontSize: 12, fontWeight: '600', color: '#374151' },
  switchRow: { alignItems: 'flex-end', marginTop: 4 },
  recapHero: {
    backgroundColor: BLUE_LIGHT,
    borderRadius: RADIUS,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 85, 165, 0.15)',
    alignItems: 'center',
  },
  recapHeroAmount: { fontSize: 28, fontWeight: '800', color: BLUE },
  recapHeroSub: { fontSize: 14, color: '#4B5563', marginTop: 8, textAlign: 'center' },
  recapSection: {
    fontSize: 15,
    fontWeight: '700',
    color: BLUE,
    marginBottom: 10,
    marginTop: 8,
  },
  recapCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  recapFoot: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 16, lineHeight: 20 },
  submitErr: { color: '#D0021B', marginTop: 12, fontSize: 14 },
});
