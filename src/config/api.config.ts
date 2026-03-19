/**
 * Configuration Axios centralisée — baseURL, timeout, headers, endpoints.
 * baseURL inclut /api/v1 ; les chemins sont relatifs (ex. /auth/login).
 */
import { ENV } from './env';

export const API_CONFIG = {
  baseURL: ENV.API_URL,
  timeout: ENV.API_TIMEOUT_MS,
  version: ENV.API_VERSION,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-App-Version': ENV.APP_VERSION,
    'X-App-Platform': 'mobile',
  },
  endpoints: {
    // Auth
    login: '/auth/login',
    register: '/auth/register',
    sendOtp: '/auth/send-otp',
    verifyOtp: '/auth/verify-otp',
    refreshToken: '/auth/refresh',
    logout: '/auth/logout',
    me: '/auth/me',

    // KYC
    kycUpload: '/kyc/upload',
    kycStatus: '/kyc/status',

    // Tontines
    tontines: '/tontines',
    tontineById: (id: string) => `/tontines/${id}`,
    joinTontine: (id: string) => `/tontines/${id}/join`,
    tontineMembers: (id: string) => `/tontines/${id}/members`,
    rotation: (id: string) => `/tontines/${id}/rotation`,

    // Paiements
    payments: '/payments',
    paymentById: (id: string) => `/payments/${id}`,
    orangeWebhook: '/payments/webhooks/orange',
    telecelWebhook: '/payments/webhooks/telecel',

    // Score
    myScore: '/score/me',
    userScore: (id: string) => `/score/${id}`,

    // Profil
    profile: '/users/me',
    updateProfile: '/users/me',

    // Notifications
    notifications: '/notifications',
    markRead: (id: string) => `/notifications/${id}/read`,
    pushToken: '/notifications/push-token',
  },
} as const;
