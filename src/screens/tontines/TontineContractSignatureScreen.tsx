/**
 * Écran de lecture, acceptation et signature numérique du contrat de tontine.
 * Réutilisable pour invitation nominative (INVITE_ACCEPT) et join request (JOIN_REQUEST).
 */
import React, { useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useTontineContractPreview } from '@/hooks/useTontineContractPreview';
import { acceptInvitation, createJoinRequest } from '@/api/tontinesApi';
import { parseApiError, getErrorMessageForCode } from '@/api/errors';
import { ApiErrorCode } from '@/api/errors/errorCodes';
import { logger } from '@/utils/logger';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { colors } from '@/theme/colors';

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

const MIN_BUTTON_HEIGHT = 48;

export const TontineContractSignatureScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { mode, tontineUid, tontineName, sharesCount } = route.params;

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

  const acceptMutation = useMutation({
    mutationFn: async (payload: ContractFormData & { contractVersion: string }) => {
      await acceptInvitation(tontineUid, undefined, {
        acceptedTerms: true,
        signatureName: payload.signatureName.trim(),
        contractVersion: payload.contractVersion,
        sharesCount,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tontines'] });
      queryClient.invalidateQueries({ queryKey: ['invitationsReceived'] });
      queryClient.invalidateQueries({ queryKey: ['pendingMemberRequests'] });
      Alert.alert(
        t('tontineList.acceptSuccess', 'Invitation acceptée'),
        t('tontineList.acceptSuccessMessage', 'Vous êtes maintenant membre de cette tontine.')
      );
      navigation.goBack();
    },
    onError: (err: unknown) => {
      const apiErr = parseApiError(err);
      if (apiErr.code === ApiErrorCode.INVITATION_ALREADY_PROCESSED) {
        queryClient.invalidateQueries({ queryKey: ['tontines'] });
        queryClient.invalidateQueries({ queryKey: ['invitationsReceived'] });
        navigation.goBack();
        return;
      }
      const msg = getErrorMessageForCode(apiErr, i18n.language === 'sango' ? 'sango' : 'fr');
      Alert.alert(t('common.error'), msg);
    },
  });

  const joinMutation = useMutation({
    mutationFn: async (payload: ContractFormData & { contractVersion: string }) => {
      await createJoinRequest(tontineUid, sharesCount, {
        acceptedTerms: true,
        signatureName: payload.signatureName.trim(),
        contractVersion: payload.contractVersion,
        sharesCount,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tontines'] });
      queryClient.invalidateQueries({ queryKey: ['pendingMemberRequests'] });
      Alert.alert(
        t('tontineList.joinRequestSentTitle', 'Demande envoyée'),
        t('tontineList.joinRequestSentMessage', "Votre demande d'adhésion a été envoyée. Elle est en attente de validation par l'organisateur.", {
          name: tontineName ?? '',
        })
      );
      navigation.goBack();
    },
    onError: (err: unknown) => {
      const apiErr = parseApiError(err);
      logger.error('[TontineContractSignature] joinMutation failed', {
        tontineUid,
        code: apiErr.code,
      });
      const msg = getErrorMessageForCode(apiErr, i18n.language === 'sango' ? 'sango' : 'fr');
      Alert.alert(t('common.error'), msg);
    },
  });

  const onSubmit = useCallback(
    (data: ContractFormData) => {
      if (!contract) return;
      const payload = { ...data, contractVersion: contract.contractVersion };
      if (mode === 'INVITE_ACCEPT') {
        acceptMutation.mutate(payload);
      } else {
        joinMutation.mutate(payload);
      }
    },
    [contract, mode, acceptMutation, joinMutation]
  );

  const isSubmitting = acceptMutation.isPending || joinMutation.isPending;
  const canSubmit =
    contract != null &&
    acceptedTerms === true &&
    (signatureName?.trim() ?? '').length >= 2 &&
    !isSubmitting;

  const subtitle =
    mode === 'INVITE_ACCEPT'
      ? t('contractSignature.subtitleInvite', 'Invitation reçue')
      : t('contractSignature.subtitleJoinRequest', 'Demande d\'adhésion');

  const ctaLabel =
    mode === 'INVITE_ACCEPT'
      ? t('contractSignature.ctaSignAccept', 'Signer et accepter l\'invitation')
      : t('contractSignature.ctaSignSubmit', 'Signer et soumettre la demande');

  if (contractLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>{tontineName ?? t('contractSignature.loading', 'Chargement...')}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <View style={styles.skeletonContainer}>
          <SkeletonBlock width="100%" height={200} borderRadius={12} style={styles.skeleton} />
          <SkeletonBlock width="100%" height={140} borderRadius={12} style={styles.skeleton} />
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
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>{tontineName ?? ''}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <ErrorBanner
          message={errMsg}
          severity="error"
          onDismiss={() => refetchContract()}
        />
        <Pressable
          style={styles.retryBtn}
          onPress={() => refetchContract()}
          accessibilityRole="button"
        >
          <Text style={styles.retryBtnText}>{t('common.retry', 'Réessayer')}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const snapshot = contract.contractSnapshot as Record<string, unknown>;
  const amount = snapshot?.amountPerShare as number | undefined;
  const frequency = snapshot?.frequency as string | undefined;
  const penalty = snapshot?.penaltyValue as number | undefined;
  const startDate = snapshot?.startDate as string | undefined;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={2}>
              {tontineName ?? contract.tontineUid}
            </Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          {amount != null && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>
                {t('contractSignature.summaryTitle', 'Règles clés')}
              </Text>
              <Text style={styles.summaryRow}>
                {t('contractSignature.amountPerShare', 'Montant par part')}:{' '}
                {amount.toLocaleString('fr-FR')} FCFA
              </Text>
              {frequency && (
                <Text style={styles.summaryRow}>
                  {t('contractSignature.frequency', 'Fréquence')}: {frequency}
                </Text>
              )}
              {penalty != null && (
                <Text style={styles.summaryRow}>
                  {t('contractSignature.penalty', 'Pénalité')}: {penalty} FCFA
                </Text>
              )}
              {startDate && (
                <Text style={styles.summaryRow}>
                  {t('contractSignature.startDate', 'Début')}: {startDate}
                </Text>
              )}
            </View>
          )}

          <View style={styles.contractBlock}>
            <Text style={styles.contractLabel}>
              {t('contractSignature.contractText', 'Contrat')}
            </Text>
            <ScrollView
              style={styles.contractScroll}
              nestedScrollEnabled
              showsVerticalScrollIndicator={true}
            >
              <Text style={styles.contractText}>{contract.contractText}</Text>
            </ScrollView>
          </View>

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
                  <View style={[styles.checkbox, value && styles.checkboxChecked]}>
                    {value && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.checkboxLabel}>
                    {t('contractSignature.acceptedTerms', 'Je reconnais avoir lu et accepté les termes du contrat')}
                  </Text>
                </Pressable>
              )}
            />
            {errors.acceptedTerms && (
              <Text style={styles.errorText}>
                {t('contractSignature.acceptedTermsRequired', 'Vous devez accepter les termes du contrat')}
              </Text>
            )}

            <Controller
              control={control}
              name="signatureName"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>
                    {t('contractSignature.signatureNameLabel', 'Nom complet pour signature numérique')}
                  </Text>
                  <TextInput
                    style={[styles.input, errors.signatureName && styles.inputError]}
                    placeholder={t('contractSignature.signatureNamePlaceholder', 'Nom et prénom')}
                    placeholderTextColor="#9CA3AF"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="words"
                    autoCorrect={false}
                    editable={!isSubmitting}
                  />
                  {errors.signatureName && (
                    <Text style={styles.errorText}>
                      {t('contractSignature.signatureNameMin', 'Nom requis (min 2 caractères)')}
                    </Text>
                  )}
                </View>
              )}
            />
          </View>

          <Pressable
            style={[styles.cta, (!canSubmit || isSubmitting) && styles.ctaDisabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={!canSubmit || isSubmitting}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit || isSubmitting }}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaText}>{ctaLabel}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  keyboardView: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  skeletonContainer: {
    gap: 12,
  },
  skeleton: {
    marginBottom: 12,
  },
  retryBtn: {
    alignSelf: 'center',
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  summaryRow: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  contractBlock: {
    marginBottom: 20,
  },
  contractLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  contractScroll: {
    maxHeight: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  contractText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
  consentBlock: {
    marginBottom: 24,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    marginTop: -8,
    marginBottom: 8,
  },
  inputRow: {
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputError: {
    borderColor: colors.danger,
  },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: MIN_BUTTON_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
