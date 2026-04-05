import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  StatusBar,
  Dimensions,
  Animated,
  Linking,
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
import { COLORS } from '@/theme/colors';
import { useAuth } from '@/hooks/useAuth';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { login, loginWithRefreshToken } from '@/api/authApi';
import { ApiError } from '@/api/errors/ApiError';
import { PinInput } from '@/components/auth/PinInput';

const PIN_LENGTH = 6;
const { height: SCREEN_H } = Dimensions.get('window');
const HERO_MIN = Math.round(SCREEN_H * 0.32);

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

const BIOMETRIC_LABEL_MAP = {
  faceid: 'auth.biometricFaceId',
  fingerprint: 'auth.biometricFingerprint',
  iris: 'auth.biometricIris',
  none: 'auth.biometric',
} as const;

function LoginHero(): React.ReactElement {
  const padTop =
    Platform.OS === 'android'
      ? (StatusBar.currentHeight ?? 0) + 24
      : 44;

  return (
    <View style={[styles.hero, { paddingTop: padTop }]}>
      <View style={styles.logoRing}>
        <Text style={styles.logoK}>K</Text>
      </View>
      <Text style={styles.heroTitle}>Kelemba</Text>
      <Text style={styles.heroTagline}>
        Votre tontine numérique · Tontine na yângâ
      </Text>
    </View>
  );
}

export const LoginScreenComponent: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const { setAuth } = useAuth();
  const {
    isAvailable: bioAvailable,
    isEnrolled: bioEnrolled,
    biometricType,
    authenticate,
    isAuthenticating: bioAuthenticating,
    error: bioError,
    resetError,
  } = useBiometricAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentLang, setCurrentLang] = useState<'fr' | 'sango'>(() =>
    i18n.language === 'sango' ? 'sango' : 'fr'
  );
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [forbiddenMessage, setForbiddenMessage] = useState<string | null>(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '', pin: '' },
  });

  const pinValue = watch('pin');

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

  const runShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8,  duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 40, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const toggleLanguage = useCallback(() => {
    const next = i18n.language === 'fr' ? 'sango' : 'fr';
    i18n.changeLanguage(next);
    setCurrentLang(next);
  }, [i18n]);

  const onSubmit = async (data: LoginFormData) => {
    setPinMessage(null);
    setForbiddenMessage(null);
    setPinError(false);
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
      if (ApiError.isApiError(err) && err.httpStatus === 401) {
        setPinError(true);
        setPinMessage('Numéro ou PIN incorrect');
        runShake();
        setValue('pin', '');
        return;
      }
      if (ApiError.isApiError(err) && err.httpStatus === 403) {
        setForbiddenMessage(
          'Compte suspendu ou banni. Contactez support@kelemba.com pour assistance.'
        );
        return;
      }
      setPinMessage(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBiometricLogin = async () => {
    const success = await authenticate();
    if (!success) return;
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
    } catch {
      setPinMessage('Échec de la connexion biométrique');
    } finally {
      setIsSubmitting(false);
    }
  };

  const showBiometric = bioAvailable && bioEnrolled;
  const biometricLabelKey = BIOMETRIC_LABEL_MAP[biometricType];
  const isBiometricDisabled = bioAuthenticating || isSubmitting;

  const phoneOk = (v: string) => v.replace(/\s/g, '').length >= 8;
  const canSubmit =
    phoneOk(watch('phone')) && pinValue.length === PIN_LENGTH && !isSubmitting;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.heroWrap}>
          <LoginHero />
        </View>
        <ScrollView
          style={styles.formScroll}
          contentContainerStyle={styles.formScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.formTitle}>Connexion</Text>
          <Text style={styles.formSubtitle}>
            Entrez votre numéro et votre code PIN
          </Text>

          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.field}>
                <Text style={styles.label}>Numéro de téléphone</Text>
                <View
                  style={[
                    styles.phoneRow,
                    phoneFocused && styles.phoneRowFocused,
                  ]}
                >
                  <View style={styles.prefixPill}>
                    <Text style={styles.prefixText}>+236</Text>
                  </View>
                  <View style={styles.phoneSep} />
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="7X XXX XXX"
                    placeholderTextColor={COLORS.gray500}
                    value={value}
                    onChangeText={onChange}
                    onBlur={() => {
                      onBlur();
                      setPhoneFocused(false);
                    }}
                    onFocus={() => setPhoneFocused(true)}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    accessibilityLabel="Numéro de téléphone"
                  />
                </View>
                {errors.phone ? (
                  <Text style={styles.fieldErr}>{errors.phone.message}</Text>
                ) : null}
              </View>
            )}
          />

          <Text style={styles.label}>Code PIN (6 chiffres)</Text>
          <Animated.View
            style={{ transform: [{ translateX: shakeAnim }] }}
          >
            <Controller
              control={control}
              name="pin"
              render={({ field: { onChange, value } }) => (
                <PinInput
                  value={value}
                  onChange={(v) => {
                    onChange(v);
                    setPinError(false);
                    setPinMessage(null);
                  }}
                  masked
                  error={pinError}
                  accessibilityLabel="Code PIN à 6 chiffres"
                  accessibilityHint="Appuyez sur les cases pour saisir"
                />
              )}
            />
          </Animated.View>
          {pinMessage != null && pinMessage !== '' ? (
            <Text style={styles.pinErr}>{pinMessage}</Text>
          ) : null}
          {forbiddenMessage != null ? (
            <Pressable
              onPress={() => void Linking.openURL('mailto:support@kelemba.com')}
              accessibilityRole="link"
            >
              <Text style={styles.forbidden}>{forbiddenMessage}</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={handleSubmit(onSubmit)}
            style={({ pressed }) => [
              styles.btnMain,
              (!canSubmit || isSubmitting) && styles.btnDisabled,
              pressed && canSubmit && !isSubmitting && { transform: [{ scale: 0.97 }] },
            ]}
            disabled={!canSubmit || isSubmitting}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit || isSubmitting }}
            accessibilityLabel={t('auth.loginButton')}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.btnMainText}>Se connecter</Text>
            )}
          </Pressable>

          {showBiometric ? (
            <>
              <View style={styles.sepRow}>
                <View style={styles.sepLine} />
                <Text style={styles.sepText}>ou</Text>
                <View style={styles.sepLine} />
              </View>
              <Pressable
                onPress={handleBiometricLogin}
                style={[
                  styles.btnSec,
                  isBiometricDisabled && styles.btnSecDisabled,
                ]}
                disabled={isBiometricDisabled}
                accessibilityRole="button"
                accessibilityLabel={t(biometricLabelKey)}
              >
                {isBiometricDisabled ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={COLORS.primary}
                    />
                    <Text style={styles.btnSecText}>
                      {t('auth.biometric', 'Biométrie / Empreinte')}
                    </Text>
                  </>
                )}
              </Pressable>
            </>
          ) : null}

          {bioError ? <Text style={styles.bioErr}>{bioError}</Text> : null}

          <View style={styles.links}>
            <Pressable
              onPress={() => navigation.navigate('AccountTypeChoice')}
              accessibilityRole="button"
            >
              <Text style={styles.linkText}>
                Pas encore de compte ?{' '}
                <Text style={styles.linkBold}>Créer un compte</Text>
              </Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('ForgotPin')}
              style={styles.forgotWrap}
              accessibilityRole="button"
            >
              <Text style={styles.linkMuted}>Code PIN oublié ?</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.langWrap}>
        <Pressable
          onPress={toggleLanguage}
          style={styles.langBadge}
          accessibilityRole="button"
          accessibilityLabel="Changer de langue"
        >
          <Text style={styles.langText}>
            {currentLang === 'fr' ? 'FR | Sango' : 'Sango | FR'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  flex1: {
    flex: 1,
  },
  heroWrap: {
    minHeight: HERO_MIN,
    backgroundColor: COLORS.primary,
  },
  hero: {
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 64,
    paddingBottom: 20,
  },
  logoRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoK: {
    fontSize: 28,
    fontWeight: '500',
    color: COLORS.white,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '500',
    color: COLORS.white,
    marginBottom: 4,
  },
  heroTagline: {
    fontSize: 12,
    color: 'rgba(255,255,255,.75)',
    textAlign: 'center',
  },
  formScroll: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  formScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 100,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 13,
    color: COLORS.gray500,
    marginBottom: 20,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.gray500,
    marginBottom: 6,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    backgroundColor: COLORS.gray100,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  phoneRowFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  prefixPill: {
    backgroundColor: '#1A6B3C15',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  prefixText: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.primaryDark,
  },
  phoneSep: {
    width: 1,
    height: 16,
    backgroundColor: COLORS.gray200,
    marginHorizontal: 8,
  },
  phoneInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
    padding: 0,
  },
  fieldErr: {
    fontSize: 12,
    color: COLORS.dangerText,
    marginTop: 4,
  },
  pinErr: {
    fontSize: 12,
    color: COLORS.dangerText,
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 8,
  },
  forbidden: {
    fontSize: 12,
    color: COLORS.dangerText,
    textAlign: 'center',
    marginBottom: 8,
    textDecorationLine: 'underline',
  },
  btnMain: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 8,
    shadowColor: '#1A6B3C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: {
    backgroundColor: '#A8C5B0',
    opacity: 0.7,
    shadowColor: 'transparent',
    elevation: 0,
  },
  btnMainText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  sepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  sepLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.gray200,
  },
  sepText: {
    marginHorizontal: 12,
    fontSize: 13,
    color: COLORS.gray500,
  },
  btnSec: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 48,
  },
  btnSecDisabled: {
    opacity: 0.6,
  },
  btnSecText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  bioErr: {
    color: COLORS.dangerText,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  links: {
    marginTop: 24,
    marginBottom: 24,
    gap: 12,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    color: COLORS.gray500,
    textAlign: 'center',
  },
  linkBold: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  linkMuted: {
    fontSize: 14,
    color: COLORS.gray500,
    textAlign: 'center',
  },
  forgotWrap: {
    minHeight: 44,
    justifyContent: 'center',
  },
  langWrap: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  langBadge: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: COLORS.white,
  },
  langText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});
