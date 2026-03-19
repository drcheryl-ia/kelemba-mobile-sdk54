/**
 * Généré depuis api-contract.json — NE PAS MODIFIER MANUELLEMENT.
 *
 * Pour ajouter un endpoint :
 *   1. L'implémenter dans NestJS avec décorateurs @ApiOperation + @ApiResponse
 *   2. Exécuter : cd kelemba-backend && npm run generate:contract
 *   3. Resynchroniser ce fichier depuis le nouveau api-contract.json
 *
 * Dernière synchronisation : mars 2026
 * BASE = ENV.API_URL sans slash final (ex: http://172.20.10.5:3000/api)
 */
import { ENV } from '@/config/env';

const BASE = ENV.API_URL.replace(/\/$/, '');

export const ENDPOINTS = {
  // ── APP ───────────────────────────────────────────────────
  APP: {
    INFO: { method: 'GET' as const, url: `${BASE}/v1` },
  },

  // ── USERS ─────────────────────────────────────────────────
  USERS: {
    ME: { method: 'GET' as const, url: `${BASE}/v1/users/me` },
    NEXT_PAYMENT: {
      method: 'GET' as const,
      url: `${BASE}/v1/users/me/next-payment`,
    },
    UPGRADE_ACCOUNT: {
      method: 'PATCH' as const,
      url: `${BASE}/v1/users/me/upgrade-account`,
    },
    LOOKUP: { method: 'GET' as const, url: `${BASE}/v1/users/lookup` },
  },

  // ── AUTH ──────────────────────────────────────────────────
  AUTH: {
    LOGIN: { method: 'POST' as const, url: `${BASE}/v1/auth/login` },
    REGISTER: { method: 'POST' as const, url: `${BASE}/v1/auth/register` },
    SEND_OTP: { method: 'POST' as const, url: `${BASE}/v1/auth/send-otp` },
    VERIFY_OTP: { method: 'POST' as const, url: `${BASE}/v1/auth/verify-otp` },
    REFRESH_TOKEN: { method: 'POST' as const, url: `${BASE}/v1/auth/refresh-token` },
    LOGOUT: { method: 'POST' as const, url: `${BASE}/v1/auth/logout` },
  },

  // ── SCORE ─────────────────────────────────────────────────
  SCORE: {
    MY_SCORE: { method: 'GET' as const, url: `${BASE}/v1/score/me` },
  },

  // ── KYC ───────────────────────────────────────────────────
  KYC: {
    DOCUMENTS: { method: 'POST' as const, url: `${BASE}/v1/kyc/documents` },
    STATUS: { method: 'GET' as const, url: `${BASE}/v1/kyc/status` },
    ADMIN_APPROVE: (uid: string) => ({
      method: 'POST' as const,
      url: `${BASE}/v1/kyc/admin/${uid}/approve`,
    }),
    ADMIN_REJECT: (uid: string) => ({
      method: 'POST' as const,
      url: `${BASE}/v1/kyc/admin/${uid}/reject`,
    }),
  },

  // ── TONTINES ──────────────────────────────────────────────
  TONTINES: {
    LIST: { method: 'GET' as const, url: `${BASE}/v1/tontines` },
    MY_TONTINES: { method: 'GET' as const, url: `${BASE}/v1/tontines/me` },
    CREATE: { method: 'POST' as const, url: `${BASE}/v1/tontines` },
    BY_ID: (uid: string) => ({
      method: 'GET' as const,
      url: `${BASE}/v1/tontines/${uid}`,
    }),
    UPDATE: (uid: string) => ({
      method: 'PATCH' as const,
      url: `${BASE}/v1/tontines/${uid}`,
    }),
    DELETE: (uid: string) => ({
      method: 'DELETE' as const,
      url: `${BASE}/v1/tontines/${uid}`,
    }),
    MEMBERS_INVITE: (tontineUid: string) => ({
      method: 'POST' as const,
      url: `${BASE}/v1/tontines/${tontineUid}/members/invite`,
    }),
    MEMBERS_ACCEPT: (tontineUid: string) => ({
      method: 'POST' as const,
      url: `${BASE}/v1/tontines/${tontineUid}/members/accept`,
    }),
    MEMBERS_REJECT: (tontineUid: string) => ({
      method: 'POST' as const,
      url: `${BASE}/v1/tontines/${tontineUid}/members/reject`,
    }),
    MEMBER_APPROVE: (tontineUid: string, memberUid: string) => ({
      method: 'PATCH' as const,
      url: `${BASE}/v1/tontines/${tontineUid}/members/${memberUid}/approve`,
    }),
    MEMBER_REJECT_BY_ORGANIZER: (tontineUid: string, memberUid: string) => ({
      method: 'PATCH' as const,
      url: `${BASE}/v1/tontines/${tontineUid}/members/${memberUid}/reject`,
    }),
    MEMBERS: (tontineUid: string) => ({
      method: 'GET' as const,
      url: `${BASE}/v1/tontines/${tontineUid}/members`,
    }),
    ROTATION: (tontineUid: string) => ({
      method: 'GET' as const,
      url: `${BASE}/v1/tontines/${tontineUid}/rotation`,
    }),
    ROTATION_SHUFFLE: (tontineUid: string) => ({
      method: 'POST' as const,
      url: `${BASE}/v1/tontines/${tontineUid}/rotation/shuffle`,
    }),
    ROTATION_REORDER: (tontineUid: string) => ({
      method: 'PATCH' as const,
      url: `${BASE}/v1/tontines/${tontineUid}/rotation/reorder`,
    }),
    SWAP_REQUESTS: (tontineUid: string) => ({
      method: 'GET' as const,
      url: `${BASE}/v1/tontines/${tontineUid}/rotation/swap-requests`,
    }),
    SWAP_REQUESTS_CREATE: (tontineUid: string) => ({
      method: 'POST' as const,
      url: `${BASE}/v1/tontines/${tontineUid}/rotation/swap-requests`,
    }),
    SWAP_REQUEST_DECIDE: (tontineUid: string, requestUid: string) => ({
      method: 'PATCH' as const,
      url: `${BASE}/v1/tontines/${tontineUid}/rotation/swap-requests/${requestUid}`,
    }),
    INVITE_LINK: (tontineUid: string) => ({
      method: 'GET' as const,
      url: `${BASE}/v1/tontines/${tontineUid}/invite-link`,
    }),
    INVITATION_PREVIEW: (tontineUid: string) => ({
      method: 'GET' as const,
      url: `${BASE}/v1/tontines/invitation/${tontineUid}/preview`,
    }),
    JOIN_REQUESTS: (tontineUid: string) => ({
      method: 'POST' as const,
      url: `${BASE}/v1/tontines/${tontineUid}/join-requests`,
    }),
    /** Invitations nominatives reçues par l'utilisateur connecté (à accepter/refuser) */
    INVITATIONS_RECEIVED: {
      method: 'GET' as const,
      url: `${BASE}/v1/tontines/invitations/received`,
    },
    /** Accepter une invitation nominative — POST /v1/tontines/:tontineUid/members/accept */
    ACCEPT_INVITATION: (tontineUid: string) => ({
      method: 'POST' as const,
      url: `${BASE}/v1/tontines/${tontineUid}/members/accept`,
    }),
    /** Refuser une invitation nominative — POST /v1/tontines/:tontineUid/members/reject */
    REJECT_INVITATION: (tontineUid: string) => ({
      method: 'POST' as const,
      url: `${BASE}/v1/tontines/${tontineUid}/members/reject`,
    }),
    /** Demandes d'adhésion en attente (organisateur — join requests via lien/QR) */
    PENDING_MEMBER_REQUESTS: (tontineUid: string) => ({
      method: 'GET' as const,
      url: `${BASE}/v1/tontines/${tontineUid}/invitations/pending`,
    }),
    MEMBERS_REJECT_PENDING: (tontineUid: string, memberUid: string) => ({
      method: 'POST' as const,
      url: `${BASE}/v1/tontines/${tontineUid}/members/${memberUid}/reject`,
    }),
  },

  // ── CYCLES ────────────────────────────────────────────────
  CYCLES: {
    INITIALIZE: (tontineUid: string) => ({
      method: 'POST' as const,
      url: `${BASE}/v1/cycles/initialize/${tontineUid}`,
    }),
    CURRENT: (tontineUid: string) => ({
      method: 'GET' as const,
      url: `${BASE}/v1/cycles/current/${tontineUid}`,
    }),
    BENEFICIARY: (cycleUid: string) => ({
      method: 'GET' as const,
      url: `${BASE}/v1/cycles/${cycleUid}/beneficiary`,
    }),
    COMPLETION: (cycleUid: string) => ({
      method: 'GET' as const,
      url: `${BASE}/v1/cycles/${cycleUid}/completion`,
    }),
    PAYOUT: (cycleUid: string) => ({
      method: 'POST' as const,
      url: `${BASE}/v1/cycles/${cycleUid}/payout`,
    }),
  },

  // ── PAIEMENTS ─────────────────────────────────────────────
  PAYMENTS: {
    INITIATE: { method: 'POST' as const, url: `${BASE}/v1/payments/initiate` },
    MY_HISTORY: { method: 'GET' as const, url: `${BASE}/v1/payments/my-history` },
    STATUS: (id: string) => ({
      method: 'GET' as const,
      url: `${BASE}/v1/payments/${id}/status`,
    }),
    ORANGE_WEBHOOK: {
      method: 'POST' as const,
      url: `${BASE}/v1/payments/callbacks/orange`,
    },
    TELECEL_WEBHOOK: {
      method: 'POST' as const,
      url: `${BASE}/v1/payments/callbacks/telecel`,
    },
  },

  // ── NOTIFICATIONS ─────────────────────────────────────────
  NOTIFICATIONS: {
    REGISTER_DEVICE: {
      method: 'POST' as const,
      url: `${BASE}/v1/notifications/devices`,
    },
    UNREGISTER_DEVICE: (tokenUid: string) => ({
      method: 'DELETE' as const,
      url: `${BASE}/v1/notifications/devices/${tokenUid}`,
    }),
    UNREAD_COUNT: {
      method: 'GET' as const,
      url: `${BASE}/v1/notifications/unread-count`,
    },
    MARK_READ: (uid: string) => ({
      method: 'PATCH' as const,
      url: `${BASE}/v1/notifications/${uid}/read`,
    }),
    LIST: { method: 'GET' as const, url: `${BASE}/v1/notifications` },
  },

  // ── REPORTS ───────────────────────────────────────────────
  REPORTS: {
    TONTINE_SUMMARY: (uid: string) => ({
      method: 'GET' as const,
      url: `${BASE}/v1/reports/tontines/${uid}/summary`,
    }),
    USER_CERTIFICATE: (uid: string) => ({
      method: 'GET' as const,
      url: `${BASE}/v1/reports/users/${uid}/certificate`,
    }),
    ADMIN_TRANSACTIONS: {
      method: 'GET' as const,
      url: `${BASE}/v1/reports/admin/transactions`,
    },
    ADMIN_KPIS: {
      method: 'GET' as const,
      url: `${BASE}/v1/reports/admin/kpis`,
    },
  },

  // ── ADMIN ─────────────────────────────────────────────────
  ADMIN: {
    USERS: { method: 'GET' as const, url: `${BASE}/v1/admin/users` },
    USER_BY_ID: (uid: string) => ({
      method: 'GET' as const,
      url: `${BASE}/v1/admin/users/${uid}`,
    }),
    SUSPEND_USER: (uid: string) => ({
      method: 'PATCH' as const,
      url: `${BASE}/v1/admin/users/${uid}/suspend`,
    }),
    BAN_USER: (uid: string) => ({
      method: 'PATCH' as const,
      url: `${BASE}/v1/admin/users/${uid}/ban`,
    }),
    REHABILITATE_USER: (uid: string) => ({
      method: 'PATCH' as const,
      url: `${BASE}/v1/admin/users/${uid}/rehabilitate`,
    }),
    TONTINES: { method: 'GET' as const, url: `${BASE}/v1/admin/tontines` },
    KPIS: { method: 'GET' as const, url: `${BASE}/v1/admin/kpis` },
    AUDIT_LOGS: { method: 'GET' as const, url: `${BASE}/v1/admin/audit-logs` },
    DISPUTES_CREATE: { method: 'POST' as const, url: `${BASE}/v1/admin/disputes` },
    DISPUTE_BY_ID: (uid: string) => ({
      method: 'GET' as const,
      url: `${BASE}/v1/admin/disputes/${uid}`,
    }),
    DISPUTE_RESOLVE: (uid: string) => ({
      method: 'PATCH' as const,
      url: `${BASE}/v1/admin/disputes/${uid}/resolve`,
    }),
    DISPUTE_STATUS: (uid: string) => ({
      method: 'PATCH' as const,
      url: `${BASE}/v1/admin/disputes/${uid}/status`,
    }),
    KYC_PENDING: { method: 'GET' as const, url: `${BASE}/v1/admin/kyc/pending` },
    KYC_DOCUMENT: (userId: string, type: 'front' | 'back' | 'selfie') => ({
      method: 'GET' as const,
      url: `${BASE}/v1/admin/kyc/${userId}/document/${type}`,
    }),
    KYC_APPROVE: (userId: string) => ({
      method: 'PATCH' as const,
      url: `${BASE}/v1/admin/kyc/${userId}/approve`,
    }),
    KYC_REJECT: (userId: string) => ({
      method: 'PATCH' as const,
      url: `${BASE}/v1/admin/kyc/${userId}/reject`,
    }),
  },

  // ── HEALTH & METRICS ──────────────────────────────────────
  HEALTH: {
    CHECK: { method: 'GET' as const, url: `${BASE}/v1/health` },
  },
  METRICS: {
    PLATFORM: { method: 'GET' as const, url: `${BASE}/v1/metrics/platform` },
  },
} as const;
