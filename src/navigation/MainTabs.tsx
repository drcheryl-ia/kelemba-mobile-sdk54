import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import type { MainTabParamList } from './types';
import type { RootState } from '@/store/store';
import { selectAccountType } from '@/store/authSlice';
import { useUnreadCountSync } from '@/hooks/useUnreadCountSync';
import { DashboardScreen } from '@/screens/main';
import { TontineListScreen } from '@/screens/tontines';
import { ContributionHistoryScreen } from '@/screens/payments';
import { NotificationsScreen } from '@/screens/notifications';
import { ProfileStack } from './ProfileStack';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<
  string,
  { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }
> = {
  Dashboard: { active: 'home', inactive: 'home-outline' },
  Tontines: { active: 'people', inactive: 'people-outline' },
  Payments: { active: 'wallet', inactive: 'wallet-outline' },
  Notifs: { active: 'notifications', inactive: 'notifications-outline' },
  Profile: { active: 'person-circle', inactive: 'person-circle-outline' },
};

export const MainTabs: React.FC = () => {
  useUnreadCountSync();
  const unreadCount = useSelector((s: RootState) => s.notifications.unreadCount);
  const accountType = useSelector(selectAccountType);

  if (accountType === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A6B3C" />
      </View>
    );
  }

  return (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: '#1A6B3C',
      tabBarInactiveTintColor: '#9CA3AF',
      tabBarBadge:
        route.name === 'Notifs' && unreadCount > 0 ? unreadCount : undefined,
      tabBarBadgeStyle: { backgroundColor: '#D0021B' },

      tabBarStyle: {
        position: 'absolute',
        backgroundColor: '#FFFFFF',
        borderTopWidth: 0,
        marginHorizontal: 16,
        marginBottom: 20,
        borderRadius: 20,
        height: 64,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.10,
        shadowRadius: 12,
        elevation: 8,
        paddingBottom: 0,
      },

      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '500',
        marginTop: 0,
        includeFontPadding: false,
      },

      tabBarIconStyle: {
        marginBottom: 0,
      },

      tabBarIcon: ({ focused, color }) => {
        const icons = TAB_ICONS[route.name];
        const iconName = icons
          ? focused
            ? icons.active
            : icons.inactive
          : 'ellipse-outline';
        return <Ionicons name={iconName} size={24} color={color} />;
      },
    })}
  >
    <Tab.Screen
      name="Dashboard"
      component={DashboardScreen}
      options={{ title: 'Accueil' }}
    />
    <Tab.Screen name="Tontines" component={TontineListScreen} />
    <Tab.Screen
      name="Payments"
      component={ContributionHistoryScreen}
      options={{ title: 'Paiements' }}
    />
    <Tab.Screen
      name="Notifs"
      component={
        NotificationsScreen as React.ComponentType<Record<string, unknown>>
      }
      options={{ title: 'Notifs' }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileStack}
      options={{ title: 'Profil' }}
    />
  </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
});
