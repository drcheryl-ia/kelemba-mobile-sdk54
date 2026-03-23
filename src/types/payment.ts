/**
 * Types paiement — prochain paiement dû, statuts, niveau d'urgence.
 */

import type { PaymentStatus } from '@/types/domain.types';

export type { PaymentStatus };

export type PaymentMethod = 'ORANGE_MONEY' | 'TELECEL_MONEY' | 'CASH';
export type MobileMoneyMethod = Exclude<PaymentMethod, 'CASH'>;

export interface InitiatePaymentPayload {
  cycleUid: string;
  amount: number;
  method: MobileMoneyMethod;
  idempotencyKey: string;
}

export interface InitiatePaymentResponse {
  uid: string;
  /** Statut renvoyé par le backend (PROCESSING ou COMPLETED pour Mobile Money, etc.) */
  status?: PaymentStatus;
}

export interface PaymentStatusDto {
  uid: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  amount: number;
  penalty: number;
  method: PaymentMethod;
  externalRef: string | null;
  paidAt: string | null;
  createdAt: string;
}

/**
 * Données du récépissé numérique d'un paiement COMPLETED.
 * Utilisé pour l'affichage et l'export PDF.
 */
export interface PaymentReceiptData {
  paymentUid: string;
  externalRef: string | null;
  paidAt: string;
  tontineName: string;
  cycleNumber: number;
  totalCycles: number;
  beneficiaryName: string | null;
  beneficiaryNetAmount?: number | null;
  baseAmount: number;
  penaltyAmount: number;
  totalAmount: number;
  method: PaymentMethod;
  payerName: string;
  payerPhone: string;
  status: 'COMPLETED';
}

/**
 * Niveau d'urgence du prochain paiement.
 * - NORMAL : > 5 jours restants — paiement confortable
 * - BIENTÔT : 3 à 5 jours — rappel préventif
 * - URGENT : 0 à 2 jours — paiement imminent ou aujourd'hui
 * - EN_RETARD : < 0 jours — date dépassée, pénalités en cours
 */
export type UrgencyLevel = 'NORMAL' | 'BIENTÔT' | 'URGENT' | 'EN_RETARD';

/**
 * Données du prochain paiement dû (GET /api/v1/users/me/next-payment).
 * Tous les montants sont en entiers FCFA.
 */
export interface NextPaymentData {
  /** UUID v4 de la tontine */
  tontineUid: string;
  /** Nom de la tontine */
  tontineName: string;
  /** UUID v4 du cycle */
  cycleUid: string;
  /** Numéro du cycle (entier ≥ 1) */
  cycleNumber: number;
  /** Montant de base de la part (entier FCFA) */
  amountDue: number;
  /** Alias backend plus explicite du reste de cotisation hors pénalité */
  amountRemaining?: number;
  /** Montant de cotisation théorique du cycle avant paiements partiels */
  baseContributionAmount?: number;
  /** Déjà encaissé sur cette obligation */
  amountPaid?: number;
  /** Pénalités accumulées (0 si aucun retard) */
  penaltyAmount: number;
  /** Montant total dû — amountDue + penaltyAmount (calculé backend) */
  totalDue: number;
  /** Alias backend plus explicite du total dû */
  totalAmountDue?: number;
  /** Date limite de paiement — ISO 8601 date-only "YYYY-MM-DD" */
  dueDate: string;
  /** Indique si l'échéance est déjà dépassée */
  isOverdue?: boolean;
  /** Jours de retard remontés par le backend */
  daysLate?: number;
  /** Statut métier normalisé du backend */
  obligationStatus?: 'DUE' | 'OVERDUE' | 'PENALIZED';
  /** UUID du paiement déjà ouvert pour cette obligation, si présent */
  recordPaymentUid?: string | null;
  /** Statut exact de la ligne de paiement déjà ouverte, si présent */
  recordPaymentStatus?: PaymentStatus | null;
  /** Statut du paiement */
  paymentStatus: PaymentStatus;
}
