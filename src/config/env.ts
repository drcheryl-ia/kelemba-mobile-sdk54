/**
 * Validation des variables d'environnement au démarrage.
 * Plante explicitement si une variable critique est manquante.
 * Aucun secret backend (ORANGE_MONEY_API_KEY, etc.) — jamais dans le code mobile.
 */
function requireEnv(key: string): string {
  const value =
    typeof process !== 'undefined' ? process.env[key] : undefined;
  if (!value || value.trim() === '') {
    throw new Error(
      `[Kelemba Config] Variable d'environnement manquante : ${key}\n` +
        `Vérifiez votre fichier .env.local (copie de .env.example).`
    );
  }
  return value.trim();
}

function optionalEnv(key: string, defaultValue: string): string {
  const value =
    typeof process !== 'undefined' ? process.env[key] : undefined;
  return value?.trim() ?? defaultValue;
}

function boolEnv(key: string, defaultValue = false): boolean {
  const value =
    typeof process !== 'undefined' ? process.env[key] : undefined;
  const val = value?.trim().toLowerCase();
  if (val === 'true') return true;
  if (val === 'false') return false;
  return defaultValue;
}

function intEnv(key: string, defaultValue: number): number {
  const value =
    typeof process !== 'undefined' ? process.env[key] : undefined;
  const parsed = parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

const rawApiUrl = requireEnv('EXPO_PUBLIC_API_URL');

export const ENV = {
  // API — normaliser : retirer /v1 final et slash trailing pour éviter double /v1 dans endpoints
  API_URL: rawApiUrl.replace(/\/v1\/?$/, '').replace(/\/$/, ''),
  API_TIMEOUT_MS: intEnv('EXPO_PUBLIC_API_TIMEOUT_MS', 15000),
  API_VERSION: optionalEnv('EXPO_PUBLIC_API_VERSION', 'v1'),

  // App
  APP_NAME: optionalEnv('EXPO_PUBLIC_APP_NAME', 'Kelemba'),
  APP_VERSION: optionalEnv('EXPO_PUBLIC_APP_VERSION', '1.0.0'),
  APP_ENV: optionalEnv('EXPO_PUBLIC_APP_ENV', 'development'),
  DEFAULT_LANG: optionalEnv('EXPO_PUBLIC_DEFAULT_LANG', 'fr'),
  COUNTRY_CODE: optionalEnv('EXPO_PUBLIC_COUNTRY_CODE', '+236'),
  CURRENCY: optionalEnv('EXPO_PUBLIC_CURRENCY', 'FCFA'),

  // Sécurité
  PIN_LENGTH: intEnv('EXPO_PUBLIC_PIN_LENGTH', 6),
  MAX_LOGIN_ATTEMPTS: intEnv('EXPO_PUBLIC_MAX_LOGIN_ATTEMPTS', 5),
  OTP_TTL_SECONDS: intEnv('EXPO_PUBLIC_OTP_TTL_SECONDS', 90),
  SESSION_TIMEOUT_MS: intEnv('EXPO_PUBLIC_SESSION_TIMEOUT_MS', 900000),

  // Règles métier
  MIN_CONTRIBUTION_FCFA: intEnv('EXPO_PUBLIC_MIN_CONTRIBUTION_FCFA', 500),
  MAX_MEMBERS_PER_TONTINE: intEnv(
    'EXPO_PUBLIC_MAX_MEMBERS_PER_TONTINE',
    50
  ),

  // Paiements — URLs publiques (optionnelles en dev)
  ORANGE_MONEY_BASE_URL: optionalEnv(
    'EXPO_PUBLIC_ORANGE_MONEY_BASE_URL',
    'https://api.orange.com/orange-money-webpay/dev/v1'
  ),
  ORANGE_MONEY_MERCHANT_ID: optionalEnv(
    'EXPO_PUBLIC_ORANGE_MONEY_MERCHANT_ID',
    ''
  ),
  TELECEL_BASE_URL: optionalEnv(
    'EXPO_PUBLIC_TELECEL_MONEY_BASE_URL',
    'https://api.telecel.cf/money/v1'
  ),
  TELECEL_MERCHANT_ID: optionalEnv(
    'EXPO_PUBLIC_TELECEL_MERCHANT_ID',
    ''
  ),

  // Firebase — optionnel en dev
  FIREBASE_PROJECT_ID: optionalEnv(
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    'kelemba-digital'
  ),
  FIREBASE_APP_ID: optionalEnv(
    'EXPO_PUBLIC_FIREBASE_APP_ID',
    '1:000000000000:android:0000000000000000'
  ),
  FIREBASE_SENDER_ID: optionalEnv(
    'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    '000000000000'
  ),
  FIREBASE_API_KEY: optionalEnv(
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    ''
  ),
  FIREBASE_AUTH_DOMAIN: optionalEnv(
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'kelemba-digital.firebaseapp.com'
  ),
  FIREBASE_STORAGE_BUCKET: optionalEnv(
    'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'kelemba-digital.appspot.com'
  ),

  // Feature Flags
  FEATURE_BIOMETRIC: boolEnv('EXPO_PUBLIC_FEATURE_BIOMETRIC', true),
  FEATURE_OFFLINE_MODE: boolEnv('EXPO_PUBLIC_FEATURE_OFFLINE_MODE', true),
  FEATURE_KYC_ENABLED: boolEnv('EXPO_PUBLIC_FEATURE_KYC_ENABLED', true),
  FEATURE_CHAT_ENABLED: boolEnv('EXPO_PUBLIC_FEATURE_CHAT_ENABLED', false),

  // Monitoring
  SENTRY_DSN: optionalEnv('EXPO_PUBLIC_SENTRY_DSN', ''),
  SENTRY_ENV: optionalEnv('EXPO_PUBLIC_SENTRY_ENV', 'development'),

  // SecureStore Keys
  SECURE_KEY_ACCESS_TOKEN: optionalEnv(
    'EXPO_PUBLIC_SECURE_KEY_ACCESS_TOKEN',
    'kelemba_access_token'
  ),
  SECURE_KEY_REFRESH_TOKEN: optionalEnv(
    'EXPO_PUBLIC_SECURE_KEY_REFRESH_TOKEN',
    'kelemba_refresh_token'
  ),
  SECURE_KEY_PIN: optionalEnv(
    'EXPO_PUBLIC_SECURE_KEY_PIN',
    'kelemba_payment_pin'
  ),
  SECURE_KEY_BIOMETRIC: optionalEnv(
    'EXPO_PUBLIC_SECURE_KEY_BIOMETRIC',
    'kelemba_biometric_enabled'
  ),
  SECURE_KEY_PIN_HASH: optionalEnv(
    'EXPO_PUBLIC_SECURE_KEY_PIN_HASH',
    'kelemba_pin_hash'
  ),
  SECURE_KEY_USER_ID: optionalEnv(
    'EXPO_PUBLIC_SECURE_KEY_USER_ID',
    'kelemba_user_id'
  ),
  SECURE_KEY_FCM_TOKEN: optionalEnv(
    'EXPO_PUBLIC_SECURE_KEY_FCM_TOKEN',
    'fcm_token'
  ),
  SECURE_KEY_ACCOUNT_TYPE: optionalEnv(
    'EXPO_PUBLIC_SECURE_KEY_ACCOUNT_TYPE',
    'kelemba_account_type'
  ),

  // Helpers
  IS_DEV:
    optionalEnv('EXPO_PUBLIC_APP_ENV', 'development') === 'development',
  IS_PRODUCTION:
    optionalEnv('EXPO_PUBLIC_APP_ENV', 'development') === 'production',
} as const;
