/**
 * Navigateur principal — boot, AuthStack, KycStack, MainTabs, RootStack.
 * Détermine la route initiale via SecureStore + GET /users/me.
 */
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { navigationRef } from '@/navigation/navigationRef';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch } from 'react-redux';
import * as SplashScreen from 'expo-splash-screen';
import { authStorage, STORAGE_KEYS } from '@/storage/authStorage';
import { fetchCurrentUser } from '@/api/usersApi';
import { loginWithRefreshToken } from '@/api/authApi';
import { setCredentials, logout } from '@/store/authSlice';
import { logger } from '@/utils/logger';
import type {
  RootStackParamList,
  AuthStackParamList,
  KycStackParamList,
  MainTabParamList,
} from '@/navigation/types';
import type { UserProfileDto } from '@/api/types/api.types';
import { SplashScreenComponent } from '@/screens/auth/SplashScreen';
import { OnboardingScreen } from '@/screens/auth/OnboardingScreen';
import { LoginScreenComponent } from '@/screens/auth/LoginScreen';
import { RegisterScreenComponent } from '@/screens/auth/RegisterScreen';
import { OtpVerificationScreen, PinSetupScreen, AuthPlaceholderScreen } from '@/screens/auth';
import { KycPendingScreen } from '@/screens/kyc/KycPendingScreen';
import { KycUploadScreen } from '@/screens/kyc/KycUploadScreen';
import { KycSuccessScreen } from '@/screens/kyc/KycSuccessScreen';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';
import { DashboardScreen } from '@/screens/main';
import { useUnreadCountSync } from '@/hooks/useUnreadCountSync';
import { TontineListScreen } from '@/screens/tontines';
import { ContributionHistoryScreen } from '@/screens/payments';
import { NotificationsScreen } from '@/screens/notifications';
import { ProfileStack } from '@/navigation/ProfileStack';
import {
  CreateTontineScreen,
  TontineDetailsScreen,
  InviteMembersScreen,
  TontineRotationScreen,
  TontineTypeSelectionScreen,
  RotationReorderScreen,
  SwapRequestScreen,
} from '@/screens/tontines';
import { PaymentScreen, PaymentStatusScreen } from '@/screens/payments';
import {
  SavingsCreateScreen,
  SavingsDetailScreen,
  SavingsDashboardScreen,
  SavingsBalanceScreen,
  SavingsContributeScreen,
  SavingsWithdrawScreen,
} from '@/screens/savings';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { getNavigationTheme, lightTheme, darkTheme } from '@/theme/appTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type AppRoute = 'AUTH' | 'KYC' | 'MAIN';


interface ResolveResult {
  route: AppRoute;
  user?: UserProfileDto;
}

async function resolveInitialRoute(dispatch: ReturnType<typeof useDispatch>): Promise<ResolveResult> {
  const accessToken = await authStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const refreshToken = await authStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

  if (!accessToken && !refreshToken) {
    dispatch(logout());
    return { route: 'AUTH' };
  }

  try {
    if (!accessToken && refreshToken) {
      await loginWithRefreshToken();
    }

    const user = await fetchCurrentUser();
    dispatch(
      setCredentials({
        user: user as import('@/types/user.types').UserProfileResponseDto,
        accessToken: (await authStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)) ?? '',
        refreshToken: (await authStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)) ?? '',
      })
    );

    if (user.status === 'BANNED' || user.status === 'SUSPENDED') {
      dispatch(logout());
      await authStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      await authStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      await authStorage.removeItem(STORAGE_KEYS.ACCOUNT_TYPE);
      return { route: 'AUTH' };
    }

    if (user.kycStatus !== 'VERIFIED') {
      return { route: 'KYC', user };
    }

    return { route: 'MAIN' };
  } catch (err: unknown) {
    logger.error('[AppNavigator] resolveInitialRoute failed', {
      message: err instanceof Error ? err.message : String(err),
    });
    if (refreshToken) {
      try {
        await loginWithRefreshToken();
        const user = await fetchCurrentUser();
        dispatch(
          setCredentials({
            user: user as import('@/types/user.types').UserProfileResponseDto,
            accessToken: (await authStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)) ?? '',
            refreshToken: (await authStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)) ?? '',
          })
        );
        if (user.kycStatus !== 'VERIFIED') return { route: 'KYC', user };
        return { route: 'MAIN' };
      } catch {
        await authStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        await authStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        await authStorage.removeItem(STORAGE_KEYS.ACCOUNT_TYPE);
      }
    }
    dispatch(logout());
    return { route: 'AUTH' };
  }
}

const linking = {
  prefixes: ['kelemba://', 'https://kelemba.app'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Tontines: 'tontines',
        },
      },
      TontineDetails: 'tontines/:tontineUid',
      KycUpload: 'kyc',
    },
  },
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const KycStack = createNativeStackNavigator<KycStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

function AuthStackNavigator() {
  return (
    <AuthStack.Navigator
      initialRouteName="Splash"
      screenOptions={{ headerShown: false }}
    >
      <AuthStack.Screen name="Splash" component={SplashScreenComponent} />
      <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
      <AuthStack.Screen name="Login" component={LoginScreenComponent} />
      <AuthStack.Screen name="Register" component={RegisterScreenComponent} />
      <AuthStack.Screen name="ForgotPin" component={AuthPlaceholderScreen} />
      <AuthStack.Screen
        name="OtpVerification"
        component={OtpVerificationScreen}
        options={{ headerShown: true, title: 'Vérification', headerBackTitle: '' }}
      />
      <AuthStack.Screen
        name="PinSetup"
        component={PinSetupScreen}
        options={{ headerShown: true, title: 'Configuration du PIN', headerBackTitle: '' }}
      />
    </AuthStack.Navigator>
  );
}

function KycStackNavigator({ initialKycStatus }: { initialKycStatus?: string }) {
  const storeKycStatus = useSelector(
    (s: RootState) => s.auth.currentUser?.kycStatus
  );
  const kycStatus = initialKycStatus ?? storeKycStatus;
  const initialRouteName: keyof KycStackParamList =
    kycStatus === 'SUBMITTED' || kycStatus === 'UNDER_REVIEW'
      ? 'KycPending'
      : 'KycUpload';

  return (
    <KycStack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{ headerShown: false }}
    >
      <KycStack.Screen name="KycPending" component={KycPendingScreen} />
      <KycStack.Screen name="KycUpload" component={KycUploadScreen} />
      <KycStack.Screen name="KycSuccess" component={KycSuccessScreen} />
    </KycStack.Navigator>
  );
}

const TAB_BAR_HEIGHT = 64;
const TAB_ICON_SIZE = 24;
const TAB_LABEL_FONT_SIZE = 11;
const TAB_BAR_BOTTOM_OFFSET = 8;

function MainTabsNavigator() {
  useUnreadCountSync();
  const unreadCount = useSelector((s: RootState) => s.notifications.unreadCount);
  const insets = useSafeAreaInsets();
  const tabBarBottom = Math.max(insets.bottom - TAB_BAR_BOTTOM_OFFSET, 0);
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;
  const t = theme.colors;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: t.tabBarActive,
        tabBarInactiveTintColor: t.tabBarInactive,
        tabBarBadge:
          route.name === 'History' && unreadCount > 0 ? unreadCount : undefined,
        tabBarBadgeStyle: { backgroundColor: t.danger },
        tabBarShowLabel: true,
        tabBarShowIcon: true,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: t.tabBarBackground,
          borderTopWidth: 0,
          marginHorizontal: spacing.md,
          marginBottom: tabBarBottom,
          borderRadius: 20,
          height: TAB_BAR_HEIGHT,
          paddingBottom: 0,
          paddingHorizontal: spacing.sm,
          paddingTop: 0,
          shadowColor: t.black,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: theme.mode === 'dark' ? 0.3 : 0.1,
          shadowRadius: 12,
          elevation: 8,
        },
        tabBarItemStyle: {
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.xs,
          alignItems: 'center',
          justifyContent: 'center',
        },
        tabBarLabelStyle: {
          fontSize: TAB_LABEL_FONT_SIZE,
          fontWeight: '500',
          marginTop: 2,
          includeFontPadding: false,
        },
        tabBarIconStyle: {
          marginBottom: 2,
        },
        tabBarIcon: ({ focused, color }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            Dashboard: focused ? 'home' : 'home-outline',
            Tontines: focused ? 'people' : 'people-outline',
            Payments: focused ? 'wallet' : 'wallet-outline',
            History: focused ? 'notifications' : 'notifications-outline',
            Profile: focused ? 'person-circle' : 'person-circle-outline',
          };
          const iconColor = color ?? (focused ? t.iconActive : t.iconInactive);
          const iconName = icons[route.name] ?? 'ellipse';
          return (
            <View style={{ width: TAB_ICON_SIZE, height: TAB_ICON_SIZE, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons
                name={iconName}
                size={TAB_ICON_SIZE}
                color={iconColor}
              />
            </View>
          );
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarLabel: 'Accueil' }}
      />
      <Tab.Screen
        name="Tontines"
        component={TontineListScreen}
        options={{ tabBarLabel: 'Tontines' }}
      />
      <Tab.Screen
        name="Payments"
        component={ContributionHistoryScreen}
        options={{ tabBarLabel: 'Paiements' }}
      />
      <Tab.Screen
        name="History"
        component={NotificationsScreen}
        options={{ tabBarLabel: 'Notifs' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{ tabBarLabel: 'Compte' }}
      />
    </Tab.Navigator>
  );
}

export const AppNavigator: React.FC = () => {
  const dispatch = useDispatch();
  const [bootResult, setBootResult] = useState<ResolveResult | null>(null);
  const colorScheme = useColorScheme();
  const navTheme = getNavigationTheme(colorScheme === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await SplashScreen.hideAsync();
        const result = await resolveInitialRoute(dispatch);
        if (!cancelled) setBootResult(result);
      } catch {
        if (!cancelled) setBootResult({ route: 'AUTH' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  if (bootResult === null) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.white} />
      </View>
    );
  }

  const initialRouteName: keyof RootStackParamList =
    bootResult.route === 'AUTH'
      ? 'AuthStack'
      : bootResult.route === 'KYC'
        ? 'KycStack'
        : 'MainTabs';

  return (
    <NavigationContainer ref={navigationRef} linking={linking} theme={navTheme}>
      <RootStack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{ headerShown: false, presentation: 'card' }}
      >
        <RootStack.Screen name="AuthStack" component={AuthStackNavigator} />
        <RootStack.Screen name="KycStack">
          {() => (
            <KycStackNavigator
              initialKycStatus={
                bootResult.route === 'KYC' ? bootResult.user?.kycStatus : undefined
              }
            />
          )}
        </RootStack.Screen>
        <RootStack.Screen name="MainTabs" component={MainTabsNavigator} />
        <RootStack.Screen name="TontineTypeSelectionScreen" component={TontineTypeSelectionScreen} />
        <RootStack.Screen name="CreateTontine" component={CreateTontineScreen} />
        <RootStack.Screen name="TontineDetails" component={TontineDetailsScreen} />
        <RootStack.Screen
          name="PaymentScreen"
          component={PaymentScreen}
          options={{ presentation: 'modal' }}
        />
        <RootStack.Screen name="PaymentStatusScreen" component={PaymentStatusScreen} />
        <RootStack.Screen name="InviteMembers" component={InviteMembersScreen} />
        <RootStack.Screen name="TontineRotation" component={TontineRotationScreen} />
        <RootStack.Screen name="RotationReorderScreen" component={RotationReorderScreen} />
        <RootStack.Screen name="SwapRequestScreen" component={SwapRequestScreen} />
        <RootStack.Screen name="SavingsCreateScreen" component={SavingsCreateScreen} />
        <RootStack.Screen name="SavingsDetailScreen" component={SavingsDetailScreen} />
        <RootStack.Screen name="SavingsDashboardScreen" component={SavingsDashboardScreen} />
        <RootStack.Screen name="SavingsBalanceScreen" component={SavingsBalanceScreen} />
        <RootStack.Screen name="SavingsContributeScreen" component={SavingsContributeScreen} />
        <RootStack.Screen name="SavingsWithdrawScreen" component={SavingsWithdrawScreen} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.splashBackground ?? '#1A5C38',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
