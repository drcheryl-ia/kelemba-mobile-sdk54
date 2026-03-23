import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import { SplashScreenComponent } from '@/screens/auth/SplashScreen';
import { LoginScreenComponent } from '@/screens/auth/LoginScreen';
import { AdminPlaceholderScreen } from '@/screens/admin';
import {
  OtpVerificationScreen,
  PinSetupScreen,
} from '@/screens/auth';
import {
  CreateTontineScreen,
  TontineDetailsScreen,
  InviteMembersScreen,
  TontineRotationScreen,
  TontineTypeSelectionScreen,
  RotationReorderScreen,
  SwapRequestScreen,
  TontineContractSignatureScreen,
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
import { CyclePayoutScreen } from '@/screens/payouts/CyclePayoutScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => (
  <Stack.Navigator
    initialRouteName="Splash"
    screenOptions={{ headerShown: false }}
  >
    <Stack.Screen name="Splash" component={SplashScreenComponent} />
    <Stack.Screen name="Login" component={LoginScreenComponent} />
    <Stack.Screen
      name="OtpVerification"
      component={OtpVerificationScreen}
      options={{ headerShown: true, title: 'Vérification', headerBackTitle: '' }}
    />
    <Stack.Screen
      name="PinSetup"
      component={PinSetupScreen}
      options={{ headerShown: true, title: 'Configuration du PIN', headerBackTitle: '' }}
    />
    <Stack.Screen name="Auth" component={AuthStack} />
    <Stack.Screen name="Main" component={MainTabs} />
    <Stack.Screen name="Admin" component={AdminPlaceholderScreen} />
    <Stack.Screen
      name="TontineTypeSelectionScreen"
      component={TontineTypeSelectionScreen}
      options={{ headerShown: true, title: 'Nouvelle tontine', headerBackTitle: '' }}
    />
    <Stack.Screen name="CreateTontine" component={CreateTontineScreen} />
    <Stack.Screen name="TontineDetails" component={TontineDetailsScreen} />
    <Stack.Screen
      name="CyclePayoutScreen"
      component={CyclePayoutScreen}
      options={{ headerShown: false, presentation: 'modal' }}
    />
    <Stack.Screen
      name="PaymentScreen"
      component={PaymentScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="PaymentStatusScreen"
      component={PaymentStatusScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="InviteMembers"
      component={InviteMembersScreen}
      options={{ headerShown: true, title: 'Inviter des membres', headerBackTitle: '' }}
    />
    <Stack.Screen name="TontineRotation" component={TontineRotationScreen} />
    <Stack.Screen
      name="RotationReorderScreen"
      component={RotationReorderScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="SwapRequestScreen"
      component={SwapRequestScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="TontineContractSignature"
      component={TontineContractSignatureScreen}
      options={{ headerShown: true, title: 'Contrat de tontine', headerBackTitle: '' }}
    />
    <Stack.Screen
      name="SavingsCreateScreen"
      component={SavingsCreateScreen}
      options={{ headerShown: true, title: 'Nouvelle Épargne', headerBackTitle: '' }}
    />
    <Stack.Screen
      name="SavingsDetailScreen"
      component={SavingsDetailScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="SavingsDashboardScreen"
      component={SavingsDashboardScreen}
      options={{ headerShown: true, title: 'Tableau de bord', headerBackTitle: '' }}
    />
    <Stack.Screen
      name="SavingsBalanceScreen"
      component={SavingsBalanceScreen}
      options={{ headerShown: true, title: 'Mon Épargne', headerBackTitle: '' }}
    />
    <Stack.Screen
      name="SavingsContributeScreen"
      component={SavingsContributeScreen}
      options={{ headerShown: true, title: 'Verser', headerBackTitle: '' }}
    />
    <Stack.Screen
      name="SavingsWithdrawScreen"
      component={SavingsWithdrawScreen}
      options={{ headerShown: true, title: 'Retrait', headerBackTitle: '' }}
    />
  </Stack.Navigator>
);
