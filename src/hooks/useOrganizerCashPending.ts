/**
 * Validations especes agregees (organisateur) + compteur badge.
 * Reserve aux utilisateurs organisateurs d'au moins une tontine (liste tontines).
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { shouldRetryApiQuery } from '@/api/errors/queryRetry';
import {
  getOrganizerCashPendingActions,
  getOrganizerCashPendingCount,
} from '@/api/cashPaymentApi';
import {
  filterOrganizerCashPendingForTontineScope,
  getOrganizerTontineUids,
} from '@/hooks/organizerCashPending.helpers';
import { useTontines } from '@/hooks/useTontines';
import { useHasOrganizerRoleInTontines } from '@/hooks/useHasOrganizerRoleInTontines';
import { selectUserUid } from '@/store/authSlice';
import type { RootState } from '@/store/store';

export {
  filterOrganizerCashPendingForOthers,
  filterOrganizerCashPendingForTontineScope,
  getOrganizerTontineUids,
  isOpenOrganizerCashStatus,
} from '@/hooks/organizerCashPending.helpers';

const STALE_TIME = 30_000;
const STALE_COUNT = 15_000;
const GC_TIME = 24 * 60 * 60 * 1000;

export interface OrganizerCashPendingActionsOptions {
  active?: boolean;
}

export function useOrganizerCashPendingActions(
  options?: OrganizerCashPendingActionsOptions
) {
  const userUid = useSelector((s: RootState) => selectUserUid(s));
  const hasOrganizerRole = useHasOrganizerRoleInTontines();
  const isActive = options?.active ?? true;

  return useQuery({
    queryKey: ['payments', 'cash', 'organizer', 'pending-actions', userUid],
    queryFn: () => getOrganizerCashPendingActions(),
    enabled: userUid !== null && hasOrganizerRole && isActive,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    networkMode: 'offlineFirst',
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: shouldRetryApiQuery,
  });
}

export function useOrganizerCashPendingCount() {
  const userUid = useSelector((s: RootState) => selectUserUid(s));
  const hasOrganizerRole = useHasOrganizerRoleInTontines();

  return useQuery({
    queryKey: ['payments', 'cash', 'organizer', 'pending-count', userUid],
    queryFn: () => getOrganizerCashPendingCount(),
    enabled: userUid !== null && hasOrganizerRole,
    staleTime: STALE_COUNT,
    gcTime: GC_TIME,
    networkMode: 'offlineFirst',
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: shouldRetryApiQuery,
  });
}

/**
 * Compteur badge Paiements : longueur liste pending filtree (hors self-pay, perimetre organisateur).
 */
export function useOrganizerCashPendingBadgeCount(): number {
  const hasOrganizer = useHasOrganizerRoleInTontines();
  const userUid = useSelector((s: RootState) => selectUserUid(s));
  const { tontines } = useTontines({ includeInvitations: false });
  const organizerUids = useMemo(
    () => getOrganizerTontineUids(tontines),
    [tontines]
  );
  const { data: actions = [] } = useOrganizerCashPendingActions({
    active: hasOrganizer,
  });

  return useMemo(() => {
    if (!hasOrganizer || !userUid) return 0;
    return filterOrganizerCashPendingForTontineScope(
      actions,
      userUid,
      organizerUids
    ).length;
  }, [hasOrganizer, userUid, actions, organizerUids]);
}
