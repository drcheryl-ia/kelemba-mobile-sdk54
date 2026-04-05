import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Alert,
  Image,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { CommonActions, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import * as ImageManipulator from 'expo-image-manipulator';
import Svg, { Path } from 'react-native-svg';
import type { AuthStackParamList } from '@/navigation/types';
import { navigationRef } from '@/navigation/navigationRef';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';
import { PinInput } from '@/components/auth/PinInput';
import {
  ensureSessionAfterRegister,
  register,
  sendOtp,
  verifyOtp,
  type RegisterResponse,
  type SendOtpResponse,
} from '@/api/authApi';
import { ApiError } from '@/api/errors/ApiError';
import { ApiErrorCode } from '@/api/errors/errorCodes';
import { createJoinRequest } from '@/api/tontinesApi';
import { submitKycDocuments } from '@/api/kycApi';
import { parseApiError } from '@/api/errors/errorHandler';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/utils/logger';
import type { UserProfileResponseDto } from '@/types/user.types';
import type { KycDocument, KycDocumentType } from '@/types/kyc.types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;
type RegisterScreenRouteProp = RouteProp<AuthStackParamList, 'Register'>;

type FormValues = {
  phone: string;
  otp: string;
  fullName: string;
  pin: string;
  pinConfirm: string;
  documentType: KycDocumentType;
};

const organisateurFieldsSchema = z.object({
  fullName: z.string().min(2).max(150),
  phone: z.string().min(8).max(9),
  pin: z.string().length(6).regex(/^\d{6}$/),
  pinConfirm: z.string().length(6),
  otp: z.string().length(6),
  documentType: z.enum(['CNI', 'PASSPORT']),
});

const organisateurPinMatchRefine = {
  message: 'Les codes PIN ne correspondent pas',
  path: ['pinConfirm'] as const,
} as const;

const organisateurSchema = organisateurFieldsSchema.refine(
  (d) => d.pin === d.pinConfirm,
  organisateurPinMatchRefine
);

/** Étape 0 org : `.pick()` ne peut pas s’appliquer après `.refine()` sur l’objet (Zod). */
const organisateurStep0Schema = organisateurFieldsSchema
  .pick({
    fullName: true,
    phone: true,
    pin: true,
    pinConfirm: true,
    documentType: true,
  })
  .refine((d) => d.pin === d.pinConfirm, organisateurPinMatchRefine);

/** Clé d’idempotence = UUID v4 (exigence API). Repli si `crypto.randomUUID` indisponible. */
function newIdempotencyKey(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function fullPhone236(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (d.startsWith('236')) return `+${d}`;
  return `+236${d}`;
}

function extractErrMessage(err: unknown): string {
  const api = parseApiError(err);
  return api.message || 'Erreur inconnue';
}

/** Masque les chiffres sauf les 4 derniers (numéro E.164 ou avec espaces). */
function maskPhoneForOtpDisplay(fullPhone: string): string {
  const t = fullPhone.trim();
  if (t.length < 5) return t;
  return t.slice(0, -4).replace(/\d/g, 'X') + t.slice(-4);
}

function isOtpVerifyFailure(err: unknown): boolean {
  if (!ApiError.isApiError(err)) return false;
  if (err.httpStatus === 401) return true;
  return (
    err.code === ApiErrorCode.OTP_INVALID ||
    err.code === ApiErrorCode.OTP_EXPIRED ||
    err.code === ApiErrorCode.OTP_MAX_ATTEMPTS_EXCEEDED
  );
}

function RegisterHeader({
  mode,
  currentStep,
  tontineName,
  onBack,
}: {
  mode: 'MEMBRE' | 'ORGANISATEUR';
  currentStep: number;
  tontineName?: string | null;
  onBack: () => void;
}): React.ReactElement {
  const title =
    mode === 'MEMBRE' ? 'Créer un compte Membre' : 'Compte Organisatrice';
  const stepsMembre = ['Votre numéro', 'Vérification et inscription'];
  const stepsOrg = ['Vos infos', 'Vérification SMS', 'Identité KYC'];
  const totalSteps = mode === 'MEMBRE' ? 2 : 3;
  const steps = mode === 'MEMBRE' ? stepsMembre : stepsOrg;
  const label = steps[currentStep] ?? '';

  return (
    <View style={rh.wrap}>
      <View style={rh.row}>
        <Pressable
          onPress={onBack}
          style={rh.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </Pressable>
        <Text style={rh.title}>{title}</Text>
      </View>
      <View style={rh.segRow}>
        {Array.from({ length: totalSteps }, (_, i) => i).map((i) => {
          const completed = i < currentStep;
          const active = i === currentStep;
          return (
            <View
              key={i}
              style={[
                rh.seg,
                completed && { backgroundColor: '#F5A623' },
                active && !completed && { backgroundColor: 'rgba(255,255,255,0.8)' },
                !active && !completed && {
                  backgroundColor: 'rgba(255,255,255,0.25)',
                },
              ]}
            />
          );
        })}
      </View>
      <Text style={rh.stepLabel}>
        Étape {currentStep + 1} sur {totalSteps} — {label}
      </Text>
      {mode === 'MEMBRE' && tontineName ? (
        <View style={rh.encartMembre}>
          <IconPeopleSmall />
          <Text style={rh.encartMembreText}>
            Vous rejoignez : {tontineName}
          </Text>
        </View>
      ) : null}
      {mode === 'ORGANISATEUR' ? (
        <View style={rh.encartOrg}>
          <View style={rh.orgLine}>
            <Ionicons name="checkmark-circle" size={16} color="rgba(255,255,255,0.9)" />
            <Text style={rh.encartOrgText}>
              KYC identité obligatoire (CNI ou passeport)
            </Text>
          </View>
          <View style={rh.orgLine}>
            <Ionicons name="checkmark-circle" size={16} color="rgba(255,255,255,0.9)" />
            <Text style={rh.encartOrgText}>
              Score Kelemba de départ : 500 pts
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function IconPeopleSmall(): React.ReactElement {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke="rgba(255,255,255,0.8)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconShieldSmall(): React.ReactElement {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        stroke="#854F0B"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const rh = StyleSheet.create({
  wrap: {
    backgroundColor: '#1A6B3C',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.white,
  },
  segRow: { flexDirection: 'row', gap: 3, marginBottom: 6 },
  seg: { flex: 1, height: 4, borderRadius: 2 },
  stepLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  encartMembre: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  encartMembreText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.white,
  },
  encartOrg: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
    gap: 6,
  },
  orgLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  encartOrgText: {
    flex: 1,
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 15,
  },
});

async function uriToKycDocument(
  uri: string,
  step: KycDocument['step']
): Promise<KycDocument> {
  let finalUri = uri;
  let mimeType = 'image/jpeg';
  try {
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
    );
    finalUri = manipulated.uri;
    mimeType = 'image/jpeg';
  } catch {
    // fallback uri brut
  }
  return {
    step,
    uri: finalUri,
    mimeType,
    fileName: `${step}.jpg`,
    fileSize: 0,
  };
}

function goHomeAfterAuth(kycStatus?: string): void {
  if (!navigationRef.isReady()) return;
  const kycOk = kycStatus === 'VERIFIED';
  navigationRef.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: kycOk ? 'MainTabs' : 'KycStack' }],
    })
  );
}

export const RegisterScreenComponent: React.FC<Props> = ({ navigation }) => {
  const { params } = useRoute<RegisterScreenRouteProp>();
  const mode = params?.mode ?? 'MEMBRE';
  const tontineUid = params?.tontineUid;
  const tontineName = params?.tontineName;

  const { i18n } = useTranslation();
  const { setAuth } = useAuth();
  const queryClient = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);
  const otpShakeX = useRef(new Animated.Value(0)).current;
  const [currentStep, setCurrentStep] = useState(0);
  const [otpSentMembre, setOtpSentMembre] = useState(false);
  const [otpSentOrg, setOtpSentOrg] = useState(false);
  const [resendCount, setResendCount] = useState(0);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);
  const [devOtpFallback, setDevOtpFallback] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [orgOtpVerified, setOrgOtpVerified] = useState(false);
  const [orgOtpInlineError, setOrgOtpInlineError] = useState<string | null>(null);
  const [membreOtpError, setMembreOtpError] = useState<string | null>(null);
  const [membreFieldErrors, setMembreFieldErrors] = useState<{
    fullName?: string;
    pin?: string;
    pinConfirm?: string;
  }>({});
  const [docFront, setDocFront] = useState<string | null>(null);
  const [docBack, setDocBack] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [currentLang, setCurrentLang] = useState<'fr' | 'sango'>(() =>
    i18n.language === 'sango' ? 'sango' : 'fr'
  );

  const { control, watch, setValue, getValues } = useForm<FormValues>({
    defaultValues: {
      phone: '',
      otp: '',
      fullName: '',
      pin: '',
      pinConfirm: '',
      documentType: 'CNI',
    },
    mode: 'onChange',
  });

  const pinWatch = watch('pin');
  const pinConfirmWatch = watch('pinConfirm');
  const documentTypeWatch = watch('documentType');
  const otpWatch = watch('otp');
  const fullNameWatch = watch('fullName');

  const otpStepActive =
    (mode === 'MEMBRE' && currentStep === 1 && otpSentMembre) ||
    (mode === 'ORGANISATEUR' && currentStep === 1 && otpSentOrg);

  useEffect(() => {
    if (!otpStepActive) return;
    setCanResend(false);
    let remaining = 60;
    setCountdown(60);
    const id = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        setCountdown(0);
        setCanResend(true);
        clearInterval(id);
      } else {
        setCountdown(remaining);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [otpStepActive, resendCount]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [currentStep]);

  const runOtpShake = useCallback(() => {
    otpShakeX.setValue(0);
    Animated.sequence([
      Animated.timing(otpShakeX, {
        toValue: 8,
        duration: 45,
        useNativeDriver: true,
      }),
      Animated.timing(otpShakeX, {
        toValue: -8,
        duration: 45,
        useNativeDriver: true,
      }),
      Animated.timing(otpShakeX, {
        toValue: 5,
        duration: 45,
        useNativeDriver: true,
      }),
      Animated.timing(otpShakeX, {
        toValue: 0,
        duration: 45,
        useNativeDriver: true,
      }),
    ]).start();
  }, [otpShakeX]);

  const applySendOtpDevResult = useCallback((data: SendOtpResponse) => {
    if (!__DEV__) return;
    const code = data.otpDev;
    if (typeof code === 'string' && code.length > 0) {
      setDevOtpCode(code);
      setDevOtpFallback(false);
    } else {
      setDevOtpCode(null);
      setDevOtpFallback(true);
    }
  }, []);

  const sendOtpMut = useMutation({
    mutationFn: async (vars: { phoneDigits: string; idempotencyKey: string }) => {
      const phone = fullPhone236(vars.phoneDigits);
      return sendOtp(phone, {
        idempotencyKey: vars.idempotencyKey,
        purpose: 'REGISTER',
      });
    },
  });

  const verifyOtpMut = useMutation({
    mutationFn: async (vars: { phoneDigits: string; otp: string }) => {
      const phone = fullPhone236(vars.phoneDigits);
      return verifyOtp(phone, vars.otp);
    },
  });

  const registerMut = useMutation({
    mutationFn: register,
  });

  const toggleLanguage = useCallback(() => {
    const next = i18n.language === 'fr' ? 'sango' : 'fr';
    void i18n.changeLanguage(next);
    setCurrentLang(next === 'sango' ? 'sango' : 'fr');
  }, [i18n]);

  const handleHeaderBack = useCallback(() => {
    if (currentStep > 0) {
      if (mode === 'MEMBRE' && currentStep === 1) {
        setOtpSentMembre(false);
        setDevOtpCode(null);
        setDevOtpFallback(false);
        setMembreOtpError(null);
      }
      if (mode === 'ORGANISATEUR' && currentStep === 1) {
        setOtpSentOrg(false);
        setDevOtpCode(null);
        setDevOtpFallback(false);
        setOrgOtpInlineError(null);
      }
      setCurrentStep((s) => s - 1);
      if (mode === 'ORGANISATEUR' && currentStep === 2) {
        setOrgOtpVerified(false);
      }
      return;
    }
    navigation.goBack();
  }, [currentStep, mode, navigation]);

  const persistAuth = useCallback(
    (reg: RegisterResponse) => {
      const { user, accessToken, refreshToken } = reg;
      if (
        user &&
        typeof accessToken === 'string' &&
        accessToken &&
        typeof refreshToken === 'string' &&
        refreshToken
      ) {
        setAuth({
          user: user as unknown as UserProfileResponseDto,
          accessToken,
          refreshToken,
        });
      }
    },
    [setAuth]
  );

  const onSendOtpMembre = useCallback(() => {
    const phone = getValues('phone').replace(/\D/g, '').slice(0, 9);
    const p = z.string().min(8).max(9).safeParse(phone);
    if (!p.success) {
      Alert.alert('Numéro', 'Saisissez un numéro valide (8 chiffres).');
      return;
    }
    setValue('phone', phone);
    const key = newIdempotencyKey();
    sendOtpMut.mutate(
      { phoneDigits: phone, idempotencyKey: key },
      {
        onSuccess: (data) => {
          applySendOtpDevResult(data);
          setResendCount(0);
          setOtpSentMembre(true);
          setCurrentStep(1);
        },
        onError: (err: unknown) => {
          Alert.alert('Erreur', extractErrMessage(err));
        },
      }
    );
  }, [applySendOtpDevResult, getValues, sendOtpMut, setValue]);

  const onResendOtpMembre = useCallback(() => {
    if (!canResend) return;
    const phone = getValues('phone').replace(/\D/g, '').slice(0, 9);
    const key = newIdempotencyKey();
    sendOtpMut.mutate(
      { phoneDigits: phone, idempotencyKey: key },
      {
        onSuccess: (data) => {
          applySendOtpDevResult(data);
          setResendCount((c) => c + 1);
        },
        onError: () => {
          Alert.alert('Erreur', 'Impossible de renvoyer le SMS.');
        },
      }
    );
  }, [applySendOtpDevResult, canResend, getValues, sendOtpMut]);

  const handleRegisterMembre = useCallback(async () => {
    const v = getValues();
    const phoneDigits = v.phone.replace(/\D/g, '').slice(0, 9);
    const phone = fullPhone236(phoneDigits);
    setMembreOtpError(null);
    setMembreFieldErrors({});

    if (v.otp.length !== 6 || !/^\d{6}$/.test(v.otp)) {
      setMembreOtpError('Code à 6 chiffres requis.');
      return;
    }
    if (v.fullName.trim().length < 2) {
      setMembreFieldErrors({ fullName: 'Au moins 2 caractères.' });
      return;
    }
    if (v.pin.length !== 6 || !/^\d{6}$/.test(v.pin)) {
      setMembreFieldErrors({ pin: 'Le PIN doit comporter 6 chiffres.' });
      return;
    }
    if (v.pin !== v.pinConfirm) {
      setMembreFieldErrors({ pinConfirm: 'Les codes PIN ne correspondent pas.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await verifyOtpMut.mutateAsync({ phoneDigits, otp: v.otp });
    } catch (err: unknown) {
      setIsSubmitting(false);
      if (isOtpVerifyFailure(err)) {
        setMembreOtpError('Code incorrect ou expiré.');
        setValue('otp', '');
        runOtpShake();
        return;
      }
      Alert.alert('Vérification', extractErrMessage(err));
      return;
    }

    try {
      const registerResult = await registerMut.mutateAsync({
        phone,
        fullName: v.fullName.trim(),
        pin: v.pin,
        accountType: 'MEMBRE',
        ...(tontineUid ? { invitationTontineUid: tontineUid } : {}),
      });
      const session = await ensureSessionAfterRegister(
        registerResult,
        phone,
        v.pin
      );
      persistAuth(session);

      if (tontineUid) {
        try {
          await createJoinRequest(tontineUid, undefined, {
            acceptedTerms: true,
            signatureName: v.fullName.trim(),
            contractVersion: '1.0',
            sharesCount: 1,
          });
        } catch (joinErr: unknown) {
          logger.warn('JoinRequest failed after register', {
            message:
              joinErr instanceof Error ? joinErr.message : String(joinErr),
          });
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['tontines'] });
      const kyc = (session.user as UserProfileResponseDto | undefined)?.kycStatus;
      goHomeAfterAuth(kyc);
    } catch (err: unknown) {
      Alert.alert('Création impossible', extractErrMessage(err));
      logger.error('RegisterMembre error', {
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    getValues,
    persistAuth,
    queryClient,
    registerMut,
    runOtpShake,
    setValue,
    tontineUid,
    verifyOtpMut,
  ]);

  const onOrgStep0Next = useCallback(() => {
    const v = getValues();
    const step0 = organisateurStep0Schema.safeParse({
      fullName: v.fullName.trim(),
      phone: v.phone.replace(/\D/g, '').slice(0, 9),
      pin: v.pin,
      pinConfirm: v.pinConfirm,
      documentType: v.documentType,
    });
    if (!step0.success) {
      Alert.alert('Formulaire', step0.error.issues[0]?.message ?? 'Champs invalides');
      return;
    }
    const phoneDigits = v.phone.replace(/\D/g, '').slice(0, 9);
    const key = newIdempotencyKey();
    sendOtpMut.mutate(
      { phoneDigits, idempotencyKey: key },
      {
        onSuccess: (data) => {
          applySendOtpDevResult(data);
          setResendCount(0);
          setOtpSentOrg(true);
          setCurrentStep(1);
          setOrgOtpVerified(false);
          setOrgOtpInlineError(null);
        },
        onError: (err: unknown) => Alert.alert('Erreur', extractErrMessage(err)),
      }
    );
  }, [applySendOtpDevResult, getValues, sendOtpMut]);

  const onOrgVerifySmsContinue = useCallback(() => {
    const v = getValues();
    const phoneDigits = v.phone.replace(/\D/g, '').slice(0, 9);
    const otpParsed = z.string().length(6).safeParse(v.otp);
    if (!otpParsed.success) {
      setOrgOtpInlineError('Code à 6 chiffres requis.');
      return;
    }
    setOrgOtpInlineError(null);
    verifyOtpMut.mutate(
      { phoneDigits, otp: v.otp },
      {
        onSuccess: () => {
          setOrgOtpVerified(true);
          setCurrentStep(2);
          setOrgOtpInlineError(null);
        },
        onError: (err: unknown) => {
          if (isOtpVerifyFailure(err)) {
            setOrgOtpInlineError('Code incorrect ou expiré. Réessayez.');
            setValue('otp', '');
            runOtpShake();
            return;
          }
          Alert.alert('Vérification', extractErrMessage(err));
        },
      }
    );
  }, [getValues, runOtpShake, setValue, verifyOtpMut]);

  const onResendOrg = useCallback(() => {
    if (!canResend) return;
    const phoneDigits = getValues('phone').replace(/\D/g, '').slice(0, 9);
    const key = newIdempotencyKey();
    sendOtpMut.mutate(
      { phoneDigits, idempotencyKey: key },
      {
        onSuccess: (data) => {
          applySendOtpDevResult(data);
          setResendCount((c) => c + 1);
        },
        onError: () => {
          Alert.alert('Erreur', 'Impossible de renvoyer le SMS.');
        },
      }
    );
  }, [applySendOtpDevResult, canResend, getValues, sendOtpMut]);

  const pickImage = async (setter: (u: string | null) => void) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission', 'Accès aux photos requis.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!res.canceled && res.assets[0]?.uri) {
      setter(res.assets[0].uri);
    }
  };

  const pickSelfie = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission', 'Accès à la caméra requis pour le selfie.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!res.canceled && res.assets[0]?.uri) {
      setSelfie(res.assets[0].uri);
    }
  };

  const handleRegisterOrganisateur = useCallback(async () => {
    const v = getValues();
    if (!orgOtpVerified) {
      Alert.alert('Étape', 'Validez d’abord le code SMS.');
      return;
    }
    const parsed = organisateurSchema.safeParse({
      fullName: v.fullName.trim(),
      phone: v.phone.replace(/\D/g, '').slice(0, 9),
      pin: v.pin,
      pinConfirm: v.pinConfirm,
      otp: v.otp,
      documentType: v.documentType,
    });
    if (!parsed.success) {
      Alert.alert('Formulaire', parsed.error.issues[0]?.message ?? 'Invalide');
      return;
    }
    if (!docFront || !selfie) {
      Alert.alert('Documents', 'Recto et selfie sont obligatoires.');
      return;
    }
    if (v.documentType === 'CNI' && !docBack) {
      Alert.alert('Documents', 'Le verso CNI est obligatoire.');
      return;
    }
    const phone = fullPhone236(parsed.data.phone);
    setIsSubmitting(true);
    try {
      const registerResult = await registerMut.mutateAsync({
        phone,
        fullName: v.fullName.trim(),
        pin: v.pin,
        accountType: 'ORGANISATEUR',
      });
      const session = await ensureSessionAfterRegister(
        registerResult,
        phone,
        v.pin
      );
      persistAuth(session);

      const front = await uriToKycDocument(docFront, 'front');
      const selfieDoc = await uriToKycDocument(selfie, 'selfie');
      const back =
        v.documentType === 'CNI' && docBack
          ? await uriToKycDocument(docBack, 'back')
          : undefined;

      await submitKycDocuments({
        documentType: v.documentType,
        front,
        back: back ?? null,
        selfie: selfieDoc,
      });

      await queryClient.invalidateQueries({ queryKey: ['tontines'] });
      Alert.alert(
        'Documents envoyés',
        'Vos documents sont en cours de vérification.',
        [
          {
            text: 'OK',
            onPress: () => {
              const kyc = (session.user as UserProfileResponseDto | undefined)
                ?.kycStatus;
              goHomeAfterAuth(kyc);
            },
          },
        ]
      );
    } catch (err: unknown) {
      Alert.alert('Création impossible', extractErrMessage(err));
      logger.error('RegisterOrganisateur error', {
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    docBack,
    docFront,
    getValues,
    orgOtpVerified,
    persistAuth,
    queryClient,
    registerMut,
    selfie,
  ]);

  const phoneDigitsValid = (d: string) => d.replace(/\D/g, '').length >= 8;

  const renderMembre = () => {
    if (currentStep === 0) {
      return (
        <>
          <Text style={st.sectionTitle}>Votre numéro de téléphone</Text>
          <Text style={st.sectionSub}>
            Nous enverrons un code SMS de vérification
          </Text>
          <View
            style={[
              st.phoneRow,
              phoneFocused && st.phoneRowFocused,
            ]}
          >
            <View style={st.prefixPill}>
              <Text style={st.prefixText}>+236</Text>
            </View>
            <View style={st.phoneSep} />
            <Controller
              control={control}
              name="phone"
              render={({ field: { value, onChange } }) => (
                <TextInput
                  style={st.phoneInput}
                  placeholder="7X XXX XXX"
                  placeholderTextColor={COLORS.gray500}
                  keyboardType="phone-pad"
                  value={value}
                  onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, 9))}
                  onFocus={() => setPhoneFocused(true)}
                  onBlur={() => setPhoneFocused(false)}
                  autoComplete="tel"
                />
              )}
            />
          </View>
          <View style={st.infoBanner}>
            <Text style={st.infoBannerText}>
              Un SMS avec un code à 6 chiffres sera envoyé. Standard Orange /
              Telecel RCA.
            </Text>
          </View>
          <Pressable
            style={[
              st.btnPrimary,
              (!phoneDigitsValid(watch('phone')) || sendOtpMut.isPending) &&
                st.btnDis,
            ]}
            disabled={!phoneDigitsValid(watch('phone')) || sendOtpMut.isPending}
            onPress={onSendOtpMembre}
            accessibilityState={{
              disabled: !phoneDigitsValid(watch('phone')) || sendOtpMut.isPending,
            }}
          >
            {sendOtpMut.isPending ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={st.btnPrimaryText}>Recevoir le code SMS →</Text>
            )}
          </Pressable>
        </>
      );
    }
    if (currentStep === 1) {
      const digits = watch('phone').replace(/\D/g, '').slice(0, 9);
      const maskedLine = maskPhoneForOtpDisplay(fullPhone236(digits));
      const membreBtnDisabled =
        otpWatch.length < 6 ||
        fullNameWatch.trim().length < 2 ||
        pinWatch.length < 6 ||
        pinWatch !== pinConfirmWatch ||
        isSubmitting;
      return (
        <>
          <Text style={st.sectionTitle}>Vérification et inscription</Text>
          <Text style={st.sentToLine}>
            Code envoyé au {maskedLine}
          </Text>
          {__DEV__ && devOtpCode ? (
            <View style={st.devOtpBanner}>
              <IconShieldSmall />
              <Text style={st.devOtpBannerText}>
                <Text style={st.devOtpBannerStrong}>Mode développement</Text>
                {' — Code OTP simulé : '}
                <Text style={st.devOtpCodeMono}>{devOtpCode}</Text>
                {"\nCe bandeau n'apparaît pas en production."}
              </Text>
            </View>
          ) : null}
          {__DEV__ && devOtpFallback && !devOtpCode ? (
            <View style={st.devOtpBanner}>
              <IconShieldSmall />
              <Text style={st.devOtpBannerText}>
                <Text style={st.devOtpBannerStrong}>Mode développement</Text>
                {' — '}
                Utilisez le code reçu par SMS ou consultez les logs serveur.
              </Text>
            </View>
          ) : null}
          <Text style={st.label}>Code reçu par SMS</Text>
          <Animated.View
            style={{ transform: [{ translateX: otpShakeX }] }}
          >
            <Controller
              control={control}
              name="otp"
              render={({ field: { value, onChange } }) => (
                <PinInput
                  value={value}
                  onChange={(t) => {
                    onChange(t);
                    if (membreOtpError) setMembreOtpError(null);
                  }}
                  masked={false}
                  accessibilityLabel="Code OTP"
                />
              )}
            />
          </Animated.View>
          {membreOtpError ? (
            <Text style={st.fieldErr}>{membreOtpError}</Text>
          ) : null}
          <Pressable
            onPress={onResendOtpMembre}
            disabled={!canResend}
            style={[st.resend, !canResend && st.resendDisabled]}
          >
            <Text
              style={[
                st.resendText,
                canResend && st.resendTextActive,
                !canResend && st.resendTextMuted,
              ]}
            >
              {canResend
                ? 'Renvoyer'
                : `Renvoyer dans ${countdown}s`}
            </Text>
          </Pressable>
          <Text style={st.label}>Nom complet</Text>
          <Controller
            control={control}
            name="fullName"
            render={({ field: { value, onChange } }) => (
              <TextInput
                style={st.textField}
                placeholder="Nom et prénom"
                placeholderTextColor={COLORS.gray500}
                value={value}
                onChangeText={(t) => {
                  onChange(t);
                  if (membreFieldErrors.fullName) {
                    setMembreFieldErrors((e) => ({ ...e, fullName: undefined }));
                  }
                }}
                autoCapitalize="words"
              />
            )}
          />
          {membreFieldErrors.fullName ? (
            <Text style={st.fieldErr}>{membreFieldErrors.fullName}</Text>
          ) : null}
          <Text style={st.label}>Code PIN (6 chiffres)</Text>
          <Controller
            control={control}
            name="pin"
            render={({ field: { value, onChange } }) => (
              <PinInput
                value={value}
                onChange={(t) => {
                  onChange(t);
                  if (membreFieldErrors.pin) {
                    setMembreFieldErrors((e) => ({ ...e, pin: undefined }));
                  }
                }}
                masked
              />
            )}
          />
          {membreFieldErrors.pin ? (
            <Text style={st.fieldErr}>{membreFieldErrors.pin}</Text>
          ) : null}
          <Text style={st.label}>Confirmer le PIN</Text>
          <Controller
            control={control}
            name="pinConfirm"
            render={({ field: { value, onChange } }) => (
              <PinInput
                value={value}
                onChange={(t) => {
                  onChange(t);
                  if (membreFieldErrors.pinConfirm) {
                    setMembreFieldErrors((e) => ({ ...e, pinConfirm: undefined }));
                  }
                }}
                masked
              />
            )}
          />
          {membreFieldErrors.pinConfirm ? (
            <Text style={st.fieldErr}>{membreFieldErrors.pinConfirm}</Text>
          ) : null}
          {pinWatch &&
            pinConfirmWatch &&
            pinWatch !== pinConfirmWatch &&
            pinWatch.length === 6 &&
            pinConfirmWatch.length === 6 ? (
            <Text style={st.fieldErr}>
              Les codes PIN ne correspondent pas
            </Text>
          ) : null}
          {tontineName ? (
            <View style={st.memCard}>
              <Text style={st.memCardTitle}>
                Adhésion : {tontineName}
              </Text>
              <Text style={st.memCardBody}>
                Votre demande sera envoyée après création du compte.
                L&apos;organisatrice devra approuver votre adhésion.
              </Text>
            </View>
          ) : null}
          <Pressable
            style={[st.btnOrange, membreBtnDisabled && st.btnDis]}
            onPress={() => void handleRegisterMembre()}
            disabled={membreBtnDisabled}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#1A5C38" />
            ) : (
              <Text style={st.btnOrangeText}>Créer mon compte</Text>
            )}
          </Pressable>
        </>
      );
    }
    return null;
  };

  const renderOrg = () => {
    if (currentStep === 0) {
      return (
        <>
          <Text style={st.sectionTitle}>Vos informations</Text>
          <Text style={st.label}>Nom complet</Text>
          <Controller
            control={control}
            name="fullName"
            render={({ field: { value, onChange } }) => (
              <TextInput
                style={st.textField}
                placeholder="Nom et prénom"
                placeholderTextColor={COLORS.gray500}
                value={value}
                onChangeText={onChange}
                autoCapitalize="words"
              />
            )}
          />
          <Text style={st.label}>Téléphone</Text>
          <View style={[st.phoneRow, phoneFocused && st.phoneRowFocused]}>
            <View style={st.prefixPill}>
              <Text style={st.prefixText}>+236</Text>
            </View>
            <View style={st.phoneSep} />
            <Controller
              control={control}
              name="phone"
              render={({ field: { value, onChange } }) => (
                <TextInput
                  style={st.phoneInput}
                  placeholder="7X XXX XXX"
                  placeholderTextColor={COLORS.gray500}
                  keyboardType="phone-pad"
                  value={value}
                  onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, 9))}
                  onFocus={() => setPhoneFocused(true)}
                  onBlur={() => setPhoneFocused(false)}
                />
              )}
            />
          </View>
          <Text style={st.label}>PIN (6 chiffres)</Text>
          <Controller
            control={control}
            name="pin"
            render={({ field: { value, onChange } }) => (
              <PinInput value={value} onChange={onChange} masked />
            )}
          />
          <Text style={st.label}>Confirmer le PIN</Text>
          <Controller
            control={control}
            name="pinConfirm"
            render={({ field: { value, onChange } }) => (
              <PinInput value={value} onChange={onChange} masked />
            )}
          />
          {pinWatch &&
            pinConfirmWatch &&
            pinWatch !== pinConfirmWatch &&
            pinWatch.length === 6 &&
            pinConfirmWatch.length === 6 ? (
            <Text style={st.fieldErr}>
              Les codes PIN ne correspondent pas
            </Text>
          ) : null}
          <Pressable
            style={[
              st.btnPrimary,
              sendOtpMut.isPending && st.btnDis,
            ]}
            onPress={onOrgStep0Next}
            disabled={sendOtpMut.isPending}
          >
            {sendOtpMut.isPending ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={st.btnPrimaryText}>Recevoir le code SMS →</Text>
            )}
          </Pressable>
        </>
      );
    }
    if (currentStep === 1) {
      const orgDigits = watch('phone').replace(/\D/g, '').slice(0, 9);
      const orgMasked = maskPhoneForOtpDisplay(fullPhone236(orgDigits));
      return (
        <>
          <Text style={st.sectionTitle}>Vérification SMS</Text>
          <Text style={st.sentToLine}>
            Code envoyé au {orgMasked}
          </Text>
          {__DEV__ && devOtpCode ? (
            <View style={st.devOtpBanner}>
              <IconShieldSmall />
              <Text style={st.devOtpBannerText}>
                <Text style={st.devOtpBannerStrong}>Mode développement</Text>
                {' — Code OTP simulé : '}
                <Text style={st.devOtpCodeMono}>{devOtpCode}</Text>
                {"\nCe bandeau n'apparaît pas en production."}
              </Text>
            </View>
          ) : null}
          {__DEV__ && devOtpFallback && !devOtpCode ? (
            <View style={st.devOtpBanner}>
              <IconShieldSmall />
              <Text style={st.devOtpBannerText}>
                <Text style={st.devOtpBannerStrong}>Mode développement</Text>
                {' — '}
                Utilisez le code reçu par SMS ou consultez les logs serveur.
              </Text>
            </View>
          ) : null}
          <Animated.View style={{ transform: [{ translateX: otpShakeX }] }}>
            <Controller
              control={control}
              name="otp"
              render={({ field: { value, onChange } }) => (
                <PinInput
                  value={value}
                  onChange={(t) => {
                    onChange(t);
                    if (orgOtpInlineError) setOrgOtpInlineError(null);
                  }}
                  masked={false}
                  accessibilityLabel="Code OTP"
                />
              )}
            />
          </Animated.View>
          {orgOtpInlineError ? (
            <Text style={st.fieldErr}>{orgOtpInlineError}</Text>
          ) : null}
          <Pressable
            onPress={onResendOrg}
            disabled={!canResend}
            style={[st.resend, !canResend && st.resendDisabled]}
          >
            <Text
              style={[
                st.resendText,
                canResend && st.resendTextActive,
                !canResend && st.resendTextMuted,
              ]}
            >
              {canResend
                ? 'Renvoyer'
                : `Renvoyer dans ${countdown}s`}
            </Text>
          </Pressable>
          <Pressable
            style={[st.btnPrimary, verifyOtpMut.isPending && st.btnDis]}
            onPress={onOrgVerifySmsContinue}
            disabled={verifyOtpMut.isPending}
          >
            {verifyOtpMut.isPending ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={st.btnPrimaryText}>Vérifier et continuer</Text>
            )}
          </Pressable>
        </>
      );
    }
    return (
      <>
        <Text style={st.sectionTitle}>Vérifiez votre identité</Text>
        <Text style={st.sectionSub}>
          Requis pour créer et gérer des tontines
        </Text>
        <View style={st.docRow}>
          <Pressable
            style={[
              st.docChip,
              documentTypeWatch === 'CNI' && st.docChipOn,
            ]}
            onPress={() => setValue('documentType', 'CNI')}
          >
            <Text style={st.docChipText}>Carte Nationale d&apos;Identité</Text>
          </Pressable>
          <Pressable
            style={[
              st.docChip,
              documentTypeWatch === 'PASSPORT' && st.docChipOn,
            ]}
            onPress={() => setValue('documentType', 'PASSPORT')}
          >
            <Text style={st.docChipText}>Passeport</Text>
          </Pressable>
        </View>
        <Pressable
          style={st.btnOutline}
          onPress={() => void pickImage(setDocFront)}
        >
          <Text style={st.btnOutlineText}>
            {documentTypeWatch === 'CNI'
              ? 'Upload recto CNI'
              : 'Upload page d&apos;identité'}
          </Text>
        </Pressable>
        {docFront ? (
          <Image source={{ uri: docFront }} style={st.thumb} />
        ) : null}
        {documentTypeWatch === 'CNI' ? (
          <>
            <Pressable
              style={st.btnOutline}
              onPress={() => void pickImage(setDocBack)}
            >
              <Text style={st.btnOutlineText}>Upload verso CNI</Text>
            </Pressable>
            {docBack ? (
              <Image source={{ uri: docBack }} style={st.thumb} />
            ) : null}
          </>
        ) : null}
        <Pressable style={st.btnOutline} onPress={() => void pickSelfie()}>
          <Text style={st.btnOutlineText}>Prendre un selfie</Text>
        </Pressable>
        {selfie ? (
          <Image source={{ uri: selfie }} style={st.thumb} />
        ) : null}
        <Pressable
          style={[
            st.btnOrange,
            (isSubmitting ||
              !docFront ||
              !selfie ||
              (documentTypeWatch === 'CNI' && !docBack)) &&
              st.btnDis,
          ]}
          disabled={
            isSubmitting ||
            !docFront ||
            !selfie ||
            (documentTypeWatch === 'CNI' && !docBack)
          }
          onPress={() => void handleRegisterOrganisateur()}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#1A5C38" />
          ) : (
            <Text style={st.btnOrangeText}>Créer mon compte</Text>
          )}
        </Pressable>
      </>
    );
  };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <RegisterHeader
        mode={mode}
        currentStep={currentStep}
        tontineName={tontineName}
        onBack={handleHeaderBack}
      />
      <KeyboardAvoidingView
        style={st.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          style={st.scroll}
          contentContainerStyle={st.scrollContent}
        >
          {mode === 'MEMBRE' ? renderMembre() : renderOrg()}
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={st.langWrap}>
        <Pressable onPress={toggleLanguage} style={st.langBadge}>
          <Text style={st.langText}>
            {currentLang === 'fr' ? 'FR | Sango' : 'Sango | FR'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1A6B3C' },
  flex1: { flex: 1 },
  scroll: { flex: 1, backgroundColor: COLORS.white },
  scrollContent: { padding: 20, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 12,
    color: COLORS.gray500,
    marginBottom: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.gray500,
    marginBottom: 6,
    marginTop: 8,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    backgroundColor: COLORS.gray100,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 18,
  },
  phoneRowFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  prefixPill: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  prefixText: { fontSize: 11, fontWeight: '500', color: COLORS.primaryDark },
  phoneSep: {
    width: 1,
    height: 16,
    backgroundColor: COLORS.gray200,
    marginHorizontal: 8,
  },
  phoneInput: { flex: 1, fontSize: 13, color: COLORS.textPrimary, padding: 0 },
  infoBanner: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
    padding: 12,
    marginBottom: 16,
  },
  infoBannerText: { fontSize: 12, color: COLORS.primaryDark, lineHeight: 18 },
  btnPrimary: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  btnDis: { opacity: 0.55 },
  btnPrimaryText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
  btnOrange: {
    backgroundColor: '#F5A623',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  btnOrangeText: { color: '#1A5C38', fontSize: 14, fontWeight: '600' },
  sentToLine: {
    fontSize: 12,
    color: COLORS.gray500,
    marginBottom: 14,
    lineHeight: 18,
  },
  devOtpBanner: {
    backgroundColor: '#FFF3D4',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: '#F5A623',
  },
  devOtpBannerText: {
    fontSize: 11,
    color: '#854F0B',
    lineHeight: 18,
    flex: 1,
  },
  devOtpBannerStrong: { fontWeight: '600' },
  devOtpCodeMono: { fontWeight: '600', letterSpacing: 2 },
  resend: { alignSelf: 'center', marginVertical: 10 },
  resendDisabled: { opacity: 0.4 },
  resendText: { fontSize: 12, color: COLORS.primary },
  resendTextActive: { fontWeight: '500', color: COLORS.primary },
  resendTextMuted: { color: COLORS.gray500 },
  textField: {
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    backgroundColor: COLORS.gray100,
    marginBottom: 8,
  },
  fieldErr: { color: COLORS.dangerText, fontSize: 12, marginBottom: 4 },
  recapBox: {
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  recapLine: { fontSize: 13, color: COLORS.textPrimary, marginBottom: 6 },
  memCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  memCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primaryDark,
    marginBottom: 6,
  },
  memCardBody: { fontSize: 12, color: COLORS.primaryDark, lineHeight: 18 },
  mt: { marginTop: 8 },
  docRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  docChip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: RADIUS.sm,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
  },
  docChipOn: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  docChipText: { fontSize: 12, fontWeight: '500', color: COLORS.textPrimary, textAlign: 'center' },
  btnOutline: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  btnOutlineText: { color: COLORS.primary, fontWeight: '600' },
  thumb: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 10,
    resizeMode: 'cover',
  },
  langWrap: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  langBadge: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: COLORS.white,
  },
  langText: { color: COLORS.primary, fontWeight: '600' },
});
