/**
 * Types domaine — CLAUDE.md. Tous les IDs en string (UUID v4).
 */

export type TontineStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REFUNDED';

export type KycStatus = 'VERIFIED' | 'PENDING' | 'REJECTED';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED';

export type KelembaScore = number; // 0–1000

import type { AccountType } from '@/types/user.types';

export interface User {
  id: string;
  phone: string;
  status: UserStatus;
  kycStatus: KycStatus;
  kelembaScore: KelembaScore;
  accountType?: AccountType;
  createdAt: string;
  updatedAt: string;
}

export interface Tontine {
  id: string;
  name: string;
  status: TontineStatus;
  partAmount: number;
  memberCount: number;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  amount: number;
  status: PaymentStatus;
  tontineId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}
