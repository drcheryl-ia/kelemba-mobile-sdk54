import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';

export type BadgeVariant =
  | 'active'
  | 'draft'
  | 'pending'
  | 'completed'
  | 'danger'
  | 'info';

export interface KelembaBadgeProps {
  label: string;
  variant: BadgeVariant;
  size?: 'sm' | 'md';
}

const VARIANT_STYLES: Record<
  BadgeVariant,
  { backgroundColor: string; color: string }
> = {
  active: { backgroundColor: COLORS.primaryLight, color: COLORS.primaryDark },
  draft: { backgroundColor: COLORS.secondaryBg, color: COLORS.secondaryText },
  pending: { backgroundColor: COLORS.gray100, color: COLORS.gray700 },
  completed: { backgroundColor: COLORS.gray200, color: COLORS.gray700 },
  danger: { backgroundColor: COLORS.dangerLight, color: COLORS.dangerText },
  info: { backgroundColor: COLORS.accentLight, color: COLORS.accentDark },
};

const SIZE_STYLES = {
  sm: {
    fontSize: 9,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  md: {
    fontSize: 11,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
} as const;

export const KelembaBadge: React.FC<KelembaBadgeProps> = ({
  label,
  variant,
  size = 'sm',
}) => {
  const v = VARIANT_STYLES[variant];
  const s = SIZE_STYLES[size];
  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: v.backgroundColor,
          paddingVertical: s.paddingVertical,
          paddingHorizontal: s.paddingHorizontal,
          borderRadius: RADIUS.pill,
        },
      ]}
    >
      <Text style={[styles.text, { color: v.color, fontSize: s.fontSize }]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '600',
  },
});
