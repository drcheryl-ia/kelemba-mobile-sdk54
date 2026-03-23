/**
 * True si l'utilisateur est créateur / organisateur d'au moins une tontine (données liste tontines).
 */
import { useMemo } from 'react';
import { useTontines } from '@/hooks/useTontines';

export function useHasOrganizerRoleInTontines(): boolean {
  const { tontines } = useTontines({ includeInvitations: false });
  return useMemo(
    () =>
      tontines.some(
        (t) => t.isCreator === true || t.membershipRole === 'CREATOR'
      ),
    [tontines]
  );
}
