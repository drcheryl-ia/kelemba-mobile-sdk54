/**
 * Normalisation métier du « prochain paiement » (GET /users/me/next-payment).
 * Ne pas afficher de rappel si le backend indique déjà une obligation soldée ou un montant nul.
 */
import type { NextPaymentData } from '@/types/payment';
import type { PaymentStatus } from '@/types/domain.types';

function parsePaymentStatus(raw: unknown): PaymentStatus | null {
  if (raw == null || raw === '') return null;
  const s = String(raw);
  const allowed: PaymentStatus[] = [
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'REFUNDED',
  ];
  return allowed.includes(s as PaymentStatus) ? (s as PaymentStatus) : null;
}

/**
 * Valide et normalise la charge utile API. Retourne null si aucun rappel de paiement n’est pertinent.
 */
export function parseNextPaymentPayload(raw: unknown): NextPaymentData | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;

  const paymentStatus = parsePaymentStatus(o.paymentStatus);
  const amountDue = Number(o.amountDue ?? o.amountRemaining ?? 0);
  const amountRemainingRaw = Number(o.amountRemaining ?? amountDue);
  const amountRemaining = Number.isFinite(amountRemainingRaw)
    ? amountRemainingRaw
    : amountDue;
  const baseContributionAmountRaw = Number(
    o.baseContributionAmount ?? amountRemaining + Number(o.amountPaid ?? 0)
  );
  const baseContributionAmount = Number.isFinite(baseContributionAmountRaw)
    ? baseContributionAmountRaw
    : undefined;
  const amountPaidRaw = Number(o.amountPaid ?? 0);
  const amountPaid = Number.isFinite(amountPaidRaw) ? amountPaidRaw : undefined;
  const penaltyAmount = Number(o.penaltyAmount ?? 0);
  const totalDueRaw = o.totalDue ?? o.totalAmountDue;
  const totalDue =
    totalDueRaw != null && Number.isFinite(Number(totalDueRaw))
      ? Number(totalDueRaw)
      : amountDue + penaltyAmount;
  const totalAmountDue = Number.isFinite(Number(o.totalAmountDue))
    ? Number(o.totalAmountDue)
    : totalDue;

  if (paymentStatus === 'COMPLETED') return null;
  if (!Number.isFinite(totalDue) || totalDue <= 0) return null;

  const dueRaw = o.dueDate;
  if (dueRaw == null || dueRaw === '') return null;
  const dueDate = String(dueRaw).split('T')[0];
  if (dueDate.length < 8) return null;

  const tontineUid = String(o.tontineUid ?? '').trim();
  const cycleUid = String(o.cycleUid ?? '').trim();
  if (tontineUid === '' || cycleUid === '') return null;

  const tontineName = String(o.tontineName ?? '');
  const cycleNumber = Number(o.cycleNumber ?? 0);
  const daysLateRaw = Number(o.daysLate ?? 0);
  const isOverdue = o.isOverdue === true;
  const recordPaymentUid =
    o.recordPaymentUid != null && String(o.recordPaymentUid).trim() !== ''
      ? String(o.recordPaymentUid)
      : null;
  const recordPaymentStatus = parsePaymentStatus(o.recordPaymentStatus);
  const obligationStatusRaw = o.obligationStatus;
  const obligationStatus =
    obligationStatusRaw === 'DUE' ||
    obligationStatusRaw === 'OVERDUE' ||
    obligationStatusRaw === 'PENALIZED'
      ? obligationStatusRaw
      : undefined;

  return {
    tontineUid,
    tontineName,
    cycleUid,
    cycleNumber: Number.isFinite(cycleNumber) ? cycleNumber : 0,
    amountDue: Number.isFinite(amountDue) ? amountDue : 0,
    amountRemaining,
    baseContributionAmount,
    amountPaid,
    penaltyAmount: Number.isFinite(penaltyAmount) ? penaltyAmount : 0,
    totalDue,
    totalAmountDue,
    dueDate,
    isOverdue,
    daysLate: Number.isFinite(daysLateRaw) ? daysLateRaw : undefined,
    obligationStatus,
    recordPaymentUid,
    recordPaymentStatus,
    paymentStatus: paymentStatus ?? 'PENDING',
  };
}
