import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sendOtp, verifyOtp, register } from '@/api/authApi';
import type { SendOtpResponse } from '@/api/authApi';
import { parseApiError } from '@/api/errors/errorHandler';
import { ApiErrorCode } from '@/api/errors/errorCodes';
import { ERROR_MESSAGES } from '@/api/errors/errorMessages';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/utils/logger';

export interface RegisterFormState {
  firstName: string;
  lastName: string;
  phone: string;
  avatarUri: string | null;
  pin: string;
  otp: string;
  accountType: 'MEMBRE' | 'ORGANISATEUR';
  invitationTontineUid: string | null;
}

export interface RegisterThenSendOtpResult {
  success: boolean;
  otpResponse?: SendOtpResponse;
}

export interface UseRegisterFormReturn {
  formState: RegisterFormState;
  updateField: <K extends keyof RegisterFormState>(
    key: K,
    value: RegisterFormState[K]
  ) => void;
  sendOtpRequest: (phoneOverride?: string) => Promise<boolean>;
  registerThenSendOtp: (step2Data: { pin: string }) => Promise<RegisterThenSendOtpResult>;
  verifyOtpAndRegister: () => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
  errorCode: ApiErrorCode | null;
  resetError: () => void;
}

const initialState: RegisterFormState = {
  firstName: '',
  lastName: '',
  phone: '',
  avatarUri: null,
  pin: '',
  otp: '',
  accountType: 'MEMBRE',
  invitationTontineUid: null,
};

export function useRegisterForm(): UseRegisterFormReturn {
  const { setAuth } = useAuth();
  const { i18n } = useTranslation();
  const [formState, setFormState] = useState<RegisterFormState>(initialState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<ApiErrorCode | null>(null);

  const updateField = useCallback(
    <K extends keyof RegisterFormState>(key: K, value: RegisterFormState[K]) => {
      setFormState((prev) => ({ ...prev, [key]: value }));
      setError(null);
      setErrorCode(null);
    },
    []
  );

  const resetError = useCallback(() => {
    setError(null);
    setErrorCode(null);
  }, []);

  const sendOtpRequest = useCallback(
    async (phoneOverride?: string): Promise<boolean> => {
      setError(null);
      setErrorCode(null);
      setIsLoading(true);
      try {
        const phone = (phoneOverride ?? formState.phone).replace(/\s/g, '');
        const fullPhone = phone.startsWith('236') ? `+${phone}` : `+236${phone}`;
        await sendOtp(fullPhone);
        return true;
      } catch (err: unknown) {
        const apiErr = parseApiError(err);
        const msgObj = ERROR_MESSAGES[apiErr.code] ?? ERROR_MESSAGES[ApiErrorCode.UNKNOWN];
        const lang = i18n.language === 'sango' ? 'sango' : 'fr';
        setError(msgObj[lang]);
        setErrorCode(apiErr.code);
        logger.error('sendOtp failed');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [formState.phone, i18n.language]
  );

  const registerThenSendOtp = useCallback(
    async (step2Data: { pin: string }): Promise<RegisterThenSendOtpResult> => {
      setError(null);
      setErrorCode(null);
      setIsLoading(true);
      try {
        const phone = formState.phone.replace(/\s/g, '');
        const fullPhone = phone.startsWith('236') ? `+${phone}` : `+236${phone}`;

        const fullName = `${formState.firstName.trim()} ${formState.lastName.trim()}`.trim();
        if (fullName.length < 2) {
          setError('Le nom complet doit contenir au moins 2 caractères.');
          return { success: false };
        }
        if (fullName.length > 150) {
          setError('Le nom complet ne doit pas dépasser 150 caractères.');
          return { success: false };
        }

        const payload: {
          phone: string;
          fullName: string;
          pin: string;
          accountType: 'MEMBRE' | 'ORGANISATEUR';
          invitationTontineUid?: string;
        } = {
          phone: fullPhone,
          fullName,
          pin: step2Data.pin,
          accountType: formState.accountType,
          ...(formState.invitationTontineUid
            ? { invitationTontineUid: formState.invitationTontineUid }
            : {}),
        };

        const response = await register(payload);
        // setAuth uniquement si le backend retourne user + tokens (201 peut être minimal)
        if (
          response.user &&
          typeof response.accessToken === 'string' &&
          typeof response.refreshToken === 'string'
        ) {
          setAuth({
            user: response.user,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
          });
        }

        const otpResponse = await sendOtp(fullPhone);
        return { success: true, otpResponse };
      } catch (err: unknown) {
        const apiErr = parseApiError(err);
        if (apiErr.code === ApiErrorCode.PHONE_ALREADY_USED) {
          const msgObj = ERROR_MESSAGES[ApiErrorCode.PHONE_ALREADY_USED];
          const lang = i18n.language === 'sango' ? 'sango' : 'fr';
          setError(msgObj[lang]);
          setErrorCode(apiErr.code);
        } else {
          const msgObj = ERROR_MESSAGES[apiErr.code] ?? ERROR_MESSAGES[ApiErrorCode.UNKNOWN];
          const lang = i18n.language === 'sango' ? 'sango' : 'fr';
          setError(msgObj[lang]);
          setErrorCode(apiErr.code);
        }
        logger.error('registerThenSendOtp failed');
        return { success: false };
      } finally {
        setIsLoading(false);
      }
    },
    [formState, setAuth, i18n.language]
  );

  const verifyOtpAndRegister = useCallback(async (): Promise<boolean> => {
    setError(null);
    setErrorCode(null);
    setIsLoading(true);
    try {
      const phone = formState.phone.replace(/\s/g, '');
      const fullPhone = phone.startsWith('236') ? `+${phone}` : `+236${phone}`;
      await verifyOtp(fullPhone, formState.otp);
      const fullName = `${formState.firstName.trim()} ${formState.lastName.trim()}`.trim();
      if (fullName.length < 2) {
        setError('Le nom complet doit contenir au moins 2 caractères.');
        return false;
      }
      if (fullName.length > 150) {
        setError('Le nom complet ne doit pas dépasser 150 caractères.');
        return false;
      }

      const payload: {
        phone: string;
        fullName: string;
        pin: string;
        accountType: 'MEMBRE' | 'ORGANISATEUR';
        invitationTontineUid?: string;
      } = {
        phone: fullPhone,
        fullName,
        pin: formState.pin,
        accountType: formState.accountType,
        ...(formState.invitationTontineUid
          ? { invitationTontineUid: formState.invitationTontineUid }
          : {}),
      };

      const response = await register(payload);
      // setAuth uniquement si le backend retourne user + tokens
      if (
        response.user &&
        typeof response.accessToken === 'string' &&
        typeof response.refreshToken === 'string'
      ) {
        setAuth({
          user: response.user,
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
        });
        return true;
      }
      logger.error('verifyOtpAndRegister: réponse incomplète (user/tokens absents)');
      return false;
    } catch (err: unknown) {
      const apiErr = parseApiError(err);
      const msgObj = ERROR_MESSAGES[apiErr.code] ?? ERROR_MESSAGES[ApiErrorCode.UNKNOWN];
      const lang = i18n.language === 'sango' ? 'sango' : 'fr';
      setError(msgObj[lang]);
      setErrorCode(apiErr.code);
      logger.error('verifyOtpAndRegister failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [formState, setAuth, i18n.language]);

  return {
    formState,
    updateField,
    sendOtpRequest,
    registerThenSendOtp,
    verifyOtpAndRegister,
    isLoading,
    error,
    errorCode,
    resetError,
  };
}
