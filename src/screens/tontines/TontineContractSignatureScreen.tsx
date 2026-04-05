/**
 * Écran invitation / contrat : lecture, éligibilité score, parts, signature.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { selectKelembScore } from '@/store/authSlice';
import { useTontineContractPreview } from '@/hooks/useTontineContractPreview';
import { acceptInvitation, createJoinRequest, rejectInvitation } from '@/api/tontinesApi';
import { parseApiError, getErrorMessageForCode } from '@/api/errors';
import { ApiErrorCode } from '@/api/errors/errorCodes';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';
import { formatFcfaAmount } from '@/utils/formatters';
import { freqShort } from '@/utils/tontineFrequencyShort';
import type { TontineFrequency } from '@/api/types/api.types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const contractSchema = z.object({
  acceptedTerms: z.boolean().refine((v) => v === true, {
    message: 'contractSchema.acceptedTermsRequired',
  }),
  signatureName: z
    .string()
    .trim()
    .min(2, 'contractSchema.signatureNameMin'),
});

type ContractFormData = z.infer<typeof contractSchema>;

type Props = NativeStackScreenProps<RootStackParamList, 'TontineContractSignature'>;

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return `${p[0][0] ?? ''}${p[p.length - 1][0] ?? ''}`.toUpperCase();
}

function pctScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, Math.round((score / 1000) * 100)));
}

export const TontineContractSignatureScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const userScore = useSelector(selectKelembScore);
  const { mode, tontineUid, tontineName: routeTontineName, sharesCount: routeShares } =
    route.params;

  const [selectedShares, setSelectedShares] = useState(routeShares ?? 1);
  const [regOpen, setRegOpen] = useState(false);

  const {
    data: contract,
    isLoading: contractLoading,
    isError: contractError,
    error: contractErrorObj,
    refetch: refetchContract,
  } = useTontineContractPreview(tontineUid, true);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ContractFormData>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      acceptedTerms: false,
      signatureName: '',
    },
  });

  const acceptedTerms = watch('acceptedTerms');
  const signatureName = watch('signatureName');

  const snapshot = contract?.contractSnapshot as Record<string, unknown> | undefined;

  const meta = useMemo(() => {
    if (!snapshot) {
      return {
        amount: undefined as number | undefined,
        frequency: undefined as string | undefined,
        penalty: undefined as number | undefined,
        startDate: undefined as string | undefined,
        creatorName: '',
        creatorScore: null as number | null,
        memberCount: 1,
        totalCycles: 1,
        minScoreRequired: null as number | null,
        rotationMode: '',
        isPublic: true,
        maxShares: 1,
      };
    }
    const rules = snapshot.rules as Record<string, unknown> | undefined;
    return {
      amount: snapshot.amountPerShare as number | undefined,
      frequency: snapshot.frequency as string | undefined,
      penalty: snapshot.penaltyValue as number | undefined,
      startDate: snapshot.startDate as string | undefined,
      creatorName:
        (snapshot.organizerName as string) ??
        (snapshot.creatorName as string) ??
        'Organisateur',
      creatorScore:
        typeof snapshot.organizerKelembScore === 'number'
          ? snapshot.organizerKelembScore
          : typeof snapshot.creatorKelembScore === 'number'
            ? snapshot.creatorKelembScore
            : null,
      memberCount:
        typeof snapshot.activeMemberCount === 'number'
          ? snapshot.activeMemberCount
          : typeof snapshot.memberCount === 'number'
            ? snapshot.memberCount
            : 1,
      totalCycles:
        typeof snapshot.totalCycles === 'number' ? snapshot.totalCycles : 1,
      minScoreRequired:
        typeof snapshot.minScoreRequired === 'number'
          ? snapshot.minScoreRequired
          : typeof rules?.minScoreRequired === 'number'
            ? (rules.minScoreRequired as number)
            : null,
      rotationMode: String(snapshot.rotationMode ?? rules?.rotationMode ?? '—'),
      isPublic: snapshot.isPublicLink !== false,
      maxShares:
        typeof snapshot.maxSharesPerMember === 'number'
          ? snapshot.maxSharesPerMember
          : 1,
    };
  }, [snapshot]);

  const displayName = routeTontineName ?? (snapshot?.name as string) ?? contract?.tontineUid ?? '';
  const scoreOk =
    meta.minScoreRequired == null || userScore >= meta.minScoreRequired;

  const poolPerCycle =
    meta.amount != null
      ? Math.round(meta.amount * Math.max(1, meta.memberCount))
      : null;

  const shareOptions = useMemo(() => {
    const max = Math.max(1, Math.min(5, meta.maxShares));
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [meta.maxShares]);

  const acceptMutation = useMutation({
    mutationFn: async (payload: ContractFormData & { contractVersion: string }) => {
      const sc = Math.max(1, selectedShares);
      if (mode === 'INVITE_ACCEPT') {
        await acceptInvitation(tontineUid, undefined, {
          acceptedTerms: true,
          signatureName: payload.signatureName.trim(),
          contractVersion: payload.contractVersion,
          sharesCount: sc,
        });
      } else {
        await createJoinRequest(tontineUid, sc, {
          acceptedTerms: true,
          signatureName: payload.signatureName.trim(),
          contractVersion: payload.contractVersion,
          sharesCount: sc,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tontines'] });
      queryClient.invalidateQueries({ queryKey: ['invitationsReceived'] });
      queryClient.invalidateQueries({ queryKey: ['pendingMemberRequests'] });
      navigation.replace('TontineDetails', {
        tontineUid,
        isCreator: false,
        tab: 'dashboard',
      });
    },
    onError: (err: unknown) => {
      const apiErr = parseApiError(err);
      if (apiErr.code === ApiErrorCode.INVITATION_ALREADY_PROCESSED) {
        queryClient.invalidateQueries({ queryKey: ['tontines'] });
        queryClient.invalidateQueries({ queryKey: ['invitationsReceived'] });
        navigation.replace('TontineDetails', {
          tontineUid,
          isCreator: false,
          tab: 'dashboard',
        });
        return;
      }
      const msg = getErrorMessageForCode(apiErr, i18n.language === 'sango' ? 'sango' : 'fr');
      Alert.alert(t('common.error'), msg);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectInvitation(tontineUid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitationsReceived'] });
      queryClient.invalidateQueries({ queryKey: ['tontines'] });
      navigation.navigate('MainTabs', { screen: 'Tontines' });
    },
    onError: (err: unknown) => {
      const apiErr = parseApiError(err);
      Alert.alert(
        t('common.error'),
        getErrorMessageForCode(apiErr, i18n.language === 'sango' ? 'sango' : 'fr')
      );
    },
  });

  const onSubmit = useCallback(
    (data: ContractFormData) => {
      if (!contract) return;
      if (!scoreOk) return;
      const payload = { ...data, contractVersion: contract.contractVersion };
      acceptMutation.mutate(payload);
    },
    [acceptMutation, contract, scoreOk]
  );

  const onReject = () => {
    Alert.alert(
      'Refuser l’invitation',
      'Confirmez-vous le refus ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: () => rejectMutation.mutate(),
        },
      ]
    );
  };

  const isSubmitting = acceptMutation.isPending || rejectMutation.isPending;
  const canSubmit =
    contract != null &&
    acceptedTerms === true &&
    (signatureName?.trim() ?? '').length >= 2 &&
    scoreOk &&
    !isSubmitting;

  const toggleReg = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRegOpen((o) => !o);
  };

  if (contractLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.heroLoad}>
          <SkeletonBlock width="100%" height={120} borderRadius={12} />
        </View>
      </SafeAreaView>
    );
  }

  if (contractError || !contract) {
    const errMsg =
      contractErrorObj instanceof Error
        ? contractErrorObj.message
        : t('contractSignature.loadError', 'Impossible de charger le contrat.');
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ErrorBanner message={errMsg} severity="error" onDismiss={() => refetchContract()} />
        <Pressable style={styles.retryBtn} onPress={() => refetchContract()}>
          <Text style={styles.retryBtnText}>{t('common.retry', 'Réessayer')}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const freqLabel =
    meta.frequency != null && meta.frequency !== ''
      ? freqShort(meta.frequency as TontineFrequency)
      : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.scrollPad}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.senderRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(meta.creatorName)}</Text>
              </View>
              <View style={styles.senderText}>
                <Text style={styles.creatorName} numberOfLines={2}>
                  {meta.creatorName}
                </Text>
                <Text style={styles.inviteHint}>
                  vous invite à rejoindre sa tontine
                </Text>
              </View>
              {meta.creatorScore != null ? (
                <View style={styles.scorePill}>
                  <Text style={styles.scorePillText}>{meta.creatorScore} pts</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.tontineCard}>
              <Text style={styles.tontineTitle} numberOfLines={2}>
                {displayName}
              </Text>
              <View style={styles.chipsRow}>
                {meta.amount != null ? (
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>
                      {formatFcfaAmount(Math.round(meta.amount))} / part
                    </Text>
                  </View>
                ) : null}
                {freqLabel ? (
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>{freqLabel}</Text>
                  </View>
                ) : null}
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{meta.memberCount} membres</Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{meta.totalCycles} cycles</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.details}>
            <Text style={styles.sectionTitle}>Détails de la tontine</Text>
            <View style={styles.table}>
              <Row
                label="Date de démarrage"
                value={meta.startDate ?? '—'}
              />
              <Row
                label="Cagnotte par cycle"
                value={
                  poolPerCycle != null
                    ? `${formatFcfaAmount(poolPerCycle)} FCFA`
                    : '—'
                }
              />
              <Row
                label="Pénalité de retard"
                value={
                  meta.penalty != null ? `${meta.penalty} %` : '—'
                }
              />
              <Row label="Mode de rotation" value={meta.rotationMode} />
              <Row
                label="Accès"
                value={meta.isPublic ? 'Public' : 'Privé'}
              />
            </View>

            <Text style={styles.sectionTitle}>Votre éligibilité</Text>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>Votre Score Kelemba</Text>
              <Text style={styles.scoreVal}>
                {userScore} / 1000
              </Text>
            </View>
            <View style={styles.scoreTrack}>
              <View
                style={[styles.scoreFill, { width: `${pctScore(userScore)}%` }]}
              />
            </View>
            {meta.minScoreRequired != null ? (
              scoreOk ? (
                <Text style={styles.okMsg}>
                  ✓ Score suffisant · Score min. requis : {meta.minScoreRequired}
                </Text>
              ) : (
                <>
                  <Text style={styles.badMsg}>
                    ✗ Score insuffisant · Min. requis : {meta.minScoreRequired}
                  </Text>
                  <Text style={styles.badSub}>
                    Vous ne pouvez pas rejoindre cette tontine pour le moment.
                  </Text>
                </>
              )
            ) : (
              <Text style={styles.okMsg}>Score vérifié</Text>
            )}

            {shareOptions.length > 1 ? (
              <>
                <Text style={styles.sectionTitle}>Nombre de parts</Text>
                <View style={styles.sharesGrid}>
                  {shareOptions.map((n) => {
                    const sel = selectedShares === n;
                    const amt =
                      meta.amount != null
                        ? formatFcfaAmount(Math.round(meta.amount * n))
                        : '—';
                    return (
                      <Pressable
                        key={n}
                        onPress={() => setSelectedShares(n)}
                        style={[styles.shareCell, sel && styles.shareCellOn]}
                      >
                        <Text style={styles.shareN}>
                          {n} part{n > 1 ? 's' : ''}
                        </Text>
                        <Text style={styles.shareAmt}>{amt}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            <Pressable onPress={toggleReg} style={styles.accBtn}>
              <Text style={styles.accTitle}>Lire le règlement de participation</Text>
              <Ionicons
                name={regOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={COLORS.gray700}
              />
            </Pressable>
            {regOpen ? (
              <View style={styles.accBody}>
                <Text style={styles.contractInline}>{contract.contractText}</Text>
              </View>
            ) : null}

            <View style={styles.consentBlock}>
              <Controller
                control={control}
                name="acceptedTerms"
                render={({ field: { onChange, value } }) => (
                  <Pressable
                    style={styles.checkboxRow}
                    onPress={() => onChange(!value)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: value === true }}
                  >
                    <View style={[styles.checkbox, value && styles.checkboxOn]}>
                      {value ? (
                        <Ionicons name="checkmark" size={16} color={COLORS.white} />
                      ) : null}
                    </View>
                    <Text style={styles.checkboxLabel}>
                      Je reconnais avoir lu et accepté les termes du contrat
                    </Text>
                  </Pressable>
                )}
              />
              {errors.acceptedTerms ? (
                <Text style={styles.errSmall}>Acceptation requise</Text>
              ) : null}

              <Controller
                control={control}
                name="signatureName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View style={styles.inpWrap}>
                    <Text style={styles.inpLabel}>Nom complet pour signature</Text>
                    <TextInput
                      style={[styles.inp, errors.signatureName && styles.inpErr]}
                      placeholder="Nom et prénom"
                      placeholderTextColor={COLORS.gray500}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      autoCapitalize="words"
                      editable={!isSubmitting}
                    />
                  </View>
                )}
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.sticky}>
          {!scoreOk ? (
            <Pressable
              style={[styles.btnGhost, styles.btnFull]}
              onPress={onReject}
              disabled={rejectMutation.isPending}
              accessibilityRole="button"
              accessibilityLabel={`Refuser l'invitation pour ${displayName}`}
            >
              <Text style={styles.btnGhostText}>Refuser</Text>
            </Pressable>
          ) : (
            <View style={styles.stickyRow}>
              <Pressable
                style={[styles.btnGhost, styles.btnFlex1]}
                onPress={onReject}
                disabled={rejectMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel={`Refuser l'invitation pour ${displayName}`}
              >
                <Text style={styles.btnGhostText}>Refuser</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.btnPri,
                  styles.btnFlex2,
                  (!canSubmit || isSubmitting) && styles.btnDis,
                ]}
                onPress={handleSubmit(onSubmit)}
                disabled={!canSubmit || isSubmitting}
                accessibilityRole="button"
                accessibilityLabel={`Accepter et signer le règlement de ${displayName}`}
                accessibilityState={{ disabled: !canSubmit }}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.btnPriText}>Accepter et signer →</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.rowTable}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.primary },
  flex1: { flex: 1 },
  heroLoad: { padding: 20, backgroundColor: COLORS.primary },
  scrollPad: { paddingBottom: 120 },
  hero: {
    backgroundColor: COLORS.primary,
    paddingTop: 44,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '600', color: COLORS.white },
  senderText: { flex: 1 },
  creatorName: { fontSize: 15, fontWeight: '500', color: COLORS.white },
  inviteHint: { fontSize: 11, color: 'rgba(255,255,255,.75)', marginTop: 2 },
  scorePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,255,255,.15)',
  },
  scorePillText: { fontSize: 10, color: COLORS.white },
  tontineCard: {
    backgroundColor: 'rgba(255,255,255,.12)',
    borderRadius: 12,
    padding: 14,
  },
  tontineTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: COLORS.white,
    marginBottom: 8,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,255,255,.15)',
  },
  chipText: { fontSize: 11, color: COLORS.white },
  details: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 10,
    marginTop: 8,
  },
  table: { gap: 8, marginBottom: 8 },
  rowTable: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray200,
  },
  rowLabel: { fontSize: 12, color: COLORS.gray500, flex: 1 },
  rowValue: { fontSize: 13, fontWeight: '500', color: COLORS.textPrimary, flex: 1, textAlign: 'right' },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  scoreLabel: { fontSize: 13, color: COLORS.textPrimary },
  scoreVal: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  scoreTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.gray100,
    overflow: 'hidden',
    marginBottom: 8,
  },
  scoreFill: { height: '100%', backgroundColor: COLORS.primary },
  okMsg: { fontSize: 11, color: COLORS.primaryDark, marginBottom: 8 },
  badMsg: { fontSize: 11, color: COLORS.dangerText },
  badSub: { fontSize: 11, color: COLORS.gray500, marginTop: 4, marginBottom: 8 },
  sharesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  shareCell: {
    minWidth: '28%',
    flexGrow: 1,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    padding: 10,
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
  },
  shareCellOn: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  shareN: { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary },
  shareAmt: { fontSize: 10, color: COLORS.gray500, marginTop: 4 },
  accBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  accTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, flex: 1 },
  accBody: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: COLORS.gray100,
    borderRadius: RADIUS.sm,
  },
  contractInline: { fontSize: 12, color: COLORS.textPrimary, lineHeight: 18 },
  consentBlock: { marginTop: 8 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.gray200,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkboxLabel: { flex: 1, fontSize: 13, color: COLORS.textPrimary },
  errSmall: { fontSize: 11, color: COLORS.dangerText, marginBottom: 6 },
  inpWrap: { marginBottom: 12 },
  inpLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, color: COLORS.textPrimary },
  inp: {
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    backgroundColor: COLORS.gray100,
  },
  inpErr: { borderColor: COLORS.danger },
  sticky: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.gray200,
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
  },
  stickyRow: { flexDirection: 'row', gap: 8 },
  btnFull: { width: '100%' },
  btnFlex1: { flex: 1 },
  btnFlex2: { flex: 2 },
  btnGhost: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  btnGhostText: { fontSize: 15, fontWeight: '600', color: COLORS.gray700 },
  btnPri: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPriText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  btnDis: { opacity: 0.45 },
  retryBtn: {
    alignSelf: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: COLORS.white,
    borderRadius: 10,
  },
  retryBtnText: { color: COLORS.primary, fontWeight: '600' },
});
