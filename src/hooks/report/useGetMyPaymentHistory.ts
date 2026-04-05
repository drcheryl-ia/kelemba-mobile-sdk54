/**
 * Historique complet des paiements COMPLETED pour le Rapport (pagination serveur résolue).
 */
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { selectUserUid } from '@/store/authSlice';
import type { RootState } from '@/store/store';
import { fetchAllCompletedPaymentItems } from '@/utils/reportPaymentData';
import type { ReportPeriod } from '@/types/report.types';

export function useGetMyPaymentHistory({ period: _period }: { period: ReportPeriod }) {
  const userUid = useSelector((s: RootState) => selectUserUid(s));
  const q = useQuery({
    queryKey: ['payments', 'my-history', 'report', userUid],
    queryFn: fetchAllCompletedPaymentItems,
    enabled: userUid !== null,
    staleTime: 120_000,
  });
  return {
    ...q,
    data: q.data != null ? { items: q.data } : undefined,
  };
}
