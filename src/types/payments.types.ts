/**
 * Types UI cotisations / obligations — écrans Paiements (liste, historique).
 * Complète `payment.ts` sans le remplacer.
 */

export type PaymentObligationStatus =
  | 'OVERDUE'
  | 'DUE_TODAY'
  | 'DUE_SOON'
  | 'UPCOMING'
  | 'PAID';

export interface PaymentObligation {
  tontineUid: string;
  tontineName: string;
  cycleUid: string;
  cycleNumber: number;
  frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  baseAmount: number;
  penaltyAmount: number;
  totalAmountDue: number;
  /** OVERDUE : jours de retard · sinon jours jusqu’à l’échéance (négatif = avant échéance) */
  daysLate: number;
  dueDate: string;
  obligationStatus: PaymentObligationStatus;
  isCreator: boolean;
}

export interface PaymentHistoryEntry {
  uid: string;
  tontineUid: string;
  tontineName: string;
  cycleNumber: number;
  amount: number;
  penaltyAmount: number;
  method: 'ORANGE_MONEY' | 'TELECEL_MONEY' | 'CASH' | 'SYSTEM';
  status: 'COMPLETED' | 'FAILED' | 'PENDING' | 'PROCESSING' | 'REFUNDED';
  externalRef: string | null;
  paidAt: string;
  entryType: 'PAYMENT' | 'PENALTY' | 'CASH_VALIDATED';
}

/** Validations espèces (organisateur). */
export type CashValidationStatus =
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED';

export interface CashValidationItem {
  validationRequestUid: string;
  paymentUid: string;
  tontineUid: string;
  tontineName: string;
  cycleUid: string;
  cycleNumber: number;
  memberUid: string;
  memberName: string;
  memberPhone: string;
  submittedAt: string;
  baseAmount: number;
  penaltyAmount: number;
  totalAmount: number;
  status: CashValidationStatus;
  receiptPhotoUrl: string | null;
  receiverName: string;
  latitude: number | null;
  longitude: number | null;
}
