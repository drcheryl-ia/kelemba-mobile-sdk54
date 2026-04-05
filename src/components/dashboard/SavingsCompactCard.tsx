import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SavingsListItem } from '@/types/savings.types';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';
import { formatFcfaAmount } from '@/utils/formatters';

export interface SavingsCompactCardProps {
  item: SavingsListItem;
  onPress: () => void;
}

function parseLocalDay(iso: string): number {
  const ymd = String(iso).split('T')[0];
  const p = ymd.split('-').map(Number);
  if (p.length !== 3) return NaN;
  const [y, m, d] = p;
  return new Date(y, m - 1, d).getTime();
}

function daysUntilUnlock(unlockDate: string): number {
  const target = parseLocalDay(unlockDate);
  if (Number.isNaN(target)) return 0;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.ceil((target - today) / 86_400_000);
}

export const SavingsCompactCard: React.FC<SavingsCompactCardProps> = ({
  item,
  onPress,
}) => {
  const daysLeft = useMemo(() => daysUntilUnlock(item.unlockDate), [item.unlockDate]);
  const available = daysLeft <= 0;

  const a11yLabel = useMemo(() => {
    const solde = `${formatFcfaAmount(item.personalBalance)} FCFA`;
    if (available) {
      return `${item.name}, épargne, solde ${solde}, disponible`;
    }
    return `${item.name}, épargne, solde ${solde}, déblocage dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`;
  }, [available, daysLeft, item.name, item.personalBalance]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.94 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
    >
      <View style={styles.iconWrap}>
        <Ionicons
          name="hourglass-outline"
          size={22}
          color={COLORS.accentDark}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>
      <View style={styles.mid}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.balanceLine}>
          Mon solde :{' '}
          <Text style={styles.balanceVal}>
            {formatFcfaAmount(item.personalBalance)} FCFA
          </Text>
        </Text>
      </View>
      <View style={styles.right}>
        {available ? (
          <View style={styles.badgeAvail}>
            <Text style={styles.badgeAvailText}>Disponible</Text>
          </View>
        ) : (
          <>
            <Text style={styles.debloq}>Déblocage dans</Text>
            <Text style={styles.days}>
              {daysLeft} jour{daysLeft > 1 ? 's' : ''}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mid: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  balanceLine: {
    fontSize: 11,
    color: COLORS.gray500,
  },
  balanceVal: {
    color: COLORS.accentDark,
    fontWeight: '500',
  },
  right: {
    alignItems: 'flex-end',
  },
  debloq: {
    fontSize: 10,
    color: COLORS.gray500,
  },
  days: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.accentDark,
    marginTop: 2,
  },
  badgeAvail: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  badgeAvailText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primaryDark,
  },
});
