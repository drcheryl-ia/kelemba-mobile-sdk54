import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { navigationRef } from '@/navigation/navigationRef';
import type { AuthStackParamList } from '@/navigation/types';
import {
  StepperHeader,
  AccountTypePicker,
  InvitationInput,
  TontinePreviewCard,
} from '@/components/auth';
// AvatarPicker retiré — avatar non supporté par le RegisterDto (phase 2)
import { OtpInput } from '@/components/auth/OtpInput';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { useRegisterForm } from '@/hooks/useRegisterForm';
import { getTontinePreview } from '@/api/tontinesApi';
import { parseApiError } from '@/api/errors/errorHandler';
import { ApiErrorCode } from '@/api/errors/errorCodes';
import { ERROR_MESSAGES } from '@/api/errors/errorMessages';
import { colors } from '@/theme/colors';
import type { TontinePreview } from '@/api/types/api.types';

type Step = 0 | 1 | 2 | 3 | 4;
type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const STEPS_MEMBRE = ['INVITATION', 'IDENTITÉ', 'SÉCURITÉ', 'VÉRIFICATION'] as const;
const STEPS_ORGANISATEUR = ['IDENTITÉ', 'SÉCURITÉ', 'VÉRIFICATION'] as const;

const step1Schema = z.object({
  firstName: z.string().min(2, 'Prénom requis (min 2 caractères)').max(50),
  lastName: z.string().min(2, 'Nom requis (min 2 caractères)').max(50),
  phone: z
    .string()
    .min(8, 'Numéro invalide')
    .max(8, 'Numéro invalide')
    .regex(/^[0-9]+$/, 'Chiffres uniquement'),
});

const step2Schema = z
  .object({
    pin: z
      .string()
      .length(6, 'Le PIN doit contenir exactement 6 chiffres')
      .regex(/^\d{6}$/, 'Le PIN ne doit contenir que des chiffres'),
    confirmPin: z.string(),
  })
  .refine((d) => d.pin === d.confirmPin, {
    message: 'Les deux PIN ne correspondent pas',
    path: ['confirmPin'],
  });

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;

export const RegisterScreenComponent: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const {
    formState,
    updateField,
    sendOtpRequest,
    registerThenSendOtp,
    verifyOtpAndRegister,
    isLoading,
    error,
    errorCode,
    resetError,
  } = useRegisterForm();

  const [currentStep, setCurrentStep] = useState<Step>(0);
  const [currentLang, setCurrentLang] = useState<'fr' | 'sango'>(
    i18n.language === 'sango' ? 'sango' : 'fr'
  );
  const [secondsLeft, setSecondsLeft] = useState(90);
  const [otpError, setOtpError] = useState(false);
  const [invitationLink, setInvitationLink] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<TontinePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentLang(i18n.language === 'sango' ? 'sango' : 'fr');
  }, [i18n.language]);

  useEffect(() => {
    if (currentStep !== 4 || secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [currentStep, secondsLeft]);

  const toggleLanguage = useCallback(() => {
    const next = i18n.language === 'fr' ? 'sango' : 'fr';
    i18n.changeLanguage(next);
    setCurrentLang(next);
  }, [i18n]);

  const handleBack = useCallback(() => {
    if (currentStep === 0) {
      (navigation.getParent() as { goBack: () => void } | null)?.goBack();
    } else {
      setCurrentStep((s) => (s - 1) as Step);
      resetError();
      if (currentStep === 1) {
        setPreviewError(null);
        setPreview(null);
      }
    }
  }, [currentStep, navigation, resetError]);

  const handleSelectMember = useCallback(() => {
    updateField('accountType', 'MEMBRE');
    setCurrentStep(1);
  }, [updateField]);

  const handleSelectOrganizer = useCallback(() => {
    updateField('accountType', 'ORGANISATEUR');
    setCurrentStep(2);
  }, [updateField]);

  const handleInvitationScanned = useCallback(
    async (uid: string) => {
      setPreviewError(null);
      setPreview(null);
      setPreviewLoading(true);
      try {
        const data = await getTontinePreview(uid);
        setPreview(data);
        updateField('invitationTontineUid', uid);
      } catch (err: unknown) {
        const apiErr = parseApiError(err);
        const lang = i18n.language === 'sango' ? 'sango' : 'fr';
        if (apiErr.code === ApiErrorCode.TONTINE_NOT_FOUND) {
          setPreviewError(t('register.errorTontineNotFound'));
        } else if (
          apiErr.code === ApiErrorCode.NETWORK_ERROR ||
          apiErr.code === ApiErrorCode.TIMEOUT
        ) {
          setPreviewError(t('register.errorNetwork'));
        } else {
          const msgObj = ERROR_MESSAGES[apiErr.code] ?? ERROR_MESSAGES[ApiErrorCode.UNKNOWN];
          setPreviewError(msgObj[lang]);
        }
      } finally {
        setPreviewLoading(false);
      }
    },
    [updateField, i18n.language, t]
  );

  const handleInvitationNext = useCallback(() => {
    if (preview) {
      setCurrentStep(2);
    }
  }, [preview]);

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const maskPhone = (phone: string) => {
    if (phone.length < 2) return '+236 XX XX XX XX';
    const last2 = phone.slice(-2);
    return `+236 XX XX XX ${last2}`;
  };

  const handleStepIdentiteNext = (data: Step1Data) => {
    resetError();
    updateField('firstName', data.firstName);
    updateField('lastName', data.lastName);
    updateField('phone', data.phone);
    setCurrentStep(formState.accountType === 'MEMBRE' ? 3 : 3);
  };

  const handleStepSecuriteNext = async (data: Step2Data) => {
    resetError();
    updateField('pin', data.pin);
    const result = await registerThenSendOtp({ pin: data.pin });
    if (result.success && result.otpResponse) {
      const phone = formState.phone.replace(/\s/g, '');
      const fullPhone = phone.startsWith('236') ? `+${phone}` : `+236${phone}`;
      (navigation.getParent() as { navigate: (name: string, params?: object) => void } | null)?.navigate(
        'OtpVerification',
        {
          phone: fullPhone,
          context: 'register',
          expiresInSeconds: result.otpResponse.expiresInSeconds,
          devOtp: result.otpResponse.devOtp,
        }
      );
    }
  };

  const handleStepVerificationValidate = async () => {
    setOtpError(false);
    const success = await verifyOtpAndRegister();
    if (success) {
      if (navigationRef.isReady()) {
        navigationRef.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' }] })
        );
      }
    } else if (errorCode === 'OTP_INVALID') {
      setOtpError(true);
      updateField('otp', '');
    } else if (errorCode === 'OTP_EXPIRED') {
      setSecondsLeft(0);
    }
  };

  const getStepperProps = () => {
    if (currentStep === 0) return null;
    if (formState.accountType === 'MEMBRE') {
      const stepIndex = currentStep - 1;
      return {
        steps: STEPS_MEMBRE,
        stepIndex,
      };
    }
    const stepIndex = currentStep - 2;
    return {
      steps: STEPS_ORGANISATEUR,
      stepIndex,
    };
  };

  const handleResendOtp = async () => {
    if (secondsLeft > 0) return;
    const success = await sendOtpRequest(formState.phone);
    if (success) {
      setSecondsLeft(90);
      setOtpError(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.black} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {currentStep === 4
            ? t('register.verificationTitle')
            : t('register.createAccount')}
        </Text>
        <Pressable onPress={toggleLanguage} style={styles.langBadge} hitSlop={12}>
          <Text style={styles.langText}>
            {currentLang === 'fr' ? 'FR | Sango' : 'Sango | FR'}
          </Text>
        </Pressable>
      </View>

      {currentStep > 0 && (
        <StepperHeader
          steps={getStepperProps()?.steps}
          stepIndex={getStepperProps()?.stepIndex}
        />
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {currentStep === 0 && (
            <AccountTypePicker
              onSelectMember={handleSelectMember}
              onSelectOrganizer={handleSelectOrganizer}
            />
          )}
          {currentStep === 1 && (
            <StepInvitation
              invitationLink={invitationLink}
              setInvitationLink={setInvitationLink}
              onScanned={handleInvitationScanned}
              onNext={handleInvitationNext}
              preview={preview}
              previewLoading={previewLoading}
              previewError={previewError}
              navigation={navigation}
            />
          )}
          {currentStep === 2 && (
            <StepIdentite
              formState={{
                firstName: formState.firstName,
                lastName: formState.lastName,
                phone: formState.phone,
              }}
              updateField={updateField}
              onSubmit={handleStepIdentiteNext}
              isLoading={isLoading}
              error={error}
              onDismissError={resetError}
              navigation={navigation}
            />
          )}
          {currentStep === 3 && (
            <StepSecurite
              formState={{ pin: formState.pin }}
              updateField={updateField}
              onSubmit={handleStepSecuriteNext}
              onBack={() => setCurrentStep(2)}
              isLoading={isLoading}
              error={error}
              onDismissError={resetError}
              navigation={navigation}
            />
          )}
          {currentStep === 4 && (
            <StepVerification
              formState={formState}
              updateField={updateField}
              onSubmit={handleStepVerificationValidate}
              onBack={() => setCurrentStep(2)}
              onResendOtp={handleResendOtp}
              isLoading={isLoading}
              error={error}
              resetError={resetError}
              secondsLeft={secondsLeft}
              formatTimer={formatTimer}
              maskPhone={maskPhone}
              otpError={otpError}
              setOtpError={setOtpError}
              navigation={navigation}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

interface StepInvitationProps {
  invitationLink: string;
  setInvitationLink: (v: string) => void;
  onScanned: (uid: string) => void;
  onNext: () => void;
  preview: TontinePreview | null;
  previewLoading: boolean;
  previewError: string | null;
  navigation: Props['navigation'];
}

const StepInvitation: React.FC<StepInvitationProps> = ({
  invitationLink,
  setInvitationLink,
  onScanned,
  onNext,
  preview,
  previewLoading,
  previewError,
  navigation,
}) => {
  const { t } = useTranslation();
  return (
    <View style={styles.stepContent}>
      <Text style={styles.invitationTitle}>{t('register.invitationTitle')}</Text>
      <InvitationInput
        value={invitationLink}
        onChangeText={setInvitationLink}
        onScanned={onScanned}
        isLoading={previewLoading}
        error={previewError}
      />
      {previewLoading && (
        <View style={styles.previewLoading}>
          <ActivityIndicator size="large" color="#1A6B3C" />
          <Text style={styles.previewLoadingText}>{t('register.previewLoading')}</Text>
        </View>
      )}
      {preview && !previewLoading && (
        <TontinePreviewCard preview={preview} />
      )}
      <View style={styles.buttonRow}>
        <Pressable
          onPress={() => navigation.getParent()?.goBack()}
          style={styles.secondaryButton}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryButtonText}>{t('register.back')}</Text>
        </Pressable>
        {preview && !previewLoading && (
          <Pressable
            onPress={onNext}
            style={[styles.primaryButton, styles.buttonFlex]}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>{t('register.next')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

interface StepIdentiteProps {
  formState: { firstName: string; lastName: string; phone: string };
  updateField: <K extends keyof import('@/hooks/useRegisterForm').RegisterFormState>(
    k: K,
    v: import('@/hooks/useRegisterForm').RegisterFormState[K]
  ) => void;
  onSubmit: (data: Step1Data) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  onDismissError: () => void;
  navigation: Props['navigation'];
}

const StepIdentite: React.FC<StepIdentiteProps> = ({
  formState,
  updateField,
  onSubmit,
  isLoading,
  error,
  onDismissError,
  navigation,
}) => {
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      firstName: formState.firstName,
      lastName: formState.lastName,
      phone: formState.phone.replace(/\s/g, ''),
    },
  });

  return (
    <View style={styles.stepContent}>
      {/* AvatarPicker masqué — champ avatar absent du RegisterDto (phase 2) */}
      <Controller
        control={control}
        name="firstName"
        render={({ field: { onChange, onBlur, value } }) => (
          <View style={styles.field}>
            <Text style={styles.label}>Prénom *</Text>
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Ex: Jean-Pierre"
                placeholderTextColor="#9CA3AF"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="words"
              />
            </View>
            {errors.firstName && (
              <Text style={styles.errorText}>{errors.firstName.message}</Text>
            )}
          </View>
        )}
      />
      <Controller
        control={control}
        name="lastName"
        render={({ field: { onChange, onBlur, value } }) => (
          <View style={styles.field}>
            <Text style={styles.label}>Nom *</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputFull]}
                placeholder="Ex: Bokassa"
                placeholderTextColor="#9CA3AF"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="words"
              />
            </View>
            {errors.lastName && (
              <Text style={styles.errorText}>{errors.lastName.message}</Text>
            )}
          </View>
        )}
      />
      <Controller
        control={control}
        name="phone"
        render={({ field: { onChange, onBlur, value } }) => (
          <View style={styles.field}>
            <Text style={styles.label}>Téléphone *</Text>
            <View style={styles.phoneRow}>
              <View style={styles.phonePrefix}>
                <Text style={styles.phonePrefixText}>🇨🇫 +236</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder="XX XX XX XX"
                placeholderTextColor="#9CA3AF"
                value={value}
                onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, 8))}
                onBlur={onBlur}
                keyboardType="phone-pad"
                maxLength={8}
              />
            </View>
            {errors.phone && (
              <Text style={styles.errorText}>{errors.phone.message}</Text>
            )}
          </View>
        )}
      />
      {error && (
        <ErrorBanner
          message={error}
          severity="error"
          onDismiss={onDismissError}
        />
      )}
      <View style={styles.securityNote}>
        <Ionicons name="lock-closed" size={14} color="#9CA3AF" />
        <Text style={styles.securityNoteText}>{t('register.dataProtected')}</Text>
      </View>
      <View style={styles.buttonRow}>
        <Pressable
          onPress={() => navigation.getParent()?.goBack()}
          style={styles.secondaryButton}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryButtonText}>{t('register.back')}</Text>
        </Pressable>
        <Pressable
          onPress={handleSubmit(onSubmit)}
          style={[styles.primaryButton, styles.buttonFlex, isLoading && styles.buttonDisabled]}
          disabled={isLoading}
          accessibilityRole="button"
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>{t('register.next')}</Text>
          )}
        </Pressable>
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('register.alreadyRegistered')} </Text>
        <Pressable
          onPress={() =>
            (navigation.getParent() as { navigate: (name: string) => void } | null)?.navigate(
              'Login'
            )
          }
          style={styles.footerLinkPressable}
        >
          <Text style={styles.footerLink}>{t('register.loginLink')}</Text>
        </Pressable>
      </View>
    </View>
  );
};

interface StepSecuriteProps {
  formState: { pin: string };
  updateField: <K extends keyof import('@/hooks/useRegisterForm').RegisterFormState>(
    k: K,
    v: import('@/hooks/useRegisterForm').RegisterFormState[K]
  ) => void;
  onSubmit: (data: Step2Data) => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
  error: string | null;
  onDismissError: () => void;
  navigation: Props['navigation'];
}

const StepSecurite: React.FC<StepSecuriteProps> = ({
  formState,
  updateField,
  onSubmit,
  onBack,
  isLoading,
  error,
  onDismissError,
}) => {
  const { t } = useTranslation();
  const [showPin, setShowPin] = useState(false);
  const [showPinConfirm, setShowPinConfirm] = useState(false);

  const {
    control,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      pin: formState.pin,
      confirmPin: '',
    },
  });

  const pin = watch('pin');
  const pinConfirm = watch('confirmPin');

  return (
    <View style={styles.stepContent}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>🔒</Text>
          <Text style={styles.sectionTitle}>PIN à 6 chiffres</Text>
        </View>
        <Text style={styles.sectionSubtitle}>
          Ce code sécurise votre compte et vos paiements.
        </Text>
        <Controller
          control={control}
          name="pin"
          render={({ field: { onChange, value } }) => (
            <View style={styles.field}>
              <View style={styles.pinInputWrapper}>
                <TextInput
                  placeholder="● ● ● ● ● ●"
                  placeholderTextColor="#BBB"
                  keyboardType="number-pad"
                  secureTextEntry={!showPin}
                  maxLength={6}
                  value={value}
                  onChangeText={(val) => {
                    if (/^\d*$/.test(val)) onChange(val);
                  }}
                  style={styles.pinInput}
                />
                <Pressable onPress={() => setShowPin(!showPin)} style={styles.eyeBtn}>
                  <Ionicons
                    name={showPin ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#888"
                  />
                </Pressable>
              </View>
              {errors.pin && (
                <Text style={styles.errorText}>{errors.pin.message}</Text>
              )}
            </View>
          )}
        />
        <Controller
          control={control}
          name="confirmPin"
          render={({ field: { onChange, value } }) => (
            <View style={styles.field}>
              <View
                style={[
                  styles.pinInputWrapper,
                  pinConfirm.length === 6 && pinConfirm !== pin && styles.pinInputError,
                ]}
              >
                <TextInput
                  placeholder="Confirmer le PIN"
                  placeholderTextColor="#BBB"
                  keyboardType="number-pad"
                  secureTextEntry={!showPinConfirm}
                  maxLength={6}
                  value={value}
                  onChangeText={(val) => {
                    if (/^\d*$/.test(val)) onChange(val);
                  }}
                  style={styles.pinInput}
                />
                <Pressable
                  onPress={() => setShowPinConfirm(!showPinConfirm)}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showPinConfirm ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#888"
                  />
                </Pressable>
              </View>
              {pinConfirm.length === 6 && pinConfirm !== pin ? (
                <Text style={styles.errorText}>Les deux PIN ne correspondent pas.</Text>
              ) : null}
              {errors.confirmPin && (
                <Text style={styles.errorText}>{errors.confirmPin.message}</Text>
              )}
            </View>
          )}
        />
      </View>
      {error && (
        <ErrorBanner
          message={error}
          severity="error"
          onDismiss={onDismissError}
        />
      )}
      <View style={styles.buttonRow}>
        <Pressable
          onPress={onBack}
          style={styles.secondaryButton}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryButtonText}>{t('register.back')}</Text>
        </Pressable>
        <Pressable
          onPress={handleSubmit(onSubmit)}
          style={[styles.primaryButton, styles.buttonFlex, isLoading && styles.buttonDisabled]}
          disabled={isLoading}
          accessibilityRole="button"
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>{t('register.next')}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
};

interface StepVerificationProps {
  formState: { phone: string; otp: string };
  updateField: <K extends keyof import('@/hooks/useRegisterForm').RegisterFormState>(
    k: K,
    v: import('@/hooks/useRegisterForm').RegisterFormState[K]
  ) => void;
  onSubmit: () => Promise<void>;
  onBack: () => void;
  onResendOtp: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  resetError: () => void;
  secondsLeft: number;
  formatTimer: (s: number) => string;
  maskPhone: (p: string) => string;
  otpError: boolean;
  setOtpError: (v: boolean) => void;
  navigation: Props['navigation'];
}

const StepVerification: React.FC<StepVerificationProps> = ({
  formState,
  updateField,
  onSubmit,
  onBack,
  onResendOtp,
  isLoading,
  error,
  resetError,
  secondsLeft,
  formatTimer,
  maskPhone,
  otpError,
  setOtpError,
}) => {
  const { t } = useTranslation();
  const isOtpComplete = formState.otp.length === 6;

  return (
    <View style={[styles.stepContent, styles.verificationBg]}>
      <View style={styles.phoneIconCircle}>
        <Ionicons
          name="phone-portrait-outline"
          size={36}
          color="#1A6B3C"
        />
      </View>
      <Text style={styles.verifyTitle}>{t('register.verifyNumber')}</Text>
      <Text style={styles.verifySubtitle}>
        {t('register.codeSentTo')} {maskPhone(formState.phone.replace(/\s/g, ''))}
      </Text>
      <OtpInput
        value={formState.otp}
        onChange={(v) => {
          updateField('otp', v);
          setOtpError(false);
        }}
        hasError={otpError}
      />
      {(otpError || error) && (
        <ErrorBanner
          message={error ?? t('register.errors.otpInvalid')}
          severity="error"
          onDismiss={() => {
            setOtpError(false);
            resetError();
            updateField('otp', '');
          }}
        />
      )}
      <View style={styles.timerSection}>
        {secondsLeft > 0 ? (
          <Pressable style={styles.timerButton} disabled>
            <Text style={styles.timerText}>
              🕐 {t('register.resendIn')} {formatTimer(secondsLeft)}
            </Text>
          </Pressable>
        ) : (
          <Pressable onPress={onResendOtp} style={styles.resendLink}>
            <Text style={styles.resendLinkText}>{t('register.resendCode')}</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.helpText}>
        {t('register.helpText')} /{'\n'}
        <Text style={styles.helpTextItalic}>{t('register.helpTextSango')}</Text>
      </Text>
      <Pressable
        onPress={onSubmit}
        style={[
          styles.primaryButton,
          (!isOtpComplete || isLoading) && styles.buttonDisabled,
        ]}
        disabled={!isOtpComplete || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonText}>{t('register.validate')}</Text>
        )}
      </Pressable>
      <Pressable onPress={onBack} style={styles.changeNumberLink}>
        <Text style={styles.changeNumberText}>{t('register.changeNumber')}</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  backButton: {
    padding: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.black,
    flex: 1,
    textAlign: 'center',
  },
  langBadge: {
    padding: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  langText: {
    fontSize: 13,
    color: '#1A6B3C',
    fontWeight: '600',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  stepContent: {
    width: '100%',
    alignItems: 'center',
  },
  verificationBg: {
    backgroundColor: '#F0F4F0',
    borderRadius: 16,
    padding: 24,
  },
  field: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    minHeight: 56,
    paddingHorizontal: 12,
    width: '100%',
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.black,
    paddingVertical: 12,
  },
  inputFull: {
    paddingLeft: 12,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  phonePrefix: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 56,
    justifyContent: 'center',
  },
  phonePrefixText: {
    fontSize: 16,
    color: colors.black,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 56,
    fontSize: 16,
    color: colors.black,
  },
  eyeButton: {
    padding: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  errorText: {
    color: '#D0021B',
    fontSize: 12,
    marginTop: 4,
  },
  otpErrorText: {
    color: '#D0021B',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  strengthBar: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
    alignSelf: 'center',
  },
  securityNoteText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontStyle: 'italic',
  },
  section: {
    width: '100%',
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  sectionIcon: {
    fontSize: 24,
  },
  pinIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinIcon: {
    fontSize: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.black,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#888',
    marginBottom: 12,
    lineHeight: 18,
  },
  pinInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F8FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DDD',
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 12,
  },
  pinInput: {
    flex: 1,
    fontSize: 18,
    color: '#1A1A2E',
    letterSpacing: 6,
  },
  pinInputError: {
    borderColor: '#D0021B',
  },
  eyeBtn: {
    padding: 8,
    minWidth: 36,
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    width: '100%',
    marginVertical: 24,
  },
  // backLink et backLinkText supprimés — remplacés par secondaryButton/buttonRow
  primaryButton: {
    backgroundColor: '#1A6B3C',
    borderRadius: 14,
    minHeight: 56,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    flexWrap: 'wrap',
  },
  footerText: {
    color: '#6B7280',
    fontSize: 14,
  },
  footerLink: {
    color: '#1A6B3C',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  footerLinkPressable: {
    minHeight: 48,
    justifyContent: 'center',
  },
  phoneIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F0EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  verifyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 8,
    textAlign: 'center',
  },
  verifySubtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  timerSection: {
    marginVertical: 16,
    alignItems: 'center',
  },
  timerButton: {
    minHeight: 48,
    justifyContent: 'center',
  },
  timerText: {
    color: '#F5A623',
    fontSize: 14,
    fontWeight: '600',
  },
  resendLink: {
    minHeight: 48,
    justifyContent: 'center',
  },
  resendLinkText: {
    color: '#1A6B3C',
    fontSize: 14,
    fontWeight: '600',
  },
  helpText: {
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
  },
  helpTextItalic: {
    fontStyle: 'italic',
  },
  changeNumberLink: {
    marginTop: 16,
    minHeight: 48,
    justifyContent: 'center',
  },
  changeNumberText: {
    color: '#1A6B3C',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    marginTop: 24,
    paddingBottom: 16,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonFlex: {
    flex: 2,
  },
  invitationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 16,
    textAlign: 'center',
  },
  previewLoading: {
    marginTop: 24,
    alignItems: 'center',
    gap: 12,
  },
  previewLoadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
});
