import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { UserProfileDto } from '@/api/types/api.types';
import { COLORS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/spacing';
import { ScoreGauge } from '@/components/dashboard/ScoreGauge';
import { SkeletonPulse } from '@/components/common/SkeletonPulse';

export interface DashboardHeaderProps {
  user: UserProfileDto | null;
  unreadCount: number;
  onNotifPress: () => void;
  onScorePress: () => void;
}

function getInitials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}

function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

const LIGHT_PULSE = 'rgba(255,255,255,0.22)';

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  user,
  unreadCount,
  onNotifPress,
  onScorePress,
}) => {
  const paddingTop =
    Platform.OS === 'android'
      ? (StatusBar.currentHeight ?? 0) + 12
      : 52;

  if (user == null) {
    return (
      <View style={[styles.wrap, { paddingTop }]}>
        <View style={styles.row1}>
          <SkeletonPulse
            width={40}
            height={40}
            borderRadius={20}
            baseColor={LIGHT_PULSE}
          />
          <View style={styles.centerBlock}>
            <SkeletonPulse width={80} height={10} borderRadius={4} baseColor={LIGHT_PULSE} />
          </View>
          <SkeletonPulse width={36} height={36} borderRadius={8} baseColor={LIGHT_PULSE} />
        </View>
        <View style={styles.gaugeSkeletonWrap}>
          <SkeletonPulse width="100%" height={12} borderRadius={6} baseColor={LIGHT_PULSE} />
        </View>
      </View>
    );
  }

  const fullName = user.fullName ?? '';
  const score = user.kelembScore ?? 0;

  const notifA11y =
    unreadCount > 0
      ? `Notifications, ${unreadCount} non lues`
      : 'Notifications, aucune non lue';

  return (
    <View style={[styles.wrap, { paddingTop }]}>
      <View style={styles.row1}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(fullName) || '?'}</Text>
        </View>
        <View style={styles.centerBlock}>
          <Text style={styles.bonjour}>Bonjour,</Text>
          <Text style={styles.firstName} numberOfLines={1}>
            {getFirstName(fullName) || '—'}
          </Text>
        </View>
        <Pressable
          onPress={onNotifPress}
          style={styles.notifBtn}
          accessibilityRole="button"
          accessibilityLabel={notifA11y}
        >
          <Ionicons
            name="notifications-outline"
            size={20}
            color={COLORS.white}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          {unreadCount > 0 ? <View style={styles.dot} /> : null}
        </Pressable>
      </View>
      <ScoreGauge score={score} onPress={onScorePress} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  row1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  gaugeSkeletonWrap: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: 'stretch',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  centerBlock: {
    flex: 1,
    marginHorizontal: 12,
    minWidth: 0,
    justifyContent: 'center',
  },
  bonjour: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 1,
  },
  firstName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  notifBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.secondary,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
});
