import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  CommonActions,
  useFocusEffect,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ErrorBanner } from '@/components/ui';
import type {
  KycFlowOrigin,
  KycStackParamList,
  ProfileStackParamList,
} from '@/navigation/types';
import { ApiErrorCode } from '@/api/errors/errorCodes';
import { ApiError } from '@/api/errors/ApiError';
import { useDispatch } from 'react-redux';
import { setKycStatus } from '@/store/authSlice';
import { useKycStatus, useSubmitKycDocuments } from '@/hooks/useKyc';
import {
  KycDocumentPicker,
  KycSelfieCamera,
  KycUploadProgress,
} from '@/components/kyc';
import type {
  KycDocument,
  KycDocumentType,
  KycUploadPayload,
} from '@/types/kyc.types';
import { KYC_DOCUMENT_STEPS, KYC_DOCUMENT_TYPES } from '@/types/kyc.types';
import {
  KYC_STATUS_LABEL_KEYS,
  KYC_STATUS_MESSAGE_KEYS,
  KYC_STATUS_SEVERITY,
  MAX_KYC_FILE_SIZE_BYTES,
  isKycUnderReview,
  isSupportedKycMimeType,
  needsBackDocument,
} from '@/utils/kyc';

type KycNavigationParamList = KycStackParamList & ProfileStackParamList;

interface Props {
  navigation: NativeStackNavigationProp<KycNavigationParamList, 'KycUpload'>;
  route: RouteProp<KycNavigationParamList, 'KycUpload'>;
}

function isKycDocumentType(value: unknown): value is KycDocumentType {
  return value === 'CNI' || value === 'PASSPORT';
}

function isKycDocument(value: unknown): value is KycDocument {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const document = value as Partial<KycDocument>;
  return (
    KYC_DOCUMENT_STEPS.includes(document.step as (typeof KYC_DOCUMENT_STEPS)[number]) &&
    typeof document.uri === 'string' &&
    document.uri.length > 0 &&
    typeof document.mimeType === 'string' &&
    typeof document.fileName === 'string' &&
    typeof document.fileSize === 'number'
  );
}

const kycSchema = z
  .object({
    documentType: z.custom<KycDocumentType>(isKycDocumentType, {
      message: 'Choisissez le type de document',
    }),
    front: z.custom<KycDocument | null>(
      (value): value is KycDocument | null => value === null || isKycDocument(value)
    ),
    back: z.custom<KycDocument | null>(
      (value): value is KycDocument | null => value === null || isKycDocument(value)
    ),
    selfie: z.custom<KycDocument | null>(
      (value): value is KycDocument | null => value === null || isKycDocument(value)
    ),
  })
  .superRefine((value, ctx) => {
    if (!value.front) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['front'],
        message: 'Le recto de la pièce est obligatoire',
      });
    }

    if (value.documentType === 'CNI' && !value.back) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['back'],
        message: 'Le verso est obligatoire pour une CNI',
      });
    }

    if (!value.selfie) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['selfie'],
        message: 'Le selfie est obligatoire',
      });
    }

    const documents: Array<{ field: 'front' | 'back' | 'selfie'; file: KycDocument | null }> = [
      { field: 'front', file: value.front },
      { field: 'back', file: value.back },
      { field: 'selfie', file: value.selfie },
    ];

    for (const document of documents) {
      if (!document.file) {
        continue;
      }

      if (!isSupportedKycMimeType(document.file.mimeType)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [document.field],
          message: "Le fichier sélectionné n'est pas une image valide",
        });
      }

      if (document.file.fileSize > MAX_KYC_FILE_SIZE_BYTES) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [document.field],
          message: 'Le fichier est trop volumineux',
        });
      }
    }
  });

function getErrorMessage(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function getStatusMessage(
  t: ReturnType<typeof useTranslation>['t'],
  status: 'PENDING' | 'SUBMITTED' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED',
  rejectionReason?: string | null
): string {
  if (status === 'REJECTED' && rejectionReason) {
    return t('kyc.statusRejectedReason', { reason: rejectionReason });
  }

  return t(KYC_STATUS_MESSAGE_KEYS[status]);
}

function getSubmitFeedback(
  err: unknown,
  t: ReturnType<typeof useTranslation>['t']
): { message: string; severity: 'error' | 'warning' | 'info' } {
  if (ApiError.isApiError(err)) {
    // 409 : déjà soumis
    if (err.httpStatus === 409) {
      return {
        message: t('kyc.alreadySubmittedMessage'),
        severity: 'info',
      };
    }

    // 400 / 422 : validation backend (documentType, verso manquant, format rejeté)
    if (err.httpStatus === 400 || err.httpStatus === 422) {
      const backendMsg =
        typeof err.message === 'string' && err.message.length > 0
          ? err.message
          : t('kyc.invalidImage');
      return {
        message: backendMsg,
        severity: 'error',
      };
    }

    // Erreur réseau (timeout, pas de réponse)
    if (
      err.code === ApiErrorCode.TIMEOUT ||
      err.code === ApiErrorCode.NETWORK_ERROR
    ) {
      return {
        message: t('kyc.networkErrorMessage'),
        severity: 'warning',
      };
    }

    // 5xx : erreur serveur backend
    if (
      err.code === ApiErrorCode.SERVER_ERROR ||
      (err.httpStatus >= 500 && err.httpStatus < 600)
    ) {
      return {
        message: t('kyc.serverErrorMessage'),
        severity: 'error',
      };
    }
  }

  return {
    message: t('kyc.uploadFailed'),
    severity: 'error',
  };
}

type KycFormInput = z.input<typeof kycSchema>;
type KycFormOutput = z.output<typeof kycSchema>;

export const KycUploadScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const origin: KycFlowOrigin = route.params?.origin ?? 'kycGate';
  const [uploadProgress, setUploadProgress] = useState(0);
  const [feedback, setFeedback] = useState<{
    message: string;
    severity: 'error' | 'warning' | 'info';
  } | null>(null);
  const { data: statusData, isLoading: isStatusLoading, refetch } = useKycStatus();
  const submitKycMutation = useSubmitKycDocuments();

  const {
    watch,
    setValue,
    clearErrors,
    handleSubmit,
    formState: { errors },
  } = useForm<KycFormInput, unknown, KycFormOutput>({
    resolver: zodResolver(kycSchema),
    defaultValues: {
      documentType: undefined,
      front: null,
      back: null,
      selfie: null,
    },
  });

  const documentType = watch('documentType');
  const frontDoc = watch('front');
  const backDoc = watch('back');
  const selfieDoc = watch('selfie');

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  useEffect(() => {
    if (statusData?.documentType && !documentType) {
      setValue('documentType', statusData.documentType, { shouldValidate: true });
    }
  }, [documentType, setValue, statusData?.documentType]);

  const handleDocumentTypeChange = (value: KycDocumentType) => {
    setFeedback(null);
    setValue('documentType', value, { shouldValidate: true });

    if (value === 'PASSPORT') {
      setValue('back', null, { shouldValidate: false });
      clearErrors('back');
    }
  };

  const handleDocumentChange = (
    field: 'front' | 'back' | 'selfie',
    document: KycDocument | null
  ) => {
    setFeedback(null);
    setValue(field, document, { shouldValidate: true });
    if (document) {
      clearErrors(field);
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else if (origin === 'profile') {
      navigation.replace('Profile');
    } else {
      navigation.replace('KycPending');
    }
  };

  const handleStatusAction = () => {
    if (!statusData) {
      return;
    }

    if (statusData.status === 'REJECTED' || statusData.status === 'PENDING') {
      return;
    }

    if (statusData.status === 'VERIFIED') {
      dispatch(setKycStatus({ kycStatus: 'VERIFIED' }));

      if (origin === 'profile') {
        navigation.replace('Profile');
        return;
      }

      navigation.getParent()?.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        })
      );
      return;
    }

    if (origin === 'profile') {
      navigation.replace('Profile');
      return;
    }

    navigation.replace('KycPending');
  };

  const onValidSubmit = async (values: KycFormOutput) => {
    if (!values.documentType || !values.front || !values.selfie) {
      return;
    }

    // CNI : verso obligatoire (validation locale avant envoi)
    if (values.documentType === 'CNI' && !values.back) {
      setFeedback({
        message: t('kyc.validationFixErrors'),
        severity: 'error',
      });
      return;
    }

    setFeedback(null);
    setUploadProgress(0);

    const payload: KycUploadPayload = {
      documentType: values.documentType,
      front: values.front,
      back: values.documentType === 'CNI' ? values.back ?? null : undefined,
      selfie: values.selfie,
    };

    try {
      await submitKycMutation.mutateAsync({
        payload,
        onUploadProgress: setUploadProgress,
      });
      navigation.replace('KycSuccess', { origin });
    } catch (err: unknown) {
      const nextFeedback = getSubmitFeedback(err, t);
      setFeedback(nextFeedback);

      if (ApiError.isApiError(err) && err.httpStatus === 409) {
        dispatch(setKycStatus({ kycStatus: 'SUBMITTED' }));
        await refetch();

        if (origin !== 'profile') {
          navigation.replace('KycPending');
        }
      }
    } finally {
      setUploadProgress(0);
    }
  };

  const onInvalidSubmit = () => {
    setFeedback({
      message: t('kyc.validationFixErrors'),
      severity: 'error',
    });
  };

  const showStatusOnly =
    statusData != null &&
    (isKycUnderReview(statusData.status) || statusData.status === 'VERIFIED');

  const statusBanner = statusData
    ? {
        title: t(KYC_STATUS_LABEL_KEYS[statusData.status]),
        message: getStatusMessage(t, statusData.status, statusData.rejectionReason),
        severity: KYC_STATUS_SEVERITY[statusData.status],
      }
    : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
        </Pressable>
        <Text style={styles.headerTitle}>{t('kyc.title')}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>{t('kyc.title')}</Text>
          <Text style={styles.heroText}>{t('kyc.description')}</Text>
        </View>

        {isStatusLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color="#1A6B3C" />
            <Text style={styles.loadingText}>{t('common.loading')}</Text>
          </View>
        ) : null}

        {statusBanner ? (
          <ErrorBanner
            message={`${statusBanner.title} - ${statusBanner.message}`}
            severity={statusBanner.severity}
          />
        ) : null}

        {feedback ? (
          <ErrorBanner
            message={feedback.message}
            severity={feedback.severity}
            onDismiss={() => setFeedback(null)}
          />
        ) : null}

        {showStatusOnly ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusCardTitle}>{statusBanner?.title}</Text>
            <Text style={styles.statusCardText}>{statusBanner?.message}</Text>
            <Pressable style={styles.secondaryCta} onPress={handleStatusAction}>
              <Text style={styles.secondaryCtaText}>
                {origin === 'profile' ? t('kyc.backToProfile') : t('kyc.viewStatus')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('kyc.chooseDocumentType')}</Text>
              <Text style={styles.sectionHint}>{t('kyc.documentTypeHelp')}</Text>
              <View style={styles.typeRow}>
                {KYC_DOCUMENT_TYPES.map((value) => {
                  const isSelected = documentType === value;
                  return (
                    <Pressable
                      key={value}
                      style={[
                        styles.typeCard,
                        isSelected && styles.typeCardSelected,
                      ]}
                      onPress={() => handleDocumentTypeChange(value)}
                      disabled={submitKycMutation.isPending}
                    >
                      <Ionicons
                        name={value === 'CNI' ? 'card-outline' : 'book-outline'}
                        size={22}
                        color={isSelected ? '#FFFFFF' : '#1A6B3C'}
                      />
                      <Text
                        style={[
                          styles.typeCardTitle,
                          isSelected && styles.typeCardTitleSelected,
                        ]}
                      >
                        {value === 'CNI'
                          ? t('kyc.documentTypeCni')
                          : t('kyc.documentTypePassport')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {getErrorMessage(errors.documentType?.message) ? (
                <ErrorBanner message={getErrorMessage(errors.documentType?.message) ?? ''} />
              ) : null}
            </View>

            {documentType ? (
              <>
                <View style={styles.section}>
                  <KycDocumentPicker
                    step="front"
                    label={t('kyc.frontSectionTitle')}
                    hint={
                      documentType === 'CNI'
                        ? t('kyc.frontSectionHintCni')
                        : t('kyc.frontSectionHintPassport')
                    }
                    document={frontDoc}
                    errorMessage={getErrorMessage(errors.front?.message)}
                    disabled={submitKycMutation.isPending}
                    onDocumentChange={(document) =>
                      handleDocumentChange('front', document)
                    }
                  />
                </View>

                {needsBackDocument(documentType) ? (
                  <View style={styles.section}>
                    <KycDocumentPicker
                      step="back"
                      label={t('kyc.backSectionTitle')}
                      hint={t('kyc.backSectionHint')}
                      document={backDoc}
                      errorMessage={getErrorMessage(errors.back?.message)}
                      disabled={submitKycMutation.isPending}
                      onDocumentChange={(document) =>
                        handleDocumentChange('back', document)
                      }
                    />
                  </View>
                ) : null}

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('kyc.selfieSectionTitle')}</Text>
                  <Text style={styles.sectionHint}>{t('kyc.selfieSectionHint')}</Text>
                  <KycSelfieCamera
                    document={selfieDoc}
                    errorMessage={getErrorMessage(errors.selfie?.message)}
                    disabled={submitKycMutation.isPending}
                    onDocumentChange={(document) =>
                      handleDocumentChange('selfie', document)
                    }
                  />
                </View>

                <View style={styles.submitCard}>
                  <Text style={styles.submitTitle}>{t('kyc.recapTitle')}</Text>
                  <Text style={styles.submitText}>
                    {documentType === 'CNI'
                      ? t('kyc.submitHintCni')
                      : t('kyc.submitHintPassport')}
                  </Text>
                  {submitKycMutation.isPending ? (
                    <KycUploadProgress
                      progress={uploadProgress}
                      statusText={t('kyc.uploading')}
                    />
                  ) : null}
                  <Pressable
                    style={[
                      styles.submitButton,
                      submitKycMutation.isPending && styles.submitButtonDisabled,
                    ]}
                    onPress={() => void handleSubmit(onValidSubmit, onInvalidSubmit)()}
                    disabled={submitKycMutation.isPending}
                  >
                    <Text style={styles.submitButtonText}>
                      {t('kyc.submitVerification')}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={styles.sectionPlaceholder}>
                <Ionicons name="information-circle-outline" size={20} color="#B45309" />
                <Text style={styles.sectionPlaceholderText}>
                  {t('kyc.chooseTypeFirst')}
                </Text>
              </View>
            )}
          </>
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
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 20,
  },
  heroCard: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 8,
  },
  heroText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#6B7280',
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusCard: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  statusCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 8,
  },
  statusCardText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#6B7280',
    marginBottom: 16,
  },
  section: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 6,
  },
  sectionHint: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
    marginBottom: 14,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  typeCard: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1A6B3C',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    gap: 10,
  },
  typeCardSelected: {
    backgroundColor: '#1A6B3C',
  },
  typeCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A6B3C',
  },
  typeCardTitleSelected: {
    color: '#FFFFFF',
  },
  sectionPlaceholder: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  sectionPlaceholderText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#B45309',
  },
  submitCard: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  submitTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 8,
  },
  submitText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
    marginBottom: 16,
  },
  submitButton: {
    marginTop: 16,
    paddingVertical: 14,
    backgroundColor: '#1A6B3C',
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryCta: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1A6B3C',
    backgroundColor: '#FFFFFF',
  },
  secondaryCtaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A6B3C',
  },
});
