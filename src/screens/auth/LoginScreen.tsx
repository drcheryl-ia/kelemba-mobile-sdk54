import React, { useState, useEffect, useCallback } from 'react';
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import type { AuthStackParamList } from '@/navigation/types';
import { navigationRef } from '@/navigation/navigationRef';
import { colors } from '@/theme/colors';
import { useAuth } from '@/hooks/useAuth';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { useApiError } from '@/hooks/useApiError';
import { login, loginWithRefreshToken } from '@/api/authApi';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

const PIN_LENGTH = 6;

const loginSchema = z.object({
  phone: z
    .string()
    .min(8, 'Numéro invalide')
    .regex(/^[0-9\s]+$/, 'Chiffres uniquement'),
  pin: z
    .string()
    .length(PIN_LENGTH, `PIN à ${PIN_LENGTH} chiffres`)
    .regex(/^[0-9]+$/, 'Chiffres uniquement'),
});

type LoginFormData = z.infer<typeof loginSchema>;

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const BIOMETRIC_ICON_MAP = {
  faceid: 'scan-outline' as const,
  fingerprint: 'finger-print' as const,
  iris: 'eye-outline' as const,
  none: 'finger-print' as const,
};

const BIOMETRIC_LABEL_MAP = {
  faceid: 'auth.biometricFaceId',
  fingerprint: 'auth.biometricFingerprint',
  iris: 'auth.biometricIris',
  none: 'auth.biometric',
} as const;

export const LoginScreenComponent: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const { setAuth } = useAuth();
  const { errorMessage, errorSeverity, handleError, clearError } = useApiError();
  const {
    isAvailable: bioAvailable,
    isEnrolled: bioEnrolled,
    biometricType,
    authenticate,
    isAuthenticating: bioAuthenticating,
    error: bioError,
    resetError,
  } = useBiometricAuth();

  const [showPin, setShowPin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentLang, setCurrentLang] = useState<'fr' | 'sango'>(() =>
    i18n.language === 'sango' ? 'sango' : 'fr'
  );

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '', pin: '' },
  });

  useEffect(() => {
    setCurrentLang(i18n.language === 'sango' ? 'sango' : 'fr');
  }, [i18n.language]);

  useEffect(() => {
    if (!bioError) return;
    const timer = setTimeout(() => {
      resetError();
    }, 3000);
    return () => clearTimeout(timer);
  }, [bioError, resetError]);

  const toggleLanguage = useCallback(() => {
    const next = i18n.language === 'fr' ? 'sango' : 'fr';
    i18n.changeLanguage(next);
    setCurrentLang(next);
  }, [i18n]);

  const onSubmit = async (data: LoginFormData) => {
    clearError();
    setIsSubmitting(true);
    try {
      const { user, accessToken, refreshToken } = await login(data.phone, data.pin);
      setAuth({ user, accessToken, refreshToken });
      if (navigationRef.isReady()) {
        const nextRoute = user.kycStatus === 'VERIFIED' ? 'MainTabs' : 'KycStack';
        navigationRef.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: nextRoute }] })
        );
      }
    } catch (err: unknown) {
      handleError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBiometricLogin = async () => {
    const success = await authenticate();
    if (!success) return;
    clearError();
    setIsSubmitting(true);
    try {
      const { user, accessToken, refreshToken } = await loginWithRefreshToken();
      setAuth({ user, accessToken, refreshToken });
      if (navigationRef.isReady()) {
        const nextRoute = user.kycStatus === 'VERIFIED' ? 'MainTabs' : 'KycStack';
        navigationRef.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: nextRoute }] })
        );
      }
    } catch (err: unknown) {
      handleError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const showBiometric = bioAvailable && bioEnrolled;
  const biometricIcon = BIOMETRIC_ICON_MAP[biometricType];
  const biometricLabelKey = BIOMETRIC_LABEL_MAP[biometricType];
  const isBiometricDisabled = bioAuthenticating || isSubmitting;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Ionicons name="wallet-outline" size={32} color={colors.white} />
          </View>
          <Text style={styles.title}>KELEMBA</Text>
          <Text style={styles.tagline}>{t('app.taglineBilingual')}</Text>
        </View>

        <View style={styles.form}>
          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.field}>
                <Text style={styles.label}>{t('auth.phone')}</Text>
                <View style={styles.inputRow}>
                  <Ionicons
                    name="call-outline"
                    size={20}
                    color={colors.grayTagline}
                    style={styles.inputIcon}
                  />
                  <Text style={styles.indicatif}>+236</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="00 00 00 00"
                    placeholderTextColor={colors.gray[500]}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType="phone-pad"
                  />
                </View>
                {errors.phone && (
                  <Text style={styles.errorText}>{errors.phone.message}</Text>
                )}
              </View>
            )}
          />

          <Controller
            control={control}
            name="pin"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.field}>
                <Text style={styles.label}>{t('auth.pin')}</Text>
                <View style={styles.inputRow}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={colors.grayTagline}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, styles.inputFlex]}
                    placeholder={t('auth.pinPlaceholder')}
                    placeholderTextColor={colors.gray[500]}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry={!showPin}
                    keyboardType="number-pad"
                    maxLength={PIN_LENGTH}
                  />
                  <Pressable
                    onPress={() => setShowPin(!showPin)}
                    style={styles.eyeButton}
                    hitSlop={12}
                  >
                    <Ionicons
                      name={showPin ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.grayTagline}
                    />
                  </Pressable>
                </View>
                {errors.pin && (
                  <Text style={styles.errorText}>{errors.pin.message}</Text>
                )}
              </View>
            )}
          />

          {errorMessage && (
            <ErrorBanner
              message={errorMessage}
              severity={errorSeverity ?? 'error'}
              onDismiss={clearError}
            />
          )}

          <Pressable
            onPress={() => navigation.navigate('ForgotPin')}
            style={styles.forgotLink}
          >
            <Text style={styles.forgotText}>{t('auth.forgotPassword')}</Text>
          </Pressable>

          <Pressable
            onPress={handleSubmit(onSubmit)}
            style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel={t('auth.loginButton')}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.primaryButtonText}>{t('auth.loginButton')}</Text>
            )}
          </Pressable>

          {showBiometric && (
            <>
              <View style={styles.separator}>
                <View style={styles.separatorLine} />
                <Text style={styles.separatorText}>{t('auth.or')}</Text>
                <View style={styles.separatorLine} />
              </View>

              <Pressable
                onPress={handleBiometricLogin}
                style={[
                  styles.biometricButton,
                  isBiometricDisabled && styles.biometricButtonDisabled,
                ]}
                disabled={isBiometricDisabled}
                accessibilityRole="button"
                accessibilityLabel={t(biometricLabelKey)}
              >
                {isBiometricDisabled ? (
                  <ActivityIndicator size="small" color="#1A6B3C" />
                ) : (
                  <>
                    <Ionicons
                      name={biometricIcon}
                      size={24}
                      color="#1A6B3C"
                    />
                    <Text style={styles.biometricButtonText}>
                      {t(biometricLabelKey)}
                    </Text>
                  </>
                )}
              </Pressable>

              {bioError && (
                <Text style={styles.bioErrorText}>{bioError}</Text>
              )}
            </>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('auth.noAccount')} </Text>
          <Pressable
            onPress={() => navigation.navigate('Register')}
            hitSlop={8}
            style={styles.footerLinkPressable}
          >
            <Text style={styles.footerLink}>{t('auth.createAccount')}</Text>
          </Pressable>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.languageBadgeWrapper}>
        <Pressable
          onPress={toggleLanguage}
          style={styles.languageBadge}
          accessibilityRole="button"
          accessibilityLabel="Changer de langue"
        >
          <Text style={styles.languageBadgeText}>
            {currentLang === 'fr' ? 'FR | Sango' : 'Sango | FR'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 100,
    paddingTop: 24,
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 0,
    width: '100%',
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.primary,
    fontWeight: '900',
    fontSize: 28,
    letterSpacing: 3,
    marginTop: 16,
  },
  tagline: {
    color: colors.grayTagline,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  form: {
    marginTop: 32,
    width: '100%',
  },
  field: {
    marginBottom: 16,
  },
  label: {
    color: colors.grayTagline,
    fontSize: 14,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  indicatif: {
    color: colors.grayTagline,
    fontSize: 14,
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.black,
    paddingVertical: 12,
  },
  inputFlex: {
    paddingLeft: 0,
  },
  eyeButton: {
    padding: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 4,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    minHeight: 48,
    justifyContent: 'center',
  },
  forgotText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gray[300],
  },
  separatorText: {
    color: colors.grayTagline,
    fontSize: 13,
    marginHorizontal: 16,
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#1A6B3C',
    borderRadius: 14,
    height: 56,
    minHeight: 48,
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  biometricButtonDisabled: {
    opacity: 0.6,
  },
  biometricButtonText: {
    color: '#1A6B3C',
    fontSize: 16,
    fontWeight: '700',
  },
  bioErrorText: {
    color: '#D0021B',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
    flexWrap: 'wrap',
    width: '100%',
  },
  footerText: {
    color: colors.grayTagline,
    fontSize: 14,
  },
  footerLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  footerLinkPressable: {
    minHeight: 48,
    justifyContent: 'center',
  },
  languageBadgeWrapper: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  languageBadge: {
    borderWidth: 1.5,
    borderColor: '#1A6B3C',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  languageBadgeText: {
    color: '#1A6B3C',
    fontSize: 13,
    fontWeight: '600',
  },
});
