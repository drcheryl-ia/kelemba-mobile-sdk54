/**
 * Aligné sur api-contract.json — InitiateCyclePayoutDto (CyclesController_triggerPayout_v1).
 */
import type { PaymentStatus } from '@/types/domain.types';

export type CyclePayoutPaymentMethod = 'ORANGE_MONEY' | 'TELECEL_MONEY' | 'CASH';

export interface InitiateCyclePayoutDto {
  paymentMethod: CyclePayoutPaymentMethod;
  idempotencyKey: string;
  /** JWT émis par POST .../payout/step-up-token après validation PIN */
  securityConfirmationToken: string;
  receiverPhone?: string;
  receiverName?: string;
  /** Obligatoire à true pour CASH (contrat backend). */
  cashConfirmed?: boolean;
}

/** Réponse 200 — schéma non figé dans le contrat ; champs optionnels selon évolution backend. */
export interface CyclePayoutResponse {
  paymentUid?: string;
  paymentId?: string;
  status?: PaymentStatus | string;
  externalRef?: string;
  message?: string;
  [key: string]: unknown;
}

export interface CycleCompletionInfo {
  /** Si absent ou undefined, l’UI retombe sur les métriques du cycle courant. */
  isComplete?: boolean;
  outstandingMemberIds?: string[];
  raw: Record<string, unknown>;
}
