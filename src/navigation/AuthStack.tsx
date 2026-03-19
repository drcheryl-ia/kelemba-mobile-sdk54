import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from './types';
import { RegisterScreenComponent, AuthPlaceholderScreen } from '@/screens/auth';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthStack: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Register" component={RegisterScreenComponent} />
    <Stack.Screen name="ForgotPin" component={AuthPlaceholderScreen} />
  </Stack.Navigator>
);
