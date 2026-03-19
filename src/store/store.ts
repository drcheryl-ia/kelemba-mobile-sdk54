import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import { secureStorageAdapter } from './secureStorageAdapter';
import { authSlice } from './authSlice';
import { tontinesSlice } from './tontinesSlice';
import { uiSlice } from './uiSlice';
import { notificationsSlice } from './slices/notificationsSlice';

const rootReducer = combineReducers({
  auth: authSlice.reducer,
  tontines: tontinesSlice.reducer,
  ui: uiSlice.reducer,
  notifications: notificationsSlice.reducer,
});

function migrateAuthState(state: unknown): unknown {
  if (state && typeof state === 'object' && 'auth' in state) {
    const auth = (state as { auth: Record<string, unknown> }).auth;
    if (auth && 'user' in auth && !('currentUser' in auth)) {
      const user = auth.user as { id?: string; uid?: string; phone?: string; kycStatus?: string; accountType?: string } | null;
      return {
        ...state,
        auth: {
          accessToken: auth.accessToken,
          refreshToken: auth.refreshToken,
          currentUser: user
            ? {
                uid: user.uid ?? user.id ?? '',
                phone: user.phone ?? '',
                fullName: '',
                role: 'USER' as const,
                status: 'ACTIVE' as const,
                kycStatus: (user.kycStatus ?? 'PENDING') as import('@/types/user.types').UserProfileResponseDto['kycStatus'],
                accountType: (user.accountType ?? 'MEMBRE') as 'MEMBRE' | 'ORGANISATEUR',
                kelembScore: 500,
                scoreLevel: 'ARGENT' as const,
                tontinesCount: 0,
                activeAsMember: false,
                lastLoginAt: null,
                createdAt: new Date().toISOString(),
              }
            : null,
          isAuthenticated: auth.isAuthenticated ?? false,
          isLoading: false,
          error: null,
        },
      };
    }
  }
  return state;
}

const persistConfig = {
  key: 'root',
  storage: secureStorageAdapter,
  whitelist: ['auth'],
  blacklist: ['ui', 'notifications'],
  version: 2,
  migrate: (state: unknown) => Promise.resolve(migrateAuthState(state ?? {})) as Promise<unknown>,
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE', 'auth/login/fulfilled', 'auth/refreshToken/fulfilled'],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
