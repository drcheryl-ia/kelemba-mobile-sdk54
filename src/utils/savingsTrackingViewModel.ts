/**
 * Agrégats et filtres pour l’écran « Suivi épargnes » — logique pure testée.
 */
import type { MyBalanceResponse } from '@/types/savings.types';
import type { TontineListItem, TontineReportSummary } from '@/types/tontine';

export type TrackingRoleFilter = 'all' | 'member' | 'organizer';

/** Tontines où l’utilisateur a une participation réelle (hors invitation non finalisée). */
export function isParticipatingTontineRow(item: TontineListItem): boolean {
  if (item.isPending === true) return false;
  if (item.membershipStatus === 'PENDING') return false;
  return item.membershipStatus === 'ACTIVE';
}

export function isOrganizerInTontine(item: TontineListItem): boolean {
  return item.isCreator === true || item.membershipRole === 'CREATOR';
}

export function filterByTrackingRole(
  items: TontineListItem[],
  filter: TrackingRoleFilter
): TontineListItem[] {
  const base = items.filter(isParticipatingTontineRow);
  if (filter === 'all') return base;
  if (filter === 'organizer') return base.filter(isOrganizerInTontine);
  return base.filter((t) => !isOrganizerInTontine(t));
}

export function splitEpargneRotative(items: TontineListItem[]): {
  epargne: TontineListItem[];
  rotative: TontineListItem[];
} {
  const ep: TontineListItem[] = [];
  const ro: TontineListItem[] = [];
  for (const t of items) {
    if (t.type === 'EPARGNE') ep.push(t);
    else if (t.type === 'ROTATIVE') ro.push(t);
  }
  return { epargne: ep, rotative: ro };
}

export interface SavingsTrackingGlobalTotals {
  /** Somme des soldes personnels épargne (GET balance), si disponibles. */
  totalPersonalBalance: number | null;
  /** Somme des pénalités côté liste (cycle courant / dette affichée). */
  totalPenaltiesFromList: number;
  /** Somme des écarts (projection − cotisations versées) quand calculable par tontine épargne. */
  bonusEstimatedSum: number | null;
  /** Nombre de tontines épargne actives (participation). */
  activeEpargneCount: number;
  /** Nombre de tontines rotatives actives (participation). */
  activeRotativeCount: number;
  /** Tontines où l’utilisateur est organisateur (créateur). */
  activeOrganizerCount: number;
  /** Tontines où l’utilisateur n’est pas organisateur (rôle membre seul dans le filtre courant). */
  activeMemberOnlyCount: number;
  /** Tours rotatifs où le membre était bénéficiaire (rapport API), par UID. */
  rotativePayoutTurnsTotal: number | null;
}

function sumPenaltyFromList(items: TontineListItem[]): number {
  let s = 0;
  for (const t of items) {
    if (t.penaltyAmount != null && Number.isFinite(t.penaltyAmount)) {
      s += t.penaltyAmount;
    }
  }
  return s;
}

/**
 * Estimation prudente : différence entre projection à terme et total déjà cotisé (bonus interne / mécanisme, pas rendement garanti).
 */
export function estimatedBonusDeltaFromBalance(b: MyBalanceResponse): number | null {
  const proj = b.estimatedFinalBalance;
  const paid = b.totalContributed;
  if (!Number.isFinite(proj) || !Number.isFinite(paid)) return null;
  const d = proj - paid;
  if (!Number.isFinite(d) || d <= 0) return null;
  return d;
}

export function buildSavingsTrackingGlobalTotals(input: {
  filteredItems: TontineListItem[];
  balanceByEpargneUid: Record<string, MyBalanceResponse | undefined>;
  rotativePayoutCounts: Record<string, number | undefined>;
}): SavingsTrackingGlobalTotals {
  const { epargne, rotative } = splitEpargneRotative(input.filteredItems);

  let totalPersonal: number | null = null;
  let anyBal = false;
  let bonusSum = 0;
  let anyBonus = false;

  for (const t of epargne) {
    const b = input.balanceByEpargneUid[t.uid];
    if (b != null) {
      anyBal = true;
      if (Number.isFinite(b.personalBalance)) {
        if (totalPersonal == null) totalPersonal = 0;
        totalPersonal += b.personalBalance;
      }
      const est = estimatedBonusDeltaFromBalance(b);
      if (est != null) {
        bonusSum += est;
        anyBonus = true;
      }
    }
  }

  let rotTurns: number | null = null;
  const uids = Object.keys(input.rotativePayoutCounts);
  if (uids.length > 0) {
    let sum = 0;
    let any = false;
    for (const uid of uids) {
      const c = input.rotativePayoutCounts[uid];
      if (c != null && Number.isFinite(c)) {
        sum += c;
        any = true;
      }
    }
    rotTurns = any ? sum : null;
  }

  const organizers = input.filteredItems.filter(isOrganizerInTontine);
  const memberOnly = input.filteredItems.filter((t) => !isOrganizerInTontine(t));

  return {
    totalPersonalBalance: anyBal ? totalPersonal : null,
    totalPenaltiesFromList: sumPenaltyFromList(input.filteredItems),
    bonusEstimatedSum: anyBonus ? bonusSum : null,
    activeEpargneCount: epargne.length,
    activeRotativeCount: rotative.length,
    activeOrganizerCount: organizers.length,
    activeMemberOnlyCount: memberOnly.length,
    rotativePayoutTurnsTotal: rotTurns,
  };
}

const PAYOUT_DONE: Array<string> = ['COMPLETED', 'PAYOUT_COMPLETED'];

export function countRotativeBeneficiaryTurns(
  report: TontineReportSummary | undefined,
  userUid: string
): number | null {
  if (report == null || userUid === '') return null;
  let n = 0;
  for (const c of report.cycles) {
    if (c.beneficiaryUid !== userUid) continue;
    if (PAYOUT_DONE.includes(c.status)) n += 1;
  }
  return n;
}
