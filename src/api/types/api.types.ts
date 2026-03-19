/**
 * Types des body et réponses — extraits de api-contract.json.
 * Généré depuis api-contract.json — NE PAS MODIFIER MANUELLEMENT
 */

// ── AUTH ──────────────────────────────────────────────────
export interface LoginDto {
  phone: string; // format: "+23675100010"
  pin: string; // 6 chiffres
}

export interface LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}

export interface RegisterDto {
  phone: string; // "+23675100010"
  fullName: string; // 2 à 150 caractères
  pin: string; // 6 chiffres
}

export interface SendOtpDto {
  phone: string;
  idempotencyKey?: string; // UUID v4 optionnel
}

export interface VerifyOtpDto {
  phone: string;
  otp: string; // 6 chiffres
}

export interface RefreshTokenDto {
  refreshToken: string;
}

// ── KYC ───────────────────────────────────────────────────
export interface KycDocumentsDto {
  front: Blob | { uri: string; type: string; name: string };
  back: Blob | { uri: string; type: string; name: string };
  selfie: Blob | { uri: string; type: string; name: string };
}

export interface RejectKycDto {
  reason: string; // 5–500 caractères
}

// ── TONTINES ──────────────────────────────────────────────
export type TontineFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export type RotationMode = 'ARRIVAL' | 'RANDOM' | 'MANUAL';

export interface CreateTontineDto {
  name: string; // 3–100 caractères
  amountPerShare: number; // min 500 FCFA
  frequency: TontineFrequency;
  startDate: string; // ISO 8601
  rotationMode: RotationMode;
  totalCycles?: number; // optionnel — dérivé des parts actives pour ROTATIVE
  rules?: Record<string, unknown>;
}

export interface UpdateTontineDto {
  name?: string;
  amountPerShare?: number;
  frequency?: TontineFrequency;
  startDate?: string;
  totalCycles?: number;
  rules?: Record<string, unknown>;
}

export interface TontineDto {
  id: string;
  uid: string;
  name: string;
  amountPerShare: number;
  totalCycles: number;
  currentCycle?: number;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  creatorId: string;
  startDate: string;
  createdAt: string;
}

export interface InviteMemberDto {
  phone: string; // "+23675100010"
  sharesCount?: number; // 1–5, défaut 1
}

/** Prévisualisation tontine (endpoint non authentifié GET /tontines/invitation/:uid/preview) */
export interface TontinePreview {
  uid: string;
  name: string;
  amountPerShare: number;
  frequency: TontineFrequency;
  totalCycles: number;
  memberCount: number;
  status: string;
}

export interface AcceptInviteDto {
  sharesCount?: number; // 1–5
}

// ── PAIEMENTS ─────────────────────────────────────────────
export type PaymentMethod = 'ORANGE_MONEY' | 'TELECEL_MONEY';

export interface InitiatePaymentDto {
  cycleUid: string;
  amount: number; // entier FCFA, min 500
  method: PaymentMethod;
  idempotencyKey: string; // UUID v4
}

export interface PaymentDto {
  id: string;
  uid?: string;
  amount: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  provider: string;
  cycleUid?: string;
  tontineName?: string;
  daysUntilDue?: number;
  dueDate?: string;
  createdAt: string;
}

// ── NOTIFICATIONS ─────────────────────────────────────────
export type DevicePlatform = 'ANDROID' | 'IOS' | 'WEB';
export type TokenProvider = 'FCM' | 'EXPO';

export interface RegisterDeviceDto {
  token: string;
  platform: DevicePlatform;
  provider?: TokenProvider;
}

// ── Enums backend ─────────────────────────────────────────
export type UserRole =
  | 'USER'
  | 'GESTIONNAIRE'
  | 'ADMIN'
  | 'SUPER_ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED';
export type KycStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'REJECTED';

export type ScoreLabel =
  | 'EXCELLENT'
  | 'BON'
  | 'MOYEN'
  | 'FAIBLE'
  | 'CRITIQUE';

export type ScoreEventReason =
  | 'PAYMENT_ON_TIME'
  | 'PAYMENT_EARLY'
  | 'PAYMENT_LATE'
  | 'PAYMENT_MISSED'
  | 'LATE_1_3_DAYS'
  | 'LATE_4_7_DAYS'
  | 'LATE_OVER_7_DAYS'
  | 'CYCLE_COMPLETED'
  | 'TONTINE_ABANDONED'
  | 'PENALTY_APPLIED'
  | 'DISPUTE_LOST'
  | 'BONUS_REFERRAL'
  | 'ADMIN_ADJUSTMENT';

// ── USER / PROFIL ─────────────────────────────────────────
export type AccountType = 'MEMBRE' | 'ORGANISATEUR';

export interface UserDto {
  id: string;
  uid: string;
  phone: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  kycStatus: 'PENDING' | 'SUBMITTED' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED';
  score?: number;
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  accountType?: AccountType;
  avatarUrl?: string;
}

// ── UserProfileResponseDto ────────────────────────────────
// Source : GET /api/v1/users/me · schema.prisma: users.kelembScore
export interface UserProfileDto {
  uid: string; // UUID v4
  phone: string; // E.164 ex: +23675100010
  fullName: string; // Nom complet — PAS firstName/lastName
  role: UserRole;
  status: UserStatus;
  kycStatus: KycStatus;
  kelembScore: number; // 0–1000 · défaut 500 en BDD
  accountType?: AccountType;
  lastLoginAt: string | null;
  createdAt: string;
  tontinesCount: number; // memberships ACTIVE
  activeAsMember: boolean;
}

// ── DASHBOARD ─────────────────────────────────────────────
export interface ScoreEventDto {
  uid: string;
  delta: number; // positif ou négatif
  reason: ScoreEventReason;
  tontineUid: string | null;
  createdAt: string;
}

export interface ScoreStatsDto {
  totalPositive: number;
  totalNegative: number;
  paymentsOnTime: number;
  paymentsMissed: number;
}

// ── ScoreResponseDto ──────────────────────────────────────
// Source : GET /api/v1/score/me
// currentScore = users.kelembScore en BDD (0–1000)
export interface ScoreResponseDto {
  uid: string;
  currentScore: number; // champ exact du backend (PAS "score")
  scoreLabel: ScoreLabel; // EXCELLENT | BON | MOYEN | FAIBLE | CRITIQUE
  history: ScoreEventDto[];
  stats: ScoreStatsDto;
}

export interface UnreadCountResponseDto {
  count: number;
}

export interface UpcomingPaymentDto extends PaymentDto {
  daysUntilDue: number;
  tontineName: string;
}

export interface DashboardTontineItem extends TontineDto {
  frequency?: TontineFrequency;
  nextPaymentDate?: string;
  isPaidUp?: boolean;
}

// ── ADMIN ─────────────────────────────────────────────────
export interface AdminBanDto {
  reason: string; // 5–500 caractères
}

export interface AdminRejectKycDto {
  reason: string; // 10–500 caractères
}

export interface CreateDisputeDto {
  targetUid: string;
  tontineUid: string;
  description: string; // 20–2000 caractères
  evidences?: string[];
}

export interface ResolveDisputeDto {
  resolution: string; // 10–1000 caractères
  scoreCorrection?: number; // -1000 à 1000
  justification?: string; // si scoreCorrection
}

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED';

export interface ChangeDisputeStatusDto {
  status: DisputeStatus;
}

// ── PAGINATION ────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit?: number;
  pageSize?: number;
  hasNextPage?: boolean;
}

// ── QUERY PARAMS communs ──────────────────────────────────
export interface PaginationQuery {
  page?: number;
  limit?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface TontinesListQuery extends PaginationQuery {
  status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
}

export interface PaymentsHistoryQuery extends PaginationQuery {
  status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
}

export interface NotificationsListQuery extends PaginationQuery {
  page?: number;
  pageSize?: number;
}
