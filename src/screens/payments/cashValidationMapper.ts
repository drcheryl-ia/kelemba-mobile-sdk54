/**
 * Mapping actions organisateur API → `CashValidationItem`.
 */
import type { OrganizerCashPendingAction } from '@/api/cashPaymentApi';
import type { CashValidationItem, CashValidationStatus } from '@/types/payments.types';

function mapStatus(raw: string): CashValidationStatus {
  if (raw === 'APPROVED') return 'APPROVED';
  if (raw === 'REJECTED') return 'REJECTED';
  return 'PENDING_REVIEW';
}

export function organizerActionToCashValidationItem(
  a: OrganizerCashPendingAction
): CashValidationItem {
  const base =
    a.baseAmount != null && Number.isFinite(a.baseAmount)
      ? Math.round(a.baseAmount)
      : Math.max(
          0,
          Math.round(a.amount) - Math.round(a.penaltyAmount ?? 0)
        );
  const pen = Math.round(a.penaltyAmount ?? 0);
  const total =
    a.totalAmount != null && Number.isFinite(a.totalAmount)
      ? Math.round(a.totalAmount)
      : Math.round(a.amount);

  return {
    validationRequestUid: a.validationRequestUid,
    paymentUid: a.paymentUid,
    tontineUid: a.tontineUid,
    tontineName: a.tontineName,
    cycleUid: a.cycleUid,
    cycleNumber: a.cycleNumber,
    memberUid: a.memberUid,
    memberName: a.memberName,
    memberPhone: a.memberPhone,
    submittedAt: a.submittedAt,
    baseAmount: base,
    penaltyAmount: pen,
    totalAmount: total,
    status: mapStatus(String(a.status)),
    receiptPhotoUrl: a.receiptPhotoUrl,
    receiverName: a.receiverName,
    latitude: a.latitude,
    longitude: a.longitude,
  };
}
