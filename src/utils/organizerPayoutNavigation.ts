/**
 * Navigation unifiée vers CyclePayoutScreen : montant et nom issus de payout-organizer-state + résolution locale du nom.
 */
import { getPayoutOrganizerState } from '@/api/cyclePayoutApi';
import type { RootStackParamList } from '@/navigation/types';
import type { CyclePayoutOrganizerState } from '@/types/cyclePayout';
import type { TontineListItem } from '@/types/tontine';

export type CyclePayoutNavigationPayload = RootStackParamList['CyclePayoutScreen'];

export type OrganizerPayoutNavigationContext =
  | { kind: 'list'; item: TontineListItem }
  | {
      kind: 'detail';
      tontineUid: string;
      tontineName: string;
      currentCycle: {
        uid: string;
        cycleNumber: number;
        beneficiaryMembershipUid?: string | null;
      };
      members: ReadonlyArray<{ uid: string; fullName: string }>;
    };

export type OrganizerPayoutNavigationFailureReason = 'not_payable' | 'invalid_amount';

/**
 * Ordre : state.beneficiaryName → membre du cycle → champs liste → « — ».
 */
export function resolveCyclePayoutBeneficiaryName(
  state: Pick<CyclePayoutOrganizerState, 'beneficiaryName'>,
  ctx: OrganizerPayoutNavigationContext
): string {
  const raw = state.beneficiaryName;
  if (raw != null && String(raw).trim() !== '') {
    return String(raw).trim();
  }

  if (ctx.kind === 'detail') {
    const uid = ctx.currentCycle.beneficiaryMembershipUid;
    if (uid != null && uid !== '') {
      const m = ctx.members.find((x) => x.uid === uid);
      if (m?.fullName != null && String(m.fullName).trim() !== '') {
        return String(m.fullName).trim();
      }
    }
  }

  if (ctx.kind === 'list') {
    const { item } = ctx;
    if (item.beneficiaryName != null && String(item.beneficiaryName).trim() !== '') {
      return String(item.beneficiaryName).trim();
    }
    if (
      item.payoutBeneficiaryName != null &&
      String(item.payoutBeneficiaryName).trim() !== ''
    ) {
      return String(item.payoutBeneficiaryName).trim();
    }
  }

  return '—';
}

/**
 * Récupère l’état serveur et construit le payload CyclePayoutScreen.
 * Lève les erreurs réseau / API (à gérer par l’appelant).
 */
export async function resolveOrganizerPayoutNavigationData(
  cycleUid: string,
  ctx: OrganizerPayoutNavigationContext
): Promise<
  | { ok: true; payload: CyclePayoutNavigationPayload }
  | { ok: false; reason: OrganizerPayoutNavigationFailureReason }
> {
  const state = await getPayoutOrganizerState(cycleUid);

  if (!state.canOrganizerTriggerPayout) {
    return { ok: false, reason: 'not_payable' };
  }

  const net = state.netPayoutAmount;
  if (!Number.isFinite(net) || net <= 0) {
    return { ok: false, reason: 'invalid_amount' };
  }

  const beneficiaryName = resolveCyclePayoutBeneficiaryName(state, ctx);

  if (ctx.kind === 'list') {
    const { item } = ctx;
    const cycleNum = item.currentCycleNumber ?? item.currentCycle ?? 0;
    const payload: CyclePayoutNavigationPayload = {
      tontineUid: item.uid,
      tontineName: item.name,
      cycleUid,
      cycleNumber: typeof cycleNum === 'number' && Number.isFinite(cycleNum) ? cycleNum : 0,
      beneficiaryName,
      netAmount: net,
    };
    return { ok: true, payload };
  }

  const payload: CyclePayoutNavigationPayload = {
    tontineUid: ctx.tontineUid,
    tontineName: ctx.tontineName,
    cycleUid,
    cycleNumber: ctx.currentCycle.cycleNumber,
    beneficiaryName,
    netAmount: net,
  };
  return { ok: true, payload };
}
