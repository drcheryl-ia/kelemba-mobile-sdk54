import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@/store/store';
import { setAuth, clearAuth, selectCurrentUser, selectIsAuthenticated } from '@/store/authSlice';
import type { UserProfileResponseDto } from '@/types/user.types';

export const useAuth = () => {
  const dispatch = useDispatch<AppDispatch>();
  const currentUser = useSelector(selectCurrentUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  return {
    user: currentUser,
    currentUser,
    isAuthenticated,
    setAuth: (payload: {
      user: UserProfileResponseDto | { id: string; uid?: string; phone?: string; kycStatus?: string; accountType?: 'MEMBRE' | 'ORGANISATEUR' };
      accessToken: string;
      refreshToken: string;
    }) => dispatch(setAuth(payload)),
    clearAuth: () => dispatch(clearAuth()),
  };
};
