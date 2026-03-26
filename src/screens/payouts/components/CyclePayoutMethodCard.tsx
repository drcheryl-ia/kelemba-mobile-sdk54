/**
 * Carte de sélection premium pour le versement cagnotte (organisateur).
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CyclePayoutPaymentMethod } from '@/types/cyclePayout';
import { spacing } from '@/theme/spacing';

const GREEN = '#1A6B3C';
const ORANGE = '#F5A623';
const TELECEL_RED = '#C62828';

type Theme = {
  accent: string;
  selectedBg: string;
  selectedBorderWidth: number;
  unselectedBorder: string;
  pillBg: string;
  iconCircleBg: string;
  iconColor: string;
  badgeBg: string;
  badgeText: string;
  titleSelected: string;
  titleIdle: string;
  subtitleSelected: string;
  subtitleIdle: string;
};

const THEMES: Record<CyclePayoutPaymentMethod, Theme> = {
  ORANGE_MONEY: {
    accent: ORANGE,
    selectedBg: '#FFF7E8',
    selectedBorderWidth: 2,
    unselectedBorder: '#E5E7EB',
    pillBg: '#FEF3E2',
    iconCircleBg: '#FEF3E2',
    iconColor: ORANGE,
    badgeBg: '#FFFBF0',
    badgeText: '#B45309',
    titleSelected: '#92400E',
    titleIdle: '#374151',
    subtitleSelected: '#78716C',
    subtitleIdle: '#9CA3AF',
  },
  TELECEL_MONEY: {
    accent: TELECEL_RED,
    selectedBg: '#FEF2F2',
    selectedBorderWidth: 2,
    unselectedBorder: '#E5E7EB',
    pillBg: '#FFFFFF',
    iconCircleBg: '#FFFFFF',
    iconColor: TELECEL_RED,
    badgeBg: '#FFEBEE',
    badgeText: '#B71C1C',
    titleSelected: '#7F1D1D',
    titleIdle: '#374151',
    subtitleSelected: '#78716C',
    subtitleIdle: '#9CA3AF',
  },
  CASH: {
    accent: GREEN,
    selectedBg: '#E8F5EE',
    selectedBorderWidth: 2,
    unselectedBorder: '#E5E7EB',
    pillBg: '#DCFCE7',
    iconCircleBg: '#E8F5EE',
    iconColor: GREEN,
    badgeBg: '#DCFCE7',
    badgeText: '#166534',
    titleSelected: '#14532D',
    titleIdle: '#374151',
    subtitleSelected: '#4B5563',
    subtitleIdle: '#9CA3AF',
  },
};

const ICONS: Record<
  CyclePayoutPaymentMethod,
  keyof typeof Ionicons.glyphMap
> = {
  ORANGE_MONEY: 'phone-portrait-outline',
  TELECEL_MONEY: 'phone-portrait-outline',
  CASH: 'wallet-outline',
};

export interface CyclePayoutMethodCardProps {
  method: CyclePayoutPaymentMethod;
  selected: boolean;
  title: string;
  subtitle: string;
  badge: string;
  onSelect: () => void;
  accessibilityHint?: string;
}

export const CyclePayoutMethodCard: React.FC<CyclePayoutMethodCardProps> = ({
  method,
  selected,
  title,
  subtitle,
  badge,
  onSelect,
  accessibilityHint,
}) => {
  const th = THEMES[method];
  const iconName = ICONS[method];

  const cardStyle: StyleProp<ViewStyle> = [
    styles.card,
    selected
      ? {
          backgroundColor: th.selectedBg,
          borderColor: th.accent,
          borderWidth: th.selectedBorderWidth,
          shadowOpacity: 0.12,
          elevation: 4,
        }
      : {
          backgroundColor: '#FFFFFF',
          borderColor: th.unselectedBorder,
          borderWidth: 1,
          shadowOpacity: 0.06,
          elevation: 2,
        },
  ];

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      android_ripple={{ color: `${th.accent}33` }}
      style={({ pressed }) => [cardStyle, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <View style={[styles.iconCircle, { backgroundColor: th.iconCircleBg }]}>
          <Ionicons
            name={iconName}
            size={22}
            color={selected ? th.iconColor : `${th.iconColor}99`}
          />
        </View>
        <View style={styles.center}>
          <Text
            style={[
              styles.title,
              { color: selected ? th.titleSelected : th.titleIdle },
            ]}
            numberOfLines={2}
          >
            {title}
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: selected ? th.subtitleSelected : th.subtitleIdle },
            ]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
          <View style={[styles.badge, { backgroundColor: th.badgeBg }]}>
            <Text style={[styles.badgeText, { color: th.badgeText }]}>{badge}</Text>
          </View>
        </View>
        <View style={styles.radioCol}>
          <Ionicons
            name={selected ? 'radio-button-on' : 'radio-button-off'}
            size={26}
            color={selected ? th.accent : '#D1D5DB'}
          />
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginBottom: spacing.sm + 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: spacing.minTouchTarget + 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.96,
    transform: [{ scale: 0.985 }],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    lineHeight: 18,
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  radioCol: {
    width: 32,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
