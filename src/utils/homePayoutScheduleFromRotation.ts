/**
 * Planning accueil — versements cagnotte (tours bénéficiaires), parts multiples.
 * Source : GET /tontines/:uid/rotation (cycles avec isCurrentUserBeneficiary).
 */
import type { CycleDisplayStatus, TontineRotationResponse } from '@/types/rotation';
import { computeCycleDisplayStatus } from '@/utils/rotationCycleDisplayStatus';

export function beneficiaryPayoutComplete(
  displayStatus: CycleDisplayStatus,
  apiStatus: string
): boolean {
  if (displayStatus === 'VERSÉ') return true;
  if (apiStatus === 'PAYOUT_COMPLETED' || apiStatus === 'COMPLETED') return true;
  return false;
}

/**
 * Tous les cycles où l’utilisateur est bénéficiaire (une ligne par part / tour prévu)
 * sont au statut « versé » — une part ou plusieurs parts.
 */
export function allUserBeneficiaryPayoutsReceived(
  cycles: Array<{
    isCurrentUserBeneficiary: boolean;
    displayStatus: CycleDisplayStatus;
    status: string;
  }>
): boolean {
  /** Aligné sur `deriveHomePayoutFromRotation` — évite les faux positifs (ex. `beneficiaryUid` ≠ user). */
  const mine = cycles.filter((c) => c.isCurrentUserBeneficiary === true);
  if (mine.length === 0) return false;
  return mine.every((c) =>
    beneficiaryPayoutComplete(c.displayStatus, c.status)
  );
}

const cyclesForBeneficiaryUser = (
  memberUserUid: string,
  cycles: Array<{ beneficiaryUid: string }>
) => cycles.filter((c) => c.beneficiaryUid === memberUserUid);

/**
 * `true` si le membre n’a pas encore reçu toutes ses cagnottes bénéficiaires
 * (au moins un cycle bénéficiaire encore non versé, ou aucun tour bénéficiaire dans les données).
 */
export function memberHasPendingBeneficiaryPayout(
  memberUserUid: string,
  cycles: Array<{
    beneficiaryUid: string;
    displayStatus: CycleDisplayStatus;
    status: string;
  }>
): boolean {
  const theirs = cyclesForBeneficiaryUser(memberUserUid, cycles);
  if (theirs.length === 0) return true;
  return theirs.some(
    (c) => !beneficiaryPayoutComplete(c.displayStatus, c.status)
  );
}

function parseExpectedDayStartMs(expectedDate: string): number {
  const part = expectedDate.split('T')[0];
  const [y, m, d] = part.split('-').map(Number);
  if (!y || !m || !d) return Number.POSITIVE_INFINITY;
  const dt = new Date(y, m - 1, d);
  const t = dt.getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

export type HomePayoutFromRotation =
  | { kind: 'all_beneficiary_turns_done' }
  | {
      kind: 'next_beneficiary_turn';
      expectedDateIso: string;
      beneficiaryCycleNumber: number;
      displayStatus: CycleDisplayStatus;
      isMyTurnNow: boolean;
    };

/**
 * Dérive l’affichage planning à partir de la rotation.
 * `null` → données insuffisantes, garder le fallback liste (`myScheduledPayoutDate`).
 */
export function deriveHomePayoutFromRotation(
  response: TontineRotationResponse
): HomePayoutFromRotation | null {
  const currentCycleNumber = response.currentCycleNumber;
  const mine = response.cycles.filter((c) => c.isCurrentUserBeneficiary === true);
  if (mine.length === 0) return null;

  const enriched = mine.map((raw) => ({
    raw,
    displayStatus: computeCycleDisplayStatus(raw, currentCycleNumber),
  }));

  const incomplete = enriched.filter(
    (e) => !beneficiaryPayoutComplete(e.displayStatus, e.raw.status)
  );
  const complete = enriched.filter((e) =>
    beneficiaryPayoutComplete(e.displayStatus, e.raw.status)
  );

  if (incomplete.length === 0 && complete.length > 0) {
    return { kind: 'all_beneficiary_turns_done' };
  }

  if (incomplete.length === 0) {
    return null;
  }

  incomplete.sort(
    (a, b) =>
      parseExpectedDayStartMs(a.raw.expectedDate) -
      parseExpectedDayStartMs(b.raw.expectedDate)
  );
  const next = incomplete[0];
  const isMyTurnNow =
    next.displayStatus === 'EN_COURS' ||
    next.displayStatus === 'RETARDÉ' ||
    next.raw.status === 'ACTIVE' ||
    next.raw.status === 'PAYOUT_IN_PROGRESS';

  return {
    kind: 'next_beneficiary_turn',
    expectedDateIso: next.raw.expectedDate,
    beneficiaryCycleNumber: next.raw.cycleNumber,
    displayStatus: next.displayStatus,
    isMyTurnNow,
  };
}
