import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from './types';
import { ProfileScreen } from '@/screens/profile';
import { ScoreHistoryScreen } from '@/screens/score';
import { ChangePinScreen } from '@/screens/profile/ChangePinScreen';
import { KycUploadScreen, KycSuccessScreen } from '@/screens/kyc';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export const ProfileStack: React.FC = () => (
  <Stack.Navigator
    initialRouteName="Profile"
    screenOptions={{ headerShown: false }}
  >
    <Stack.Screen name="Profile" component={ProfileScreen} />
    <Stack.Screen name="ScoreHistory" component={ScoreHistoryScreen} />
    <Stack.Screen name="ChangePin" component={ChangePinScreen} />
    <Stack.Screen name="KycUpload" component={KycUploadScreen} />
    <Stack.Screen name="KycSuccess" component={KycSuccessScreen} />
  </Stack.Navigator>
);
