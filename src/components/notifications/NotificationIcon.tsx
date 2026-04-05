import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { NotificationType } from '@/types/notification.types';

const ICON_CONFIG: Record<
  NotificationType,
  { lib: 'ionicons' | 'material'; name: string; bg: string; color: string }
> = {
  PAYMENT_REMINDER: { lib: 'ionicons', name: 'alarm', bg: '#FFF3E0', color: '#F5A623' },
  PAYMENT_RECEIVED: { lib: 'ionicons', name: 'notifications', bg: '#FFF3E0', color: '#F5A623' },
  POT_AVAILABLE: { lib: 'material', name: 'party-popper', bg: '#E8F5E9', color: '#1A6B3C' },
  POT_DELAYED: { lib: 'ionicons', name: 'time', bg: '#FFF3E0', color: '#F5A623' },
  KYC_UPDATE: { lib: 'ionicons', name: 'shield-checkmark', bg: '#E3F2FD', color: '#0055A5' },
  TONTINE_INVITATION: { lib: 'ionicons', name: 'people', bg: '#E8F5E9', color: '#1A6B3C' },
  ROTATION_CHANGED: { lib: 'ionicons', name: 'swap-horizontal', bg: '#F3E5F5', color: '#9C27B0' },
  ROTATION_SWAP_REQUESTED: { lib: 'ionicons', name: 'swap-horizontal', bg: '#F3E5F5', color: '#9C27B0' },
  CASH_PENDING: { lib: 'ionicons', name: 'cash-outline', bg: '#E3F2FD', color: '#0055A5' },
  SAVINGS_REMINDER: { lib: 'ionicons', name: 'hourglass-outline', bg: '#E3F2FD', color: '#0055A5' },
  SAVINGS_MATURED: { lib: 'ionicons', name: 'wallet-outline', bg: '#E8F5E9', color: '#1A6B3C' },
  PENALTY_APPLIED: { lib: 'ionicons', name: 'warning', bg: '#FFEBEE', color: '#D0021B' },
  SCORE_UPDATE: { lib: 'ionicons', name: 'star', bg: '#E3F2FD', color: '#0055A5' },
  SYSTEM: { lib: 'ionicons', name: 'flash', bg: '#FFF9C4', color: '#F5A623' },
};

export interface NotificationIconProps {
  type: NotificationType;
}

export const NotificationIcon: React.FC<NotificationIconProps> = ({ type }) => {
  const config = ICON_CONFIG[type] ?? ICON_CONFIG.SYSTEM;

  return (
    <View style={[styles.container, { backgroundColor: config.bg }]}>
      {config.lib === 'ionicons' ? (
        <Ionicons
          name={config.name as keyof typeof Ionicons.glyphMap}
          size={22}
          color={config.color}
        />
      ) : (
        <MaterialCommunityIcons
          name={config.name as keyof typeof MaterialCommunityIcons.glyphMap}
          size={22}
          color={config.color}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
