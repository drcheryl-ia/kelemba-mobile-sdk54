/**
 * Écran de vérification OTP — register ou login.
 * Timer dynamique (expiresInSeconds), paste, validation auto à 6 chiffres.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  SafeAreaView,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/navigation/types';
import { navigationRef } from '@/navigation/navigationRef';
import { sendOtp, verifyOtp } from '@/api/authApi';
import { parseApiError, ApiErrorCode } from '@/api/errors';
import { logger } from '@/utils/logger';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_AFTER_RATE_LIMIT = 60;

type Props = NativeStackScreenProps<AuthStackParamList, 'OtpVerification'>;

export const OtpVerificationScreen: React.FC<Props> = ({ route, navigation }) => {
  const { phone, context, expiresInSeconds: initialExpires, devOtp: initialDevOtp } = route.params;

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [secondsLeft, setSecondsLeft] = useState(initialExpires);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devOtpCode, setDevOtpCode] = useState<string | undefined>(initialDevOtp);
  const [maxAttemptsExceeded, setMaxAttemptsExceeded] = useState(false);

  // ─── Séquence DEV auto-fill ───────────────────────────────
  const [showDevNotification, setShowDevNotification] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const notifTranslateY = useSharedValue(-120);
  const successOpacity = useSharedValue(0);
  const successScale = useSharedValue(0.8);
  const isDevSequenceActive = useRef(false);
  const handleVerifyRef = useRef<() => Promise<void>>(() => {});

  const inputRefs = useRef<(TextInput | null)[]>([]);

  const timerExpired = secondsLeft <= 0;
  const showResendButton = timerExpired || errorMessage === 'Ce code a expiré. Demandez-en un nouveau.';
  const canResend = showResendButton && resendCooldown <= 0 && !isResending;

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  useEffect(() => {
    return () => {
      setDevOtpCode(undefined);
    };
  }, []);

  // ─── Séquence DEV : notification → auto-fill → succès → login ───
  useEffect(() => {
    if (!__DEV__ || !devOtpCode || devOtpCode.length !== OTP_LENGTH) return;

    isDevSequenceActive.current = true;

    // T+4s : faire glisser la notification depuis le haut
    const t1 = setTimeout(() => {
      setShowDevNotification(true);
      notifTranslateY.value = withSpring(0, {
        damping: 18,
        stiffness: 180,
      });
    }, 4000);

    // T+6s : remonter la notification + remplir les champs
    const t2 = setTimeout(() => {
      notifTranslateY.value = withTiming(-120, {
        duration: 350,
        easing: Easing.in(Easing.ease),
      });
      setTimeout(() => setShowDevNotification(false), 360);

      // Remplissage champ par champ avec délai entre chaque
      devOtpCode.split('').forEach((char, index) => {
        setTimeout(() => {
          setDigits((prev) => {
            const next = [...prev];
            next[index] = char;
            return next;
          });
          inputRefs.current[index]?.focus();
        }, index * 120);
      });
    }, 6000);

    // T+7.8s : déclencher la vérification auto (ref pour avoir le handleVerify à jour)
    const t3 = setTimeout(() => {
      Keyboard.dismiss();
      handleVerifyRef.current();
    }, 7800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      isDevSequenceActive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devOtpCode]);

  const formatTimer = (s: number): string => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const otpValue = digits.join('');
  const allFilled = otpValue.length === OTP_LENGTH;

  const handleVerify = useCallback(async () => {
    if (!allFilled || isVerifying || maxAttemptsExceeded || timerExpired) return;
    const otp = otpValue;
    Keyboard.dismiss();
    setIsVerifying(true);
    setErrorMessage(null);
    try {
      const { verified } = await verifyOtp(phone, otp);
      if (verified) {
        if (__DEV__ && context === 'register') {
          setShowSuccessModal(true);
          successOpacity.value = withTiming(1, { duration: 400 });
          successScale.value = withSpring(1, { damping: 14, stiffness: 160 });
          setTimeout(() => {
            successOpacity.value = withTiming(0, { duration: 300 });
            setTimeout(() => {
              setShowSuccessModal(false);
              navigation.replace('Login' as never);
            }, 320);
          }, 3000);
        } else if (context === 'register') {
          navigation.replace('Login' as never);
        } else {
          if (navigationRef.isReady()) {
            navigationRef.dispatch(
              CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' }] })
            );
          }
        }
      } else {
        setErrorMessage('Code incorrect. Réessayez.');
        setDigits(Array(OTP_LENGTH).fill(''));
      }
    } catch (err: unknown) {
      const apiErr = parseApiError(err);
      if (apiErr.code === ApiErrorCode.OTP_INVALID) {
        setErrorMessage(apiErr.message);
        setDigits(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      } else if (apiErr.code === ApiErrorCode.OTP_EXPIRED) {
        setErrorMessage('Ce code a expiré. Demandez-en un nouveau.');
        setDigits(Array(OTP_LENGTH).fill(''));
      } else if (apiErr.code === ApiErrorCode.OTP_MAX_ATTEMPTS_EXCEEDED) {
        setMaxAttemptsExceeded(true);
        setDigits(Array(OTP_LENGTH).fill(''));
        Alert.alert(
          'Erreur',
          '3 tentatives épuisées. Demandez un nouveau code.',
          [{ text: 'OK' }]
        );
      } else {
        setErrorMessage(apiErr.message ?? 'Une erreur est survenue.');
      }
      logger.error('[OtpVerification] verify failed', { code: apiErr.code });
    } finally {
      setIsVerifying(false);
    }
  }, [allFilled, isVerifying, maxAttemptsExceeded, timerExpired, otpValue, phone, context, navigation]);

  useEffect(() => {
    handleVerifyRef.current = handleVerify;
  }, [handleVerify]);

  useEffect(() => {
    if (__DEV__ && isDevSequenceActive.current) return; // Séquence DEV gère la vérification
    if (allFilled && !isVerifying && !maxAttemptsExceeded && !timerExpired) {
      handleVerify();
    }
  }, [allFilled, isVerifying, maxAttemptsExceeded, timerExpired, handleVerify]);

  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      const char = value.replace(/\D/g, '').slice(-1);
      const next = [...digits];
      next[index] = char;
      setDigits(next);
      setErrorMessage(null);
      if (char && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [digits]
  );

  const handleKeyPress = useCallback(
    (index: number, key: string) => {
      if (key === 'Backspace' && !digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [digits]
  );

  const handlePaste = useCallback(
    (index: number, text: string) => {
      const cleaned = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
      if (cleaned.length === OTP_LENGTH) {
        const arr = cleaned.split('');
        setDigits(arr);
        setErrorMessage(null);
        inputRefs.current[OTP_LENGTH - 1]?.focus();
      }
    },
    []
  );

  const handleResend = useCallback(async () => {
    if (!canResend) return;
    setIsResending(true);
    setErrorMessage(null);
    setMaxAttemptsExceeded(false);
    setDigits(Array(OTP_LENGTH).fill(''));
    try {
      const res = await sendOtp(phone);
      setSecondsLeft(res.expiresInSeconds);
      if (res.devOtp) {
        setDevOtpCode(res.devOtp);
      }
    } catch (err: unknown) {
      const apiErr = parseApiError(err);
      if (apiErr.code === ApiErrorCode.OTP_RATE_LIMIT_EXCEEDED) {
        const retryAfter =
          (apiErr.details?.retryAfter as number | undefined) ?? RESEND_COOLDOWN_AFTER_RATE_LIMIT;
        setResendCooldown(retryAfter);
        setErrorMessage(`Trop de tentatives. Réessayez dans ${retryAfter} secondes.`);
      } else {
        setErrorMessage(apiErr.message ?? 'Impossible de renvoyer le code.');
      }
      logger.error('[OtpVerification] resend failed', { code: apiErr.code });
    } finally {
      setIsResending(false);
    }
  }, [canResend, phone]);

  const timerColor =
    timerExpired ? '#D0021B' : secondsLeft <= 30 ? '#F5A623' : '#1A6B3C';

  const notifAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: notifTranslateY.value }],
  }));

  const successAnimStyle = useAnimatedStyle(() => ({
    opacity: successOpacity.value,
    transform: [{ scale: successScale.value }],
  }));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Vérification</Text>
        <Text style={styles.subtitle}>
          Entrez le code à 6 chiffres envoyé au {phone}
        </Text>

        {/* devBanner supprimé — le code est transmis via la notification
            animée iOS-style (voir devNotif) */}

        <View style={styles.otpRow}>
          {Array.from({ length: OTP_LENGTH }).map((_, i) => (
            <TextInput
              key={i}
              ref={(r) => {
                inputRefs.current[i] = r;
              }}
              style={[
                styles.otpCell,
                digits[i] && styles.otpCellFilled,
                errorMessage && styles.otpCellError,
              ]}
              value={digits[i]}
              onChangeText={(v) => handleDigitChange(i, v)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
              onPaste={(e) => handlePaste(i, e.nativeEvent.text)}
              keyboardType="number-pad"
              maxLength={1}
              editable={!isVerifying && !timerExpired && !maxAttemptsExceeded}
              selectTextOnFocus
              accessibilityLabel={`Chiffre ${i + 1}`}
            />
          ))}
        </View>

        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}

        {!timerExpired ? (
          <Text style={[styles.timer, { color: timerColor }]}>
            {formatTimer(secondsLeft)}
          </Text>
        ) : (
          <Text style={[styles.timer, styles.timerExpired]}>Code expiré</Text>
        )}

        {showResendButton && (
          <Pressable
            style={[styles.resendBtn, !canResend && styles.resendBtnDisabled]}
            onPress={handleResend}
            disabled={!canResend}
            accessibilityRole="button"
            accessibilityLabel="Renvoyer le code"
          >
            {isResending ? (
              <ActivityIndicator size="small" color="#1A6B3C" />
            ) : (
              <Text
                style={[
                  styles.resendBtnText,
                  !canResend && styles.resendBtnTextDisabled,
                ]}
              >
                {resendCooldown > 0
                  ? `Renvoyer dans ${resendCooldown}s`
                  : 'Renvoyer le code'}
              </Text>
            )}
          </Pressable>
        )}
      </ScrollView>

      {/* ── Notification DEV iOS-style ── */}
      {__DEV__ && showDevNotification && devOtpCode ? (
        <Animated.View style={[styles.devNotif, notifAnimStyle]}>
          <View style={styles.devNotifIcon}>
            <Ionicons name="chatbubble-ellipses" size={22} color="#1A6B3C" />
          </View>
          <View style={styles.devNotifBody}>
            <Text style={styles.devNotifApp}>Kelemba Digital</Text>
            <Text style={styles.devNotifMessage}>
              Le code de validation est :{' '}
              <Text style={styles.devNotifCode}>{devOtpCode}</Text>
            </Text>
          </View>
        </Animated.View>
      ) : null}

      {/* ── Modal Succès création de compte ── */}
      {showSuccessModal ? (
        <Animated.View style={[styles.successOverlay, successAnimStyle]}>
          <View style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-circle" size={64} color="#1A6B3C" />
            </View>
            <Text style={styles.successTitle}>Compte créé avec succès !</Text>
            <Text style={styles.successSubtitle}>
              Bienvenue sur Kelemba Digital.{'\n'}
              Vous allez être redirigé vers la connexion…
            </Text>
            <ActivityIndicator
              size="small"
              color="#1A6B3C"
              style={{ marginTop: 16 }}
            />
          </View>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  otpCell: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#DDD',
    backgroundColor: '#FFF',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  otpCellFilled: {
    borderColor: '#1A6B3C',
  },
  otpCellError: {
    borderColor: '#D0021B',
    backgroundColor: '#FFF5F5',
  },
  timer: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
  },
  timerExpired: {
    color: '#D0021B',
  },
  errorText: {
    color: '#D0021B',
    fontSize: 13,
    textAlign: 'center',
  },
  resendBtn: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendBtnDisabled: {
    opacity: 0.6,
  },
  resendBtnText: {
    color: '#1A6B3C',
    fontSize: 14,
    fontWeight: '600',
  },
  resendBtnTextDisabled: {
    color: '#AAA',
  },
  // styles devBanner supprimés — remplacés par la notification animée
  // ── Notification DEV iOS-style ─────────────────────────────
  devNotif: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 100,
  },
  devNotifIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  devNotifBody: {
    flex: 1,
    gap: 2,
  },
  devNotifApp: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  devNotifMessage: {
    fontSize: 14,
    color: '#1A1A2E',
    lineHeight: 20,
  },
  devNotifCode: {
    fontWeight: '800',
    color: '#1A6B3C',
    letterSpacing: 4,
    fontFamily: 'monospace',
  },
  // ── Modal Succès ───────────────────────────────────────────
  successOverlay: {
    position: 'absolute',
    inset: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 36,
    alignItems: 'center',
    width: '82%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 16,
    gap: 8,
  },
  successIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A2E',
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
});
