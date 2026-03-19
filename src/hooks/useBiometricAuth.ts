/**
 * Stub useBiometricAuth — biométrie désactivée après retrait de expo-local-authentication.
 * Retourne toujours isAvailable: false pour compatibilité Expo Go.
 */
import { useCallback, useState } from 'react';

export type BiometricType = 'faceid' | 'fingerprint' | 'iris' | 'none';

export interface UseBiometricAuthReturn {
  isAvailable: boolean;
  biometricType: BiometricType;
  isEnrolled: boolean;
  authenticate: () => Promise<boolean>;
  isAuthenticating: boolean;
  error: string | null;
  resetError: () => void;
}

export function useBiometricAuth(): UseBiometricAuthReturn {
  const [error, setError] = useState<string | null>(null);

  const authenticate = useCallback(async (): Promise<boolean> => {
    return false;
  }, []);

  const resetError = useCallback(() => setError(null), []);

  return {
    isAvailable: false,
    biometricType: 'none',
    isEnrolled: false,
    authenticate,
    isAuthenticating: false,
    error,
    resetError,
  };
}
