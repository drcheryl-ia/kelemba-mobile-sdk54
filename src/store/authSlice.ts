import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/store/store';
import type { UserProfileResponseDto } from '@/types/user.types';
import type { AccountType } from '@/types/user.types';
import { authStorage, STORAGE_KEYS } from '@/storage/authStorage';
import { apiClient } from '@/api/apiClient';
import { ENDPOINTS } from '@/api/endpoints';
import { unregisterPushDeviceBeforeLogout } from '@/api/authApi';
import { logger } from '@/utils/logger';

type ScoreLevel = 'DEBUTANT' | 'BRONZE' | 'ARGENT' | 'OR' | 'ELITE';

function computeScoreLevel(score: number): ScoreLevel {
  if (score >= 900) return 'ELITE';
  if (score >= 700) return 'OR';
  if (score >= 500) return 'ARGENT';
  if (score >= 300) return 'BRONZE';
  return 'DEBUTANT';
}

function mapDtoToCurrentUser(dto: UserProfileResponseDto) {
  return {
    uid: dto.uid,
    phone: dto.phone,
    fullName: dto.fullName,
    role: dto.role,
    status: dto.status,
    kycStatus: dto.kycStatus,
    accountType: (dto.accountType ?? 'MEMBRE') as AccountType,
    kelembScore: dto.kelembScore ?? 500,
    scoreLevel: computeScoreLevel(dto.kelembScore ?? 500),
    tontinesCount: dto.tontinesCount ?? 0,
    activeAsMember: dto.activeAsMember ?? false,
    lastLoginAt: dto.lastLoginAt ?? null,
    createdAt: dto.createdAt,
  };
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  currentUser: {
    uid: string;
    phone: string;
    fullName: string;
    role: UserProfileResponseDto['role'];
    status: UserProfileResponseDto['status'];
    kycStatus: UserProfileResponseDto['kycStatus'];
    accountType: AccountType;
    kelembScore: number;
    scoreLevel: ScoreLevel;
    tontinesCount: number;
    activeAsMember: boolean;
    lastLoginAt: string | null;
    createdAt: string;
  } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  accessToken: null,
  refreshToken: null,
  currentUser: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// ── Thunks ─────────────────────────────────────────────────
export const loginThunk = createAsyncThunk<
  { accessToken: string; refreshToken: string; user: UserProfileResponseDto },
  { phone: string; pin: string },
  { rejectValue: string }
>(
  'auth/login',
  async ({ phone, pin }, { rejectWithValue }) => {
    const normalizedPhone = phone.replace(/\s/g, '');
    const phoneE164 =
      normalizedPhone.startsWith('+') ? normalizedPhone : `+236${normalizedPhone}`;
    try {
      const { url } = ENDPOINTS.AUTH.LOGIN;
      const response = await apiClient.post<{
        accessToken: string;
        refreshToken: string;
        user: UserProfileResponseDto;
      }>(url, { phone: phoneE164, pin });
      const { user, accessToken, refreshToken } = response.data;
      await authStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, String(accessToken ?? ''));
      await authStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, String(refreshToken ?? ''));
      const accountType = user.accountType;
      if (accountType) {
        await authStorage.setItem(STORAGE_KEYS.ACCOUNT_TYPE, String(accountType));
      }
      return { accessToken, refreshToken, user };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[auth/loginThunk] failed', { message: msg.replace(/pin|password/gi, '***') });
      return rejectWithValue(msg);
    }
  }
);

export const refreshTokenThunk = createAsyncThunk<
  { accessToken: string; refreshToken: string },
  void,
  { state: RootState; rejectValue: string }
>(
  'auth/refreshToken',
  async (_, { getState, rejectWithValue }) => {
    const refreshToken = await authStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (!refreshToken) {
      return rejectWithValue('No refresh token');
    }
    try {
      const { url } = ENDPOINTS.AUTH.REFRESH_TOKEN;
      const response = await apiClient.post<{
        accessToken: string;
        refreshToken: string;
        user?: UserProfileResponseDto;
      }>(url, { refreshToken });
      const { accessToken, refreshToken: newRefreshToken } = response.data;
      await authStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, String(accessToken ?? ''));
      await authStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, String(newRefreshToken ?? ''));
      return { accessToken, refreshToken: newRefreshToken };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[auth/refreshTokenThunk] failed', { message: msg });
      return rejectWithValue(msg);
    }
  }
);

export const logoutThunk = createAsyncThunk<void, void, { state: RootState }>(
  'auth/logout',
  async (_, { dispatch }) => {
    try {
      await unregisterPushDeviceBeforeLogout();
      const { url } = ENDPOINTS.AUTH.LOGOUT;
      await apiClient.post(url, {});
    } catch {
      // Best effort — logout local même si l'API échoue
    } finally {
      await authStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      await authStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      await authStorage.removeItem(STORAGE_KEYS.ACCOUNT_TYPE);
      dispatch(authSlice.actions.logout());
    }
  }
);

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{
        accessToken: string;
        refreshToken: string;
        user: UserProfileResponseDto;
      }>
    ) => {
      const { accessToken, refreshToken, user } = action.payload;
      state.accessToken = accessToken;
      state.refreshToken = refreshToken;
      state.currentUser = mapDtoToCurrentUser(user);
      state.isAuthenticated = true;
      state.error = null;
    },
    logout: (state) => {
      state.accessToken = null;
      state.refreshToken = null;
      state.currentUser = null;
      state.isAuthenticated = false;
      state.error = null;
    },
    updateUserScore: (state, action: PayloadAction<{ kelembScore: number }>) => {
      if (state.currentUser) {
        state.currentUser.kelembScore = action.payload.kelembScore;
        state.currentUser.scoreLevel = computeScoreLevel(action.payload.kelembScore);
      }
    },
    setKycStatus: (
      state,
      action: PayloadAction<{ kycStatus: UserProfileResponseDto['kycStatus'] }>
    ) => {
      if (state.currentUser) {
        state.currentUser.kycStatus = action.payload.kycStatus;
      }
    },
    updateUserProfile: (
      state,
      action: PayloadAction<Partial<NonNullable<AuthState['currentUser']>>>
    ) => {
      if (state.currentUser) {
        Object.assign(state.currentUser, action.payload);
        if (action.payload.kelembScore !== undefined) {
          state.currentUser.scoreLevel = computeScoreLevel(action.payload.kelembScore);
        }
      }
    },
    setAuth: (
      state,
      action: PayloadAction<{
        user: UserProfileResponseDto | { id: string; uid?: string; phone?: string; kycStatus?: string; accountType?: AccountType };
        accessToken: string;
        refreshToken: string;
      }>
    ) => {
      const { accessToken, refreshToken, user } = action.payload;
      state.accessToken = accessToken;
      state.refreshToken = refreshToken;
      const dto = user as UserProfileResponseDto;
      if (dto.uid && dto.fullName !== undefined) {
        state.currentUser = mapDtoToCurrentUser(dto);
      } else {
        state.currentUser = {
          uid: (dto as { uid?: string }).uid ?? (dto as { id: string }).id,
          phone: (dto as { phone?: string }).phone ?? '',
          fullName: '',
          role: 'USER',
          status: 'ACTIVE',
          kycStatus: ((dto as { kycStatus?: string }).kycStatus ?? 'PENDING') as UserProfileResponseDto['kycStatus'],
          accountType: ((dto as { accountType?: AccountType }).accountType ?? 'MEMBRE') as AccountType,
          kelembScore: 500,
          scoreLevel: 'ARGENT',
          tontinesCount: 0,
          activeAsMember: false,
          lastLoginAt: null,
          createdAt: new Date().toISOString(),
        };
      }
      state.isAuthenticated = true;
      state.error = null;
    },
    clearAuth: (state) => {
      state.accessToken = null;
      state.refreshToken = null;
      state.currentUser = null;
      state.isAuthenticated = false;
      state.error = null;
    },
    setAccountType: (state, action: PayloadAction<AccountType>) => {
      if (state.currentUser) {
        state.currentUser.accountType = action.payload;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.currentUser = mapDtoToCurrentUser(action.payload.user);
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload ?? null;
      })
      .addCase(refreshTokenThunk.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
      })
      .addCase(refreshTokenThunk.rejected, (state) => {
        state.accessToken = null;
        state.refreshToken = null;
        state.currentUser = null;
        state.isAuthenticated = false;
      });
  },
});

export const {
  setCredentials,
  logout,
  updateUserScore,
  setKycStatus,
  updateUserProfile,
  setAuth,
  setAccountType,
  clearAuth,
} = authSlice.actions;

// ── Sélecteurs ────────────────────────────────────────────
export const selectIsAuthenticated = (s: RootState) => s.auth.isAuthenticated;
export const selectCurrentUser = (s: RootState) => s.auth.currentUser;
export const selectUserUid = (s: RootState) => s.auth.currentUser?.uid ?? null;
export const selectKycStatus = (s: RootState) => s.auth.currentUser?.kycStatus ?? null;
export const selectAccountType = (s: RootState) => s.auth.currentUser?.accountType ?? null;
export const selectKelembScore = (s: RootState) => s.auth.currentUser?.kelembScore ?? 500;
export const selectScoreLevel = (s: RootState) => s.auth.currentUser?.scoreLevel ?? 'ARGENT';
export const selectAuthError = (s: RootState) => s.auth.error;
export const selectAuthIsLoading = (s: RootState) => s.auth.isLoading;
export const selectAccessToken = (s: RootState) => s.auth.accessToken;
export const selectUserPhone = (s: RootState) => s.auth.currentUser?.phone ?? null;
