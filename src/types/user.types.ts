/**
 * Types profil utilisateur — alignés sur api-contract / schema.prisma.
 */

export type AccountType = 'MEMBRE' | 'ORGANISATEUR';

import type {
  UserRole,
  UserStatus,
  KycStatus,
  ScoreLabel,
  ScoreEventReason,
} from '@/api/types/api.types';

export type { UserRole, UserStatus, KycStatus, ScoreLabel, ScoreEventReason };

export interface UserProfileResponseDto {
  uid: string;
  phone: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  kycStatus: KycStatus;
  kelembScore: number;
  accountType?: AccountType;
  lastLoginAt: string | null;
  createdAt: string;
  tontinesCount: number;
  activeAsMember: boolean;
}

export interface ScoreEventDto {
  uid: string;
  delta: number;
  reason: ScoreEventReason;
  tontineUid: string | null;
  createdAt: string;
}

export interface ScoreStatsDto {
  totalEvents: number;
  positiveEvents: number;
  negativeEvents: number;
  netDelta: number;
}

export interface ScoreResponseDto {
  uid: string;
  currentScore: number;
  scoreLabel: ScoreLabel;
  history: ScoreEventDto[];
  stats: ScoreStatsDto;
}

export const SCORE_LABEL_CONFIG: Record<
  ScoreLabel,
  { badge: string; sango: string; color: string; min: number; max: number }
> = {
  EXCELLENT: {
    badge: 'Excellent',
    sango: 'Mbê tî sô',
    color: '#1A6B3C',
    min: 801,
    max: 1000,
  },
  BON: {
    badge: 'Fiable',
    sango: 'Î-kodê',
    color: '#1A6B3C',
    min: 601,
    max: 800,
  },
  MOYEN: {
    badge: 'Moyen',
    sango: 'Peke-peke',
    color: '#F5A623',
    min: 401,
    max: 600,
  },
  FAIBLE: {
    badge: 'Faible',
    sango: 'Sêkê',
    color: '#FF6B35',
    min: 201,
    max: 400,
  },
  CRITIQUE: {
    badge: 'Critique',
    sango: 'Ayeke fâ',
    color: '#D0021B',
    min: 1,
    max: 200,
  },
};
