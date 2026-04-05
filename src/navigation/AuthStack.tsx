import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from './types';
import {
  RegisterScreenComponent,
  AuthPlaceholderScreen,
} from '@/screens/auth';
import { LoginScreenComponent } from '@/screens/auth/LoginScreen';
import { AccountTypeChoiceScreen } from '@/screens/auth/AccountTypeChoiceScreen';
import { JoinTontineScreen } from '@/screens/auth/JoinTontineScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthStack: React.FC = () => (
  <Stack.Navigator
    initialRouteName="Login"
    screenOptions={{ headerShown: false }}
  >
    <Stack.Screen name="Login" component={LoginScreenComponent} />
    <Stack.Screen
      name="AccountTypeChoice"
      component={AccountTypeChoiceScreen}
    />
    <Stack.Screen name="JoinTontine" component={JoinTontineScreen} />
    <Stack.Screen name="Register" component={RegisterScreenComponent} />
    <Stack.Screen name="ForgotPin" component={AuthPlaceholderScreen} />
  </Stack.Navigator>
);
