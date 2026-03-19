/**
 * Formulaire wizard 3 étapes — création tontine Épargne.
 */
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
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSelector } from 'react-redux';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import type { RootState } from '@/store/store';
import { selectAccountType } from '@/store/authSlice';
import { useCreateSavingsTontine } from '@/hooks/useSavings';
import { parseApiError } from '@/api/errors/errorHandler';
import { logger } from '@/utils/logger';
import { parseFcfa, formatFcfa } from '@/utils/formatters';
import type { CreateSavingsTontinePayload } from '@/types/savings.types';

type Props = NativeStackScreenProps<RootStackParamList, 'SavingsCreateScreen'>;

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
    maxMembers: z.number().int().min(2).max(50),
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

const FREQ_LABELS: Record<string, string> = {
  WEEKLY: 'Hebdo',
  BIWEEKLY: 'Bimensuel',
  MONTHLY: 'Mensuel',
};

export const SavingsCreateScreen: React.FC<Props> = ({ navigation }) => {
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
      maxMembers: 50,
      minScoreRequired: 300,
      earlyExitPenaltyPercent: 5,
      isPrivate: false,
    },
  });

  const watchAll = watch();

  useEffect(() => {
    if (accountType !== 'ORGANISATEUR') {
      Alert.alert(
        'Accès réservé',
        'Seuls les organisateurs peuvent créer des tontines.',
        [{ text: 'Retour', onPress: () => navigation.goBack() }]
      );
    }
  }, [accountType, navigation]);

  const handleNext = useCallback(async () => {
    const fields =
      step === 1
        ? (['name', 'minimumContribution', 'frequency', 'startDate', 'unlockDate'] as const)
        : step === 2
          ? (['bonusRatePercent', 'minScoreRequired', 'earlyExitPenaltyPercent'] as const)
          : [];
    const valid = fields.length ? await trigger([...fields]) : true;
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
    if (data.maxMembers != null) payload.maxMembers = data.maxMembers;

    try {
      const result = await createMutation.mutateAsync(payload) as { uid?: string; tontine?: { uid?: string } };
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
        setSubmitError('KYC requis pour créer une tontine.');
      } else {
        setSubmitError('Vérifiez votre connexion et réessayez.');
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

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <View style={styles.header}>
          <Text style={styles.stepLabel}>Étape {step} / 3</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 && (
            <>
              <Text style={styles.label}>Nom de la tontine</Text>
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={onChange}
                    placeholder="Ex : Épargne Solidarité"
                    placeholderTextColor="#9CA3AF"
                  />
                )}
              />
              {errors.name && <Text style={styles.error}>{errors.name.message}</Text>}

              <Text style={styles.label}>Versement minimum (FCFA)</Text>
              <Controller
                control={control}
                name="minimumContribution"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={styles.input}
                    value={String(value)}
                    onChangeText={(t) => onChange(parseFcfa(t) || 0)}
                    keyboardType="numeric"
                    placeholder="500"
                  />
                )}
              />
              <Text style={styles.hint}>{formatFcfa(watchAll.minimumContribution)}</Text>
              {errors.minimumContribution && (
                <Text style={styles.error}>{errors.minimumContribution.message}</Text>
              )}

              <Text style={styles.label}>Fréquence</Text>
              <View style={styles.pillRow}>
                {(['WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const).map((f) => (
                  <Pressable
                    key={f}
                    style={[styles.pill, watchAll.frequency === f && styles.pillActive]}
                    onPress={() => setValue('frequency', f)}
                  >
                    <Text style={[styles.pillText, watchAll.frequency === f && styles.pillTextActive]}>
                      {FREQ_LABELS[f]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Date de démarrage</Text>
              <Pressable
                style={styles.dateButton}
                onPress={() => setShowStartPicker(true)}
              >
                <Text style={styles.dateText}>{formatDateToDisplay(watchAll.startDate)}</Text>
              </Pressable>
              {showStartPicker && (
                <DateTimePicker
                  value={new Date(watchAll.startDate + 'T12:00:00')}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onDateChange('startDate')}
                  minimumDate={new Date()}
                />
              )}

              <Text style={styles.label}>Date de déblocage</Text>
              <Pressable
                style={styles.dateButton}
                onPress={() => setShowUnlockPicker(true)}
              >
                <Text style={styles.dateText}>{formatDateToDisplay(watchAll.unlockDate)}</Text>
              </Pressable>
              {showUnlockPicker && (
                <DateTimePicker
                  value={new Date(watchAll.unlockDate + 'T12:00:00')}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onDateChange('unlockDate')}
                  minimumDate={new Date(watchAll.startDate)}
                />
              )}
              {errors.unlockDate && <Text style={styles.error}>{errors.unlockDate.message}</Text>}
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.label}>% bonus partagé (0–20)</Text>
              <Controller
                control={control}
                name="bonusRatePercent"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={styles.input}
                    value={String(value)}
                    onChangeText={(t) => onChange(parseInt(t, 10) || 0)}
                    keyboardType="numeric"
                  />
                )}
              />
              <Text style={styles.hint}>
                Sur chaque versement de 10 000 FCFA, {Math.round(10000 * (watchAll.bonusRatePercent ?? 0) / 100)} FCFA vont au fonds commun.
              </Text>

              <Text style={styles.label}>Objectif individuel (FCFA)</Text>
              <Controller
                control={control}
                name="targetAmountPerMember"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={styles.input}
                    value={value != null ? String(value) : ''}
                    onChangeText={(t) => onChange(t ? parseInt(t, 10) : undefined)}
                    keyboardType="numeric"
                    placeholder="Optionnel"
                    placeholderTextColor="#9CA3AF"
                  />
                )}
              />

              <Text style={styles.label}>Objectif collectif (FCFA)</Text>
              <Controller
                control={control}
                name="targetAmountGlobal"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={styles.input}
                    value={value != null ? String(value) : ''}
                    onChangeText={(t) => onChange(t ? parseInt(t, 10) : undefined)}
                    keyboardType="numeric"
                    placeholder="Optionnel"
                    placeholderTextColor="#9CA3AF"
                  />
                )}
              />

              <Text style={styles.label}>Score Kelemba minimum</Text>
              <Controller
                control={control}
                name="minScoreRequired"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={styles.input}
                    value={String(value)}
                    onChangeText={(t) => onChange(parseInt(t, 10) || 300)}
                    keyboardType="numeric"
                  />
                )}
              />

              <Text style={styles.label}>Pénalité sortie anticipée (%)</Text>
              <Controller
                control={control}
                name="earlyExitPenaltyPercent"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={styles.input}
                    value={String(value)}
                    onChangeText={(t) => onChange(parseInt(t, 10) || 5)}
                    keyboardType="numeric"
                  />
                )}
              />

              <View style={styles.switchRow}>
                <Text style={styles.label}>Masquer les soldes individuels</Text>
                <Controller
                  control={control}
                  name="isPrivate"
                  render={({ field: { onChange, value } }) => (
                    <Switch value={value} onValueChange={onChange} trackColor={{ false: '#E5E7EB', true: '#1A6B3C' }} />
                  )}
                />
              </View>
            </>
          )}

          {step === 3 && (
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>Récapitulatif</Text>
              <SummaryRow label="Nom" value={watchAll.name} />
              <SummaryRow label="Versement min" value={formatFcfa(watchAll.minimumContribution)} />
              <SummaryRow label="Fréquence" value={FREQ_LABELS[watchAll.frequency]} />
              <SummaryRow label="Démarrage" value={formatDateToDisplay(watchAll.startDate)} />
              <SummaryRow label="Déblocage" value={formatDateToDisplay(watchAll.unlockDate)} />
              <SummaryRow label="Bonus %" value={`${watchAll.bonusRatePercent} %`} />
              <SummaryRow label="Score min" value={String(watchAll.minScoreRequired)} />
              <SummaryRow label="Pénalité sortie" value={`${watchAll.earlyExitPenaltyPercent} %`} />
              <SummaryRow label="Soldes masqués" value={watchAll.isPrivate ? 'Oui' : 'Non'} />
            </View>
          )}

          {submitError && <Text style={styles.submitError}>{submitError}</Text>}

          <View style={styles.actions}>
            {step < 3 ? (
              <Pressable
                style={[styles.cta, styles.ctaOrange]}
                onPress={handleNext}
              >
                <Text style={styles.ctaText}>Suivant</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.cta, styles.ctaOrange]}
                onPress={handleSubmit(onSubmit)}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.ctaText}>Créer la tontine</Text>
                )}
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={summaryStyles.row}>
      <Text style={summaryStyles.label}>{label}</Text>
      <Text style={summaryStyles.value}>{value}</Text>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  label: { fontSize: 14, color: '#6B7280' },
  value: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },
  flex: { flex: 1 },
  header: { padding: 20 },
  stepLabel: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 16 },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1C1C1E',
  },
  hint: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  error: { fontSize: 12, color: '#D0021B', marginTop: 4 },
  pillRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F7F8FA',
  },
  pillActive: { backgroundColor: '#1A6B3C' },
  pillText: { fontSize: 14, fontWeight: '600', color: '#666' },
  pillTextActive: { color: '#FFFFFF' },
  dateButton: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  dateText: { fontSize: 16, color: '#1C1C1E' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  summary: { marginTop: 16 },
  summaryTitle: { fontSize: 18, fontWeight: '700', color: '#1C1C1E', marginBottom: 16 },
  submitError: { fontSize: 14, color: '#D0021B', marginTop: 16 },
  actions: { marginTop: 24 },
  cta: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaOrange: { backgroundColor: '#F5A623' },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
