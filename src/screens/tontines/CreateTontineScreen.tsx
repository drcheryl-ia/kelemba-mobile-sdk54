/**
 * Création unifiée — tontine rotative (POST /tontines) et épargne (POST /savings).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';

import type { RootStackParamList } from '@/navigation/types';
import type { RootState } from '@/store/store';
import { selectAccountType } from '@/store/authSlice';
import { createTontine } from '@/api/tontinesApi';
import { parseApiError } from '@/api/errors/errorHandler';
import { logger } from '@/utils/logger';
import { formatFcfa, formatFcfaAmount, formatDateLong, parseFcfa } from '@/utils/formatters';
import type { CreateTontineDto, RotationMode, TontineFrequency } from '@/api/types/api.types';
import type { CreateSavingsTontinePayload } from '@/types/savings.types';
import type { SavingsFrequency } from '@/types/savings.types';
import { useCreateSavingsTontine } from '@/hooks/useSavings';
import { COLORS } from '@/theme/colors';
import {
  CreateStepHeader,
  FormSectionCard,
  FormFieldInput,
  FormFreqGrid,
  FormSliderField,
  FormToggleRow,
  FormModeGrid,
  FormInfoBanner,
  FormWarnBanner,
  FormNavButtons,
  CreateSummaryCard,
} from '@/components/create-tontine';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateTontine'>;

const rotativeSteps = [
  { label: 'Paramètres' },
  { label: 'Règles' },
  { label: 'Rotation' },
  { label: 'Résumé' },
] as const;

const epargneSteps = [
  { label: 'Paramètres' },
  { label: 'Objectifs' },
  { label: 'Conditions' },
  { label: 'Résumé' },
] as const;

const TOMORROW = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
})();

function getTomorrowISO(): string {
  const y = TOMORROW.getFullYear();
  const m = String(TOMORROW.getMonth() + 1).padStart(2, '0');
  const day = String(TOMORROW.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getDefaultUnlockISO(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 12);
  return d.toISOString().slice(0, 10);
}

function freqLabel(f: TontineFrequency | SavingsFrequency): string {
  switch (f) {
    case 'DAILY':
      return 'quotidienne';
    case 'WEEKLY':
      return 'hebdo';
    case 'BIWEEKLY':
      return 'bimensuelle';
    case 'MONTHLY':
      return 'mensuelle';
    default:
      return String(f);
  }
}

function rotationModeLabel(m: RotationMode): string {
  switch (m) {
    case 'ARRIVAL':
      return "Ordre d'arrivée";
    case 'RANDOM':
      return 'Tirage au sort';
    case 'MANUAL':
      return 'Manuel';
    default:
      return String(m);
  }
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${iso}T00:00:00`));
}

function calculateWeeks(startIso: string, endIso: string): number {
  const a = new Date(`${startIso}T00:00:00`).getTime();
  const b = new Date(`${endIso}T00:00:00`).getTime();
  return Math.ceil((b - a) / (7 * 86_400_000));
}

function estimatePeriods(weeks: number, f: SavingsFrequency): number {
  if (f === 'WEEKLY') return Math.max(1, weeks);
  if (f === 'BIWEEKLY') return Math.max(1, Math.floor(weeks / 2));
  return Math.max(1, Math.ceil(weeks / 4));
}

const optionalIntMin500 = z.preprocess(
  (v) => {
    if (v === '' || v == null || v === undefined) return undefined;
    const n = typeof v === 'number' ? v : parseInt(String(v).replace(/\D/g, ''), 10);
    return Number.isNaN(n) ? undefined : n;
  },
  z.number().int().min(500).optional()
);

const preprocessNonEmptyNumber = (v: unknown): number | undefined => {
  if (v === '' || v == null || v === undefined) return undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(String(v).replace(/\D/g, ''));
  return Number.isNaN(n) ? undefined : n;
};

const rotativeSchema = z
  .object({
    name: z.preprocess(
      (v) => {
        if (typeof v === 'number') return '';
        if (v == null) return '';
        return String(v);
      },
      z.string().min(3).max(100)
    ),
    amountPerShare: z.preprocess(
      preprocessNonEmptyNumber,
      z.number().int().min(500).max(10_000_000)
    ),
    frequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY']),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((d) => new Date(`${d}T23:59:59`) > new Date(), {
        message: 'Date future requise',
      }),
    penaltyRate: z.preprocess(
      preprocessNonEmptyNumber,
      z.number().min(0).max(50)
    ),
    gracePeriodDays: z.number().int().min(0).max(7),
    maxSharesPerMember: z
      .enum(['1', '2', '3', '4', '5'])
      .transform((s) => parseInt(s, 10)),
    minScoreRequired: z.number().int().min(0).max(1000).optional(),
    requireMinScore: z.boolean(),
    rotationMode: z.enum(['ARRIVAL', 'RANDOM', 'MANUAL']),
    isPublicLink: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.requireMinScore && data.minScoreRequired == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minScoreRequired'],
        message: 'Indiquez un score minimum',
      });
    }
  });

function validUnlockDate(data: { startDate: string; unlockDate: string }): boolean {
  return new Date(`${data.unlockDate}T00:00:00`) > new Date(`${data.startDate}T00:00:00`);
}

const epargneSchema = z
  .object({
    name: z.string().min(3).max(100),
    minimumContribution: z.coerce.number().int().min(500),
    frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY']),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((d) => new Date(`${d}T23:59:59`) > new Date(), {
        message: 'Date future requise',
      }),
    unlockDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    targetAmountPerMember: optionalIntMin500,
    targetAmountGlobal: optionalIntMin500,
    bonusRatePercent: z.number().int().min(0).max(20),
    minScoreRequired: z.number().int().min(0).max(1000),
    maxMembers: z.number().int().min(2).max(50),
    earlyExitPenaltyPercent: z.number().int().min(0).max(30),
    isPrivate: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (!validUnlockDate(data)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['unlockDate'],
        message: 'Doit être après la date de démarrage',
      });
    }
  });

/** Types formulaire alignés sur l’UI (chaînes pour champs formatés / grille). */
type RotativeFormInput = {
  name: string;
  amountPerShare: number | string;
  frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  startDate: string;
  penaltyRate: number | string;
  gracePeriodDays: number;
  maxSharesPerMember: string;
  minScoreRequired?: number;
  requireMinScore: boolean;
  rotationMode: RotationMode;
  isPublicLink: boolean;
};

type EpargneFormInput = {
  name: string;
  minimumContribution: number | string;
  frequency: SavingsFrequency;
  startDate: string;
  unlockDate: string;
  targetAmountPerMember?: number | string;
  targetAmountGlobal?: number | string;
  bonusRatePercent: number;
  minScoreRequired: number;
  maxMembers: number;
  earlyExitPenaltyPercent: number;
  isPrivate: boolean;
};

type RotativeFieldKey = keyof RotativeFormInput;
type EpargneFieldKey = keyof EpargneFormInput;

function getFieldsForStep(
  type: 'ROTATIVE' | 'EPARGNE',
  step: number,
  requireMinScore: boolean
): RotativeFieldKey[] | EpargneFieldKey[] {
  if (type === 'ROTATIVE') {
    const rotativeFields: RotativeFieldKey[][] = [
      ['name', 'amountPerShare', 'frequency', 'startDate'],
      requireMinScore
        ? ['penaltyRate', 'gracePeriodDays', 'maxSharesPerMember', 'minScoreRequired']
        : ['penaltyRate', 'gracePeriodDays', 'maxSharesPerMember'],
      ['rotationMode', 'isPublicLink'],
      [],
    ];
    return rotativeFields[step] ?? [];
  }
  const epargneFields: EpargneFieldKey[][] = [
    ['name', 'minimumContribution', 'frequency', 'startDate', 'unlockDate'],
    ['bonusRatePercent'],
    ['minScoreRequired', 'maxMembers', 'earlyExitPenaltyPercent', 'isPrivate'],
    [],
  ];
  return epargneFields[step] ?? [];
}

function formatDigitsFcfa(val: string): string {
  return formatFcfaAmount(parseFcfa(val));
}

function BackChevronWhite(): React.ReactElement {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke={COLORS.white}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconArrival(): React.ReactElement {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
        stroke={COLORS.primary}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function IconShuffle(): React.ReactElement {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"
        stroke={COLORS.primary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconManual(): React.ReactElement {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 9l6 6 6-6"
        stroke={COLORS.primary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export const CreateTontineScreen: React.FC<Props> = ({ navigation, route }) => {
  const queryClient = useQueryClient();
  const accountType = useSelector(selectAccountType);
  const insets = useSafeAreaInsets();

  const initialType = route.params?.initialType ?? 'ROTATIVE';
  const [tontineType, setTontineType] = useState<'ROTATIVE' | 'EPARGNE'>(initialType);
  const [currentStep, setCurrentStep] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const [datePicker, setDatePicker] = useState<'rot_start' | 'ep_start' | 'ep_unlock' | null>(null);

  const rotativeForm = useForm<RotativeFormInput>({
    resolver: zodResolver(rotativeSchema) as unknown as Resolver<RotativeFormInput>,
    defaultValues: {
      name: '',
      amountPerShare: 500,
      frequency: 'MONTHLY',
      startDate: getTomorrowISO(),
      penaltyRate: 5,
      gracePeriodDays: 3,
      maxSharesPerMember: '1',
      minScoreRequired: 300,
      requireMinScore: false,
      rotationMode: 'ARRIVAL',
      isPublicLink: false,
    },
  });

  const epargneForm = useForm<EpargneFormInput>({
    resolver: zodResolver(epargneSchema) as unknown as Resolver<EpargneFormInput>,
    defaultValues: {
      name: '',
      minimumContribution: 500,
      frequency: 'MONTHLY',
      startDate: getTomorrowISO(),
      unlockDate: getDefaultUnlockISO(),
      targetAmountPerMember: undefined,
      targetAmountGlobal: undefined,
      bonusRatePercent: 0,
      minScoreRequired: 300,
      maxMembers: 20,
      earlyExitPenaltyPercent: 5,
      isPrivate: false,
    },
  });

  const requireMinScore = rotativeForm.watch('requireMinScore');
  const epStart = epargneForm.watch('startDate');
  const epUnlock = epargneForm.watch('unlockDate');
  const epFreq = epargneForm.watch('frequency');

  const currentSteps = tontineType === 'ROTATIVE' ? rotativeSteps : epargneSteps;

  const createRotativeMutation = useMutation({
    mutationFn: createTontine,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tontines'] });
    },
  });

  const createSavingsMutation = useCreateSavingsTontine();

  const isSubmitting = createRotativeMutation.isPending || createSavingsMutation.isPending;

  const handleTypeChange = useCallback((newType: 'ROTATIVE' | 'EPARGNE') => {
    setTontineType(newType);
    setCurrentStep(0);
    rotativeForm.reset();
    epargneForm.reset();
  }, [rotativeForm, epargneForm]);

  useEffect(() => {
    if (accountType !== 'ORGANISATEUR') {
      Alert.alert(
        'Accès réservé',
        'Seuls les organisateurs peuvent créer des tontines.',
        [{ text: 'Retour', onPress: () => navigation.goBack() }]
      );
    }
  }, [accountType, navigation]);

  const handlePrev = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const firstZodIssueMessage = useCallback((error: z.ZodError): string => {
    const issue = error.issues[0];
    return issue?.message ?? 'Les données du formulaire sont invalides.';
  }, []);

  const handleCreateSubmit = useCallback(async () => {
    try {
      if (tontineType === 'ROTATIVE') {
        const parsed = rotativeSchema.safeParse(rotativeForm.getValues());
        if (!parsed.success) {
          Alert.alert('Vérification', firstZodIssueMessage(parsed.error));
          return;
        }
        const values = parsed.data;
        const payload: CreateTontineDto = {
          name: values.name.trim(),
          amountPerShare: Number(values.amountPerShare),
          frequency: values.frequency,
          startDate: values.startDate,
          rotationMode: values.rotationMode ?? 'ARRIVAL',
          rules: {
            penaltyRate: Number(values.penaltyRate ?? 0),
            gracePeriodDays: Number(values.gracePeriodDays ?? 0),
            maxSharesPerMember: Number(values.maxSharesPerMember ?? 1),
            minScoreRequired: values.requireMinScore
              ? Number(values.minScoreRequired)
              : undefined,
            isPublicLink: values.isPublicLink,
          },
        };
        logger.info('CreateTontine: submitting ROTATIVE', { name: payload.name });
        const data = await createRotativeMutation.mutateAsync(payload);
        await queryClient.invalidateQueries({ queryKey: ['tontines'] });
        navigation.replace('TontineDetails', {
          tontineUid: data.uid,
          isCreator: true,
          tab: 'dashboard',
        });
        return;
      }

      const parsedEp = epargneSchema.safeParse(epargneForm.getValues());
      if (!parsedEp.success) {
        Alert.alert('Vérification', firstZodIssueMessage(parsedEp.error));
        return;
      }
      const ev = parsedEp.data;
      const payload: CreateSavingsTontinePayload = {
        name: ev.name.trim(),
        minimumContribution: Number(ev.minimumContribution),
        frequency: ev.frequency,
        startDate: ev.startDate,
        unlockDate: ev.unlockDate,
        bonusRatePercent: Number(ev.bonusRatePercent ?? 0),
        minScoreRequired: Number(ev.minScoreRequired ?? 300),
        maxMembers: Number(ev.maxMembers ?? 50),
        earlyExitPenaltyPercent: Number(ev.earlyExitPenaltyPercent ?? 5),
        isPrivate: Boolean(ev.isPrivate ?? false),
      };
      if (ev.targetAmountPerMember != null) {
        payload.targetAmountPerMember = Number(ev.targetAmountPerMember);
      }
      if (ev.targetAmountGlobal != null) {
        payload.targetAmountGlobal = Number(ev.targetAmountGlobal);
      }
      logger.info('CreateTontine: submitting EPARGNE', { name: payload.name });
      const data = await createSavingsMutation.mutateAsync(payload);
      await queryClient.invalidateQueries({ queryKey: ['savings', 'list'] });
      await queryClient.invalidateQueries({ queryKey: ['tontines'] });
      const uid = data.uid;
      if (uid) {
        navigation.replace('SavingsDetailScreen', { tontineUid: uid, isCreator: true });
      } else {
        Alert.alert(
          'Création impossible',
          'La réponse du serveur ne contient pas d’identifiant de tontine.'
        );
      }
    } catch (err: unknown) {
      logger.error('CreateTontine submit error', err);
      const apiErr = parseApiError(err);
      if (
        tontineType === 'ROTATIVE' &&
        apiErr.httpStatus === 400 &&
        apiErr.details
      ) {
        const details = apiErr.details as Record<string, string[]>;
        for (const [field, messages] of Object.entries(details)) {
          const msg = Array.isArray(messages) ? messages[0] : String(messages);
          rotativeForm.setError(field as keyof RotativeFormInput, { message: msg });
        }
        return;
      }
      const message =
        apiErr.message ??
        (err instanceof Error ? err.message : 'Erreur inconnue');
      Alert.alert(
        'Création impossible',
        `La tontine n'a pas pu être créée.\n\n${message}`,
        [{ text: 'OK' }]
      );
    }
  }, [
    createRotativeMutation,
    createSavingsMutation,
    epargneForm,
    firstZodIssueMessage,
    navigation,
    queryClient,
    rotativeForm,
    tontineType,
  ]);

  const handleNextOrSubmit = useCallback(async () => {
    const form = tontineType === 'ROTATIVE' ? rotativeForm : epargneForm;
    const steps = tontineType === 'ROTATIVE' ? rotativeSteps : epargneSteps;
    const isLast = currentStep === steps.length - 1;
    const fieldsForStep = getFieldsForStep(tontineType, currentStep, requireMinScore);

    if (!isLast) {
      let valid = true;
      if (fieldsForStep.length > 0) {
        valid = await form.trigger(fieldsForStep as never);
      }
      if (!valid) {
        logger.warn('CreateTontine: validation failed at step', { step: currentStep });
        return;
      }
      setCurrentStep((s) => s + 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    await handleCreateSubmit();
  }, [
    currentStep,
    epargneForm,
    handleCreateSubmit,
    requireMinScore,
    rotativeForm,
    tontineType,
  ]);

  const renderRotativeStep = useCallback(
    (step: number): React.ReactElement => {
      const control = rotativeForm.control;
      switch (step) {
        case 0:
          return (
            <>
              <FormSectionCard title="Informations générales">
                <FormFieldInput
                  name="name"
                  control={control}
                  label="Nom de la tontine"
                  placeholder="Ex. Tontine Solidarité KM5"
                  maxLength={100}
                />
                <FormFieldInput
                  name="amountPerShare"
                  control={control}
                  label="Montant par part"
                  keyboardType="number-pad"
                  suffix="FCFA"
                  formatValue={formatDigitsFcfa}
                />
                <View style={styles.freqBlock}>
                  <Text style={styles.freqLabel}>Fréquence des cotisations</Text>
                  <FormFreqGrid
                    name="frequency"
                    control={control}
                    columns={2}
                    options={[
                      { value: 'MONTHLY', label: 'Mensuelle' },
                      { value: 'WEEKLY', label: 'Hebdomadaire' },
                      { value: 'BIWEEKLY', label: 'Bimensuelle' },
                      { value: 'DAILY', label: 'Quotidienne' },
                    ]}
                  />
                </View>
              </FormSectionCard>
              <FormSectionCard title="Calendrier">
                <Controller
                  control={control}
                  name="startDate"
                  render={({ field: { value }, fieldState: { error } }) => (
                    <Pressable
                      onPress={() => setDatePicker('rot_start')}
                      style={styles.datePress}
                      accessibilityRole="button"
                      accessibilityLabel="Date de démarrage"
                    >
                      <Text style={styles.freqLabel}>Date de démarrage</Text>
                      <View style={styles.dateFieldWrap}>
                        <Text style={styles.dateFieldText}>
                          {value ? formatDateLong(value) : 'Choisir une date'}
                        </Text>
                      </View>
                      {error?.message != null && error.message !== '' ? (
                        <Text style={styles.dateErr}>{error.message}</Text>
                      ) : null}
                    </Pressable>
                  )}
                />
                <FormInfoBanner message="Le nombre de cycles est calculé automatiquement à l'activation selon les membres actifs." />
              </FormSectionCard>
            </>
          );
        case 1:
          return (
            <>
              <FormSectionCard title="Pénalités de retard">
                <FormFieldInput
                  name="penaltyRate"
                  control={control}
                  label="Taux de pénalité par jour"
                  keyboardType="number-pad"
                  suffix="% du montant dû"
                />
                <FormSliderField
                  name="gracePeriodDays"
                  control={control}
                  label="Délai de grâce"
                  min={0}
                  max={7}
                  step={1}
                  suffix=" jours"
                />
              </FormSectionCard>
              <FormSectionCard title="Parts et membres">
                <View style={styles.freqBlock}>
                  <Text style={styles.freqLabel}>Parts maximum par membre</Text>
                  <FormFreqGrid
                    name="maxSharesPerMember"
                    control={control}
                    columns={3}
                    options={[
                      { value: '1', label: '1 part' },
                      { value: '2', label: '2 parts' },
                      { value: '3', label: '3 parts' },
                      { value: '4', label: '4 parts' },
                      { value: '5', label: '5 parts' },
                    ]}
                  />
                </View>
                <FormToggleRow
                  name="requireMinScore"
                  control={control}
                  label="Score minimum requis"
                  sublabel="Filtrer les membres par Score Kelemba"
                />
                {requireMinScore ? (
                  <FormSliderField
                    name="minScoreRequired"
                    control={control}
                    label="Score minimum"
                    min={0}
                    max={1000}
                    step={50}
                    suffix=" pts"
                  />
                ) : null}
              </FormSectionCard>
            </>
          );
        case 2:
          return (
            <>
              <FormSectionCard title="Mode de rotation">
                <FormModeGrid
                  name="rotationMode"
                  control={control}
                  options={[
                    { value: 'ARRIVAL', label: "Ordre d'arrivée", icon: <IconArrival /> },
                    { value: 'RANDOM', label: 'Tirage au sort', icon: <IconShuffle /> },
                    { value: 'MANUAL', label: 'Manuel', icon: <IconManual /> },
                  ]}
                />
                <FormInfoBanner message="L'ordre de rotation peut être modifié une seule fois avant le démarrage." />
              </FormSectionCard>
              <FormSectionCard title="Accès">
                <FormToggleRow
                  name="isPublicLink"
                  control={control}
                  label="Lien public (QR Code)"
                  sublabel="Tout utilisateur vérifié peut demander à rejoindre"
                />
              </FormSectionCard>
            </>
          );
        case 3: {
          const v = rotativeForm.getValues();
          return (
            <CreateSummaryCard
              statusVariant="ready"
              rows={[
                { label: 'Nom', value: v.name },
                { label: 'Type', value: 'Rotative' },
                {
                  label: 'Part',
                  value: `${formatFcfa(Number(v.amountPerShare))} / ${freqLabel(v.frequency)}`,
                },
                { label: 'Démarrage', value: formatDate(v.startDate) },
                {
                  label: 'Pénalité',
                  value: `${Number(v.penaltyRate)}% / jour · ${v.gracePeriodDays} j grâce`,
                },
                { label: 'Rotation', value: rotationModeLabel(v.rotationMode) },
                { label: 'Parts max', value: `${v.maxSharesPerMember} part(s) / membre` },
                {
                  label: 'Score min',
                  value: v.requireMinScore && v.minScoreRequired != null ? `${v.minScoreRequired} pts` : 'Aucun',
                },
                {
                  label: 'Accès',
                  value: v.isPublicLink ? 'Lien public' : 'Invitation uniquement',
                },
              ]}
            />
          );
        }
        default:
          return <View />;
      }
    },
    [requireMinScore, rotativeForm]
  );

  const renderEpargneStep = useCallback(
    (step: number): React.ReactElement => {
      const control = epargneForm.control;
      const weeks =
        epStart && epUnlock ? calculateWeeks(epStart, epUnlock) : 0;
      const periods = epStart && epUnlock ? estimatePeriods(weeks, epFreq) : 0;

      switch (step) {
        case 0:
          return (
            <>
              <FormSectionCard title="Informations générales">
                <FormFieldInput
                  name="name"
                  control={control}
                  label="Nom de la tontine"
                  placeholder="Ex. Épargne solidaire"
                  maxLength={100}
                />
                <FormFieldInput
                  name="minimumContribution"
                  control={control}
                  label="Contribution minimale"
                  keyboardType="number-pad"
                  suffix="FCFA min."
                  formatValue={formatDigitsFcfa}
                />
                <View style={styles.freqBlock}>
                  <Text style={styles.freqLabel}>Fréquence</Text>
                  <FormFreqGrid
                    name="frequency"
                    control={control}
                    columns={2}
                    options={[
                      { value: 'MONTHLY', label: 'Mensuelle' },
                      { value: 'WEEKLY', label: 'Hebdomadaire' },
                      { value: 'BIWEEKLY', label: 'Bimensuelle' },
                    ]}
                  />
                </View>
              </FormSectionCard>
              <FormSectionCard title="Calendrier">
                <Controller
                  control={control}
                  name="startDate"
                  render={({ field: { value }, fieldState: { error } }) => (
                    <Pressable
                      onPress={() => setDatePicker('ep_start')}
                      accessibilityRole="button"
                      accessibilityLabel="Date de démarrage"
                    >
                      <Text style={styles.freqLabel}>Date de démarrage</Text>
                      <View style={styles.dateFieldWrap}>
                        <Text style={styles.dateFieldText}>
                          {value ? formatDateLong(value) : 'Choisir une date'}
                        </Text>
                      </View>
                      {error?.message != null && error.message !== '' ? (
                        <Text style={styles.dateErr}>{error.message}</Text>
                      ) : null}
                    </Pressable>
                  )}
                />
                <Controller
                  control={control}
                  name="unlockDate"
                  render={({ field: { value }, fieldState: { error } }) => (
                    <Pressable
                      onPress={() => setDatePicker('ep_unlock')}
                      accessibilityRole="button"
                      accessibilityLabel="Date de déblocage"
                    >
                      <Text style={styles.freqLabel}>Date de déblocage</Text>
                      <View style={styles.dateFieldWrap}>
                        <Text style={styles.dateFieldText}>
                          {value ? formatDateLong(value) : 'Choisir une date'}
                        </Text>
                      </View>
                      {error?.message != null && error.message !== '' ? (
                        <Text style={styles.dateErr}>{error.message}</Text>
                      ) : null}
                    </Pressable>
                  )}
                />
                {epStart && epUnlock ? (
                  <FormInfoBanner
                    message={`Durée : ${weeks} semaines · ~${periods} périodes`}
                  />
                ) : null}
              </FormSectionCard>
            </>
          );
        case 1:
          return (
            <>
              <FormSectionCard title="Objectif d'épargne (optionnel)">
                <FormFieldInput
                  name="targetAmountPerMember"
                  control={control}
                  label="Objectif individuel"
                  placeholder="Ex. 150 000"
                  keyboardType="number-pad"
                  suffix="FCFA"
                  formatValue={formatDigitsFcfa}
                />
                <FormFieldInput
                  name="targetAmountGlobal"
                  control={control}
                  label="Objectif collectif"
                  placeholder="Laisser vide si libre"
                  keyboardType="number-pad"
                  suffix="FCFA"
                  formatValue={formatDigitsFcfa}
                />
              </FormSectionCard>
              <FormSectionCard title="Fonds bonus">
                <FormSliderField
                  name="bonusRatePercent"
                  control={control}
                  label="Taux de bonus interne"
                  min={0}
                  max={20}
                  step={1}
                  suffix="%"
                />
                <FormWarnBanner message="Le bonus est une redistribution interne (pénalités + frais). Pas un intérêt financier garanti." />
              </FormSectionCard>
            </>
          );
        case 2:
          return (
            <>
              <FormSectionCard title="Conditions d'accès">
                <FormSliderField
                  name="minScoreRequired"
                  control={control}
                  label="Score Kelemba minimum"
                  min={0}
                  max={1000}
                  step={50}
                  suffix=" pts"
                />
                <FormFieldInput
                  name="maxMembers"
                  control={control}
                  label="Nombre maximum de membres"
                  keyboardType="number-pad"
                  suffix="membres"
                />
              </FormSectionCard>
              <FormSectionCard title="Sortie anticipée">
                <FormSliderField
                  name="earlyExitPenaltyPercent"
                  control={control}
                  label="Pénalité de sortie anticipée"
                  min={0}
                  max={30}
                  step={1}
                  suffix="%"
                  valueColor={COLORS.dangerText}
                  warningThreshold={0}
                />
                <FormWarnBanner message="Une pénalité de sortie anticipée peut s'appliquer selon les règles du groupe." />
                <FormToggleRow
                  name="isPrivate"
                  control={control}
                  label="Tontine privée"
                  sublabel="Accès sur invitation uniquement"
                />
              </FormSectionCard>
            </>
          );
        case 3: {
          const v = epargneForm.getValues();
          const w = epStart && epUnlock ? calculateWeeks(epStart, epUnlock) : 0;
          return (
            <CreateSummaryCard
              statusVariant="legal_warning"
              rows={[
                { label: 'Nom', value: v.name },
                { label: 'Type', value: 'Épargne' },
                {
                  label: 'Contribution',
                  value: `${formatFcfa(Number(v.minimumContribution))} / ${freqLabel(v.frequency)}`,
                },
                { label: 'Démarrage', value: formatDate(v.startDate) },
                {
                  label: 'Déblocage',
                  value: `${formatDate(v.unlockDate)} (${w} sem.)`,
                },
                {
                  label: 'Bonus interne',
                  value: `${v.bonusRatePercent}% (redistribution)`,
                },
                {
                  label: 'Sortie anticipée',
                  value: `Pénalité ${v.earlyExitPenaltyPercent}%`,
                },
                {
                  label: 'Accès',
                  value: `${v.isPrivate ? 'Privée' : 'Public'} · Score ≥ ${v.minScoreRequired}`,
                },
              ]}
            />
          );
        }
        default:
          return <View />;
      }
    },
    [epStart, epUnlock, epFreq, epargneForm]
  );

  const renderStepContent = useCallback(() => {
    if (tontineType === 'ROTATIVE') return renderRotativeStep(currentStep);
    return renderEpargneStep(currentStep);
  }, [currentStep, renderEpargneStep, renderRotativeStep, tontineType]);

  const pickerConfig = useMemo(() => {
    if (datePicker === 'rot_start') {
      return {
        value: rotativeForm.watch('startDate'),
        onChange: (iso: string) => rotativeForm.setValue('startDate', iso),
        minimumDate: TOMORROW,
      };
    }
    if (datePicker === 'ep_start') {
      return {
        value: epargneForm.watch('startDate'),
        onChange: (iso: string) => epargneForm.setValue('startDate', iso),
        minimumDate: TOMORROW,
      };
    }
    if (datePicker === 'ep_unlock') {
      const start = epargneForm.watch('startDate');
      const min = new Date(`${start}T00:00:00`);
      min.setDate(min.getDate() + 1);
      return {
        value: epargneForm.watch('unlockDate'),
        onChange: (iso: string) => epargneForm.setValue('unlockDate', iso),
        minimumDate: min > TOMORROW ? min : TOMORROW,
      };
    }
    return null;
  }, [datePicker, epargneForm, rotativeForm]);

  const onDateChange = useCallback(
    (_: unknown, selected?: Date) => {
      if (!selected || !pickerConfig) return;
      const y = selected.getFullYear();
      const m = String(selected.getMonth() + 1).padStart(2, '0');
      const d = String(selected.getDate()).padStart(2, '0');
      pickerConfig.onChange(`${y}-${m}-${d}`);
      setDatePicker(null);
    },
    [pickerConfig]
  );

  const nextA11y = useMemo(() => {
    const label = currentSteps[currentStep + 1]?.label;
    return label ? `Passer à l'étape : ${label}` : 'Étape suivante';
  }, [currentStep, currentSteps]);

  if (accountType !== 'ORGANISATEUR') {
    return null;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerGreen}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Retour"
          >
            <BackChevronWhite />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Nouvelle tontine
          </Text>
        </View>
        <CreateStepHeader
          steps={[...currentSteps]}
          currentStep={currentStep}
          tontineType={tontineType}
          onTypeChange={handleTypeChange}
        />
      </View>

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderStepContent()}
        </ScrollView>
      </KeyboardAvoidingView>

      {datePicker != null && pickerConfig != null ? (
        <DateTimePicker
          value={new Date(`${pickerConfig.value}T00:00:00`)}
          mode="date"
          minimumDate={pickerConfig.minimumDate}
          onChange={onDateChange}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        />
      ) : null}

      <View style={{ paddingBottom: insets.bottom }}>
        <FormNavButtons
          currentStep={currentStep}
          totalSteps={currentSteps.length}
          onPrev={handlePrev}
          onNext={() => {
            void handleNextOrSubmit();
          }}
          isLastStep={currentStep === currentSteps.length - 1}
          isSubmitting={isSubmitting}
          nextAccessibilityLabel={nextA11y}
          createAccessibilityLabel={
            tontineType === 'ROTATIVE' ? 'Créer la tontine rotative' : "Créer la tontine d'épargne"
          }
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.gray100,
  },
  headerGreen: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.white,
  },
  kav: { flex: 1 },
  scroll: { flex: 1, backgroundColor: COLORS.gray100 },
  scrollContent: { padding: 16 },
  freqBlock: { marginBottom: 14 },
  freqLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.gray500,
    marginBottom: 8,
  },
  datePress: { marginBottom: 14 },
  dateFieldWrap: {
    backgroundColor: COLORS.gray100,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dateFieldText: {
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  dateErr: {
    fontSize: 10,
    color: COLORS.dangerText,
    marginTop: 4,
  },
});
