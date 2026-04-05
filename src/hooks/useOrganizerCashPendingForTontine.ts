/**
 * Validations espèces organisateur filtrées sur une tontine (même source que ValidationsTab).
 */
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useOrganizerCashPendingActions } from '@/hooks/useOrganizerCashPending';
import {
  filterOrganizerCashPendingForTontineScope,
  getOrganizerTontineUids,
} from '@/hooks/organizerCashPending.helpers';
import { useTontines } from '@/hooks/useTontines';
import { organizerActionToCashValidationItem } from '@/screens/payments/cashValidationMapper';
import { selectUserUid } from '@/store/authSlice';
import type { RootState } from '@/store/store';
import type { CashValidationItem } from '@/types/payments.types';

export function useOrganizerCashPendingForTontine(
  tontineUid: string,
  active: boolean
): {
  items: CashValidationItem[];
  refetch: () => void;
  isLoading: boolean;
} {
  const userUid = useSelector((s: RootState) => selectUserUid(s));
  const { tontines } = useTontines({ includeInvitations: false });
  const organizerUids = useMemo(
    () => getOrganizerTontineUids(tontines),
    [tontines]
  );
  const { data: raw = [], refetch, isLoading } = useOrganizerCashPendingActions({
    active,
  });

  const items = useMemo(() => {
    const scoped = filterOrganizerCashPendingForTontineScope(
      raw,
      userUid,
      organizerUids
    ).filter((a) => a.tontineUid === tontineUid);
    return scoped.map(organizerActionToCashValidationItem);
  }, [raw, tontineUid, userUid, organizerUids]);

  return { items, refetch, isLoading };
}
