import type { PaymentMethod, PaymentStatus } from '@/types/payment';
import type { TontineMember } from '@/types/tontine';

export type PaymentSubmissionMode = 'MOBILE_MONEY' | 'CASH_MEMBER' | 'CASH_CREATOR';

export function isTontineCreatorMember(
  members: TontineMember[],
  userUid: string | null | undefined
): boolean {
  if (!userUid) return false;

  return members.some(
    (member) => member.userUid === userUid && member.memberRole === 'CREATOR'
  );
}

export function getTontineCreatorName(members: TontineMember[]): string | null {
  const creator = members.find((member) => member.memberRole === 'CREATOR');
  return creator?.fullName?.trim() || null;
}

export function resolvePaymentSubmissionMode(
  method: PaymentMethod,
  isTontineCreator: boolean
): PaymentSubmissionMode {
  if (method === 'CASH') {
    return isTontineCreator ? 'CASH_CREATOR' : 'CASH_MEMBER';
  }

  return 'MOBILE_MONEY';
}

export function getCashMethodSublabel(isTontineCreator: boolean): string {
  return isTontineCreator
    ? 'Auto-confirmation de votre propre versement'
    : "Remise en main propre à l'organisateur";
}

export function getCashSelectionInfoText(isTontineCreator: boolean): string {
  return isTontineCreator
    ? 'Votre confirmation auto-validera cette cotisation en espèces immédiatement.'
    : "Après confirmation, vous ajouterez une preuve de remise pour validation par l'organisateur.";
}

export function getCashSummaryInfoText(
  formattedAmount: string,
  isTontineCreator: boolean
): string {
  return isTontineCreator
    ? `En confirmant, vous auto-validez votre versement de ${formattedAmount}. Le paiement sera marqué comme complété immédiatement.`
    : `En confirmant, vous enregistrez une remise de ${formattedAmount} en espèces. Une preuve vous sera ensuite demandée pour validation par l'organisateur.`;
}

export function shouldAutoApproveCreatorCash(result: {
  status: PaymentStatus;
  validationRequestUid: string | null;
}): boolean {
  return result.status !== 'COMPLETED' || result.validationRequestUid !== null;
}
