import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/api/errors/ApiError';
import { ERROR_MESSAGES } from '@/api/errors/errorMessages';
import { ApiErrorCode } from '@/api/errors/errorCodes';

interface UseApiErrorReturn {
  errorMessage: string | null;
  errorSeverity: 'error' | 'warning' | 'info' | null;
  handleError: (err: unknown) => void;
  clearError: () => void;
}

export function useApiError(): UseApiErrorReturn {
  const { i18n } = useTranslation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorSeverity, setErrorSeverity] = useState<
    'error' | 'warning' | 'info' | null
  >(null);

  const handleError = useCallback(
    (err: unknown) => {
      const code = ApiError.isApiError(err) ? err.code : ApiErrorCode.UNKNOWN;
      const msgObj = ERROR_MESSAGES[code] ?? ERROR_MESSAGES[ApiErrorCode.UNKNOWN];
      const lang = i18n.language === 'sango' ? 'sango' : 'fr';

      setErrorMessage(msgObj[lang]);
      setErrorSeverity(msgObj.severity);
    },
    [i18n.language]
  );

  const clearError = useCallback(() => {
    setErrorMessage(null);
    setErrorSeverity(null);
  }, []);

  return { errorMessage, errorSeverity, handleError, clearError };
}
