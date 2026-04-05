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
import { LoginScreenComponent } from '@/screens/auth/LoginScreen';
import { RegisterScreenComponent } from '@/screens/auth/RegisterScreen';
import { AccountTypeChoiceScreen } from '@/screens/auth/AccountTypeChoiceScreen';
import { JoinTontineScreen } from '@/screens/auth/JoinTontineScreen';
import { OtpVerificationScreen, PinSetupScreen, AuthPlaceholderScreen } from '@/screens/auth';
import { KycPendingScreen } from '@/screens/kyc/KycPendingScreen';
import { KycUploadScreen } from '@/screens/kyc/KycUploadScreen';
import { KycSuccessScreen } from '@/screens/kyc/KycSuccessScreen';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';
import { DashboardScreen } from '@/screens/main';
import { useUnreadCountSync } from '@/hooks/useUnreadCountSync';
import { useOrganizerCashPendingBadgeCount } from '@/hooks/useOrganizerCashPending';
import { useFcmRegistration } from '@/hooks/useFcmRegistration';
import { useNotificationHandler } from '@/hooks/useNotificationHandler';
import { TontineListScreen } from '@/screens/tontines';
import { ContributionHistoryScreen } from '@/screens/payments';
import { NotificationsScreen } from '@/screens/notifications';
import Svg, { Path, Polyline, Line } from 'react-native-svg';
import ReportScreen from '@/screens/report/ReportScreen';
import { ProfileStack } from '@/navigation/ProfileStack';
import {
  CreateTontineScreen,
  TontineDetailsScreen,
  InviteMembersScreen,
  TontineRotationScreen,
  TontineTypeSelectionScreen,
  RotationReorderScreen,
  TontineActivationScreen,
  SwapRequestScreen,
  TontineContractSignatureScreen,
} from '@/screens/tontines';
import {
  PaymentScreen,
  PaymentStatusScreen,
  PaymentReminderScreen,
  CashProofScreen,
  CashValidationScreen,
  PaymentHistoryScreen,
} from '@/screens/payments';
import { CyclePayoutScreen } from '@/screens/payouts/CyclePayoutScreen';
import {
  registerFcmTapHandler,
  handleInitialNotification,
} from '@/services/fcmNotificationHandler';
import {
  SavingsListScreen,
  SavingsDetailScreen,
  SavingsDashboardScreen,
  SavingsBalanceScreen,
  SavingsMyBalanceScreen,
  SavingsPeriodsScreen,
  SavingsContributeScreen,
  SavingsWithdrawScreen,
} from '@/screens/savings';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { getNavigationTheme, lightTheme, darkTheme } from '@/theme/appTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getStateFromPath as getStateFromPathDefault } from '@react-navigation/native';
import { store } from '@/store/store';

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
      /** kelemba://join/:token · https://kelemba.app/join/:token — routage métier dans getStateFromPath */
      AuthStack: {
        screens: {
          JoinTontine: 'join/:token',
        },
      },
      MainTabs: {
        screens: {
          Tontines: 'tontines',
        },
      },
      TontineDetails: 'tontines/:tontineUid',
      KycUpload: 'kyc',
    },
  },
  getStateFromPath(
    path: string,
    options: Parameters<typeof getStateFromPathDefault>[1]
  ) {
    const normalized = path.replace(/^\//, '');
    const joinMatch = normalized.match(/^join\/([^/?]+)/);
    if (!joinMatch) {
      return getStateFromPathDefault(path, options);
    }
    const token = decodeURIComponent(joinMatch[1]);
    const { auth } = store.getState();
    if (auth.isAuthenticated && token) {
      return {
        routes: [
          {
            name: 'TontineContractSignature' as const,
            params: {
              mode: 'JOIN_REQUEST' as const,
              tontineUid: token,
            },
          },
        ],
      };
    }
    return {
      routes: [
        {
          name: 'AuthStack' as const,
          state: {
            routes: [{ name: 'JoinTontine' as const, params: { token } }],
            index: 0,
          },
        },
      ],
    };
  },
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const KycStack = createNativeStackNavigator<KycStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

function AuthStackNavigator() {
  return (
    <AuthStack.Navigator
      initialRouteName="Login"
      screenOptions={{ headerShown: false }}
    >
      <AuthStack.Screen name="Login" component={LoginScreenComponent} />
      <AuthStack.Screen
        name="AccountTypeChoice"
        component={AccountTypeChoiceScreen}
      />
      <AuthStack.Screen name="JoinTontine" component={JoinTontineScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreenComponent} />
      <AuthStack.Screen name="ForgotPin" component={AuthPlaceholderScreen} />
      <AuthStack.Screen
        name="OtpVerification"
        component={OtpVerificationScreen}
        options={{ headerShown: false }}
      />
      <AuthStack.Screen
        name="PinSetup"
        component={PinSetupScreen}
        options={{ headerShown: false }}
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
  const cashPendingCount = useOrganizerCashPendingBadgeCount();
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
          route.name === 'Payments' && cashPendingCount > 0 ? cashPendingCount : undefined,
        tabBarBadgeStyle: { backgroundColor: t.danger },
        tabBarLabel:
          route.name === 'Payments' && cashPendingCount > 0
            ? `Paiements (${cashPendingCount}⏳)`
            : route.name === 'Dashboard'
              ? 'Accueil'
              : route.name === 'Tontines'
                ? 'Tontines'
                : route.name === 'Payments'
                  ? 'Paiements'
                  : route.name === 'Report'
                    ? 'Rapport'
                    : route.name === 'Profile'
                      ? 'Compte'
                      : route.name,
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
          if (route.name === 'Report') {
            const stroke = focused ? '#1A6B3C' : '#888780';
            return (
              <View
                style={{
                  width: TAB_ICON_SIZE,
                  height: TAB_ICON_SIZE,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                    stroke={stroke}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Polyline
                    points="14 2 14 8 20 8"
                    stroke={stroke}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Line
                    x1="16"
                    y1="13"
                    x2="8"
                    y2="13"
                    stroke={stroke}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                  <Line
                    x1="16"
                    y1="17"
                    x2="8"
                    y2="17"
                    stroke={stroke}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </Svg>
              </View>
            );
          }
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            Dashboard: focused ? 'home' : 'home-outline',
            Tontines: focused ? 'people' : 'people-outline',
            Payments: focused ? 'wallet' : 'wallet-outline',
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
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Tontines" component={TontineListScreen} />
      <Tab.Screen name="Payments" component={ContributionHistoryScreen} />
      <Tab.Screen name="Report" component={ReportScreen} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}

export const AppNavigator: React.FC = () => {
  const dispatch = useDispatch();
  const [bootResult, setBootResult] = useState<ResolveResult | null>(null);
  const colorScheme = useColorScheme();
  const navTheme = getNavigationTheme(colorScheme === 'dark' ? 'dark' : 'light');

  useFcmRegistration();
  useNotificationHandler(navigationRef);

  useEffect(() => {
    void handleInitialNotification(navigationRef);
    const cleanup = registerFcmTapHandler(navigationRef);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- enregistrement unique au montage
  }, []);

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
        <RootStack.Screen
          name="NotificationsScreen"
          component={NotificationsScreen}
          options={{ headerShown: false, presentation: 'card' }}
        />
        <RootStack.Screen name="TontineTypeSelectionScreen" component={TontineTypeSelectionScreen} />
        <RootStack.Screen name="CreateTontine" component={CreateTontineScreen} />
        <RootStack.Screen name="TontineDetails" component={TontineDetailsScreen} />
        <RootStack.Screen
          name="CyclePayoutScreen"
          component={CyclePayoutScreen}
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <RootStack.Screen
          name="PaymentReminderScreen"
          component={PaymentReminderScreen}
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <RootStack.Screen
          name="PaymentScreen"
          component={PaymentScreen}
          options={{ presentation: 'modal' }}
        />
        <RootStack.Screen name="PaymentStatusScreen" component={PaymentStatusScreen} />
        <RootStack.Screen
          name="PaymentHistory"
          component={PaymentHistoryScreen}
          options={{ headerShown: false, presentation: 'card' }}
        />
        <RootStack.Screen
          name="CashProofScreen"
          component={CashProofScreen}
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <RootStack.Screen
          name="CashValidationScreen"
          component={CashValidationScreen}
          options={{ headerShown: false }}
        />
        <RootStack.Screen name="InviteMembers" component={InviteMembersScreen} />
        <RootStack.Screen name="TontineRotation" component={TontineRotationScreen} />
        <RootStack.Screen name="RotationReorderScreen" component={RotationReorderScreen} />
        <RootStack.Screen
          name="TontineActivationScreen"
          component={TontineActivationScreen}
          options={{ headerShown: false }}
        />
        <RootStack.Screen name="SwapRequestScreen" component={SwapRequestScreen} />
        <RootStack.Screen
          name="TontineContractSignature"
          component={TontineContractSignatureScreen}
          options={{ headerShown: true, title: 'Contrat de tontine', headerBackTitle: '' }}
        />
        <RootStack.Screen name="SavingsListScreen" component={SavingsListScreen} />
        <RootStack.Screen name="SavingsDetailScreen" component={SavingsDetailScreen} />
        <RootStack.Screen name="SavingsDashboardScreen" component={SavingsDashboardScreen} />
        <RootStack.Screen name="SavingsBalanceScreen" component={SavingsBalanceScreen} />
        <RootStack.Screen name="SavingsMyBalanceScreen" component={SavingsMyBalanceScreen} />
        <RootStack.Screen name="SavingsPeriodsScreen" component={SavingsPeriodsScreen} />
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
