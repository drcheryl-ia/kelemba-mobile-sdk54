import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';

export const useScore = () => {
  const kelembaScore = useSelector(
    (state: RootState) => state.auth.currentUser?.kelembScore ?? 0
  );
  return { kelembaScore };
};
