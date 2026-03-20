import '@/config/env';
import { installErrorFileLogger } from '@/utils/errorFileLogger';
import { startOfflineQueueListener } from '@/utils/offlineQueue';

installErrorFileLogger();
const unsubscribeOfflineQueue = startOfflineQueueListener();

import React, { useEffect, useState } from 'react';
import './src/i18n';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CommonActions } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { store, persistor } from '@/store/store';
import { logout } from '@/store/authSlice';
import { AppNavigator } from '@/navigation/AppNavigator';
import { useAccountTypeRehydration } from '@/hooks/useAccountTypeRehydration';
import { authEventEmitter } from '@/api/authEventEmitter';
import { logger } from '@/utils/logger';
import { colors } from '@/theme/colors';

SplashScreen.preventAutoHideAsync();

import { navigationRef } from '@/navigation/navigationRef';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 120 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
      networkMode: 'offlineFirst',
    },
  },
});

function AppContent() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await SplashScreen.hideAsync();
      } finally {
        setAppReady(true);
      }
    };
    init();
    return () => unsubscribeOfflineQueue();
  }, []);

  useEffect(() => {
    const handleReset = () => {
      store.dispatch(logout());
      if (navigationRef.isReady()) {
        navigationRef.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: 'AuthStack' }] })
        );
      }
    };
    const unsubSession = authEventEmitter.on('SESSION_EXPIRED', handleReset);
    const unsubLogout = authEventEmitter.on('LOGOUT', handleReset);
    return () => {
      unsubSession();
      unsubLogout();
    };
  }, []);

  if (!appReady) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.white} />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <AppWithRehydration />
      </PersistGate>
    </Provider>
  );
}

function AppWithRehydration() {
  useAccountTypeRehydration();
  return (
    <QueryClientProvider client={queryClient}>
      <>
        <AppNavigator />
        <StatusBar style="auto" />
      </>
    </QueryClientProvider>
  );
}

export default function App() {
  try {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppContent />
      </GestureHandlerRootView>
    );
  } catch (err: unknown) {
    logger.error('App init error', { message: err instanceof Error ? err.message : String(err) });
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.error}>
          <Text>Erreur init</Text>
        </View>
      </GestureHandlerRootView>
    );
  }
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.splashBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
});
