import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '@/theme/colors';
import { formatFcfa } from '@/utils/formatters';
import type { PaymentHistoryEntry } from '@/types/payments.types';

export interface PaymentHistoryItemProps {
  entry: PaymentHistoryEntry;
  onPress: () => void;
}

function methodLabel(
  method: PaymentHistoryEntry['method']
): string {
  switch (method) {
    case 'ORANGE_MONEY':
      return 'Orange Money';
    case 'TELECEL_MONEY':
      return 'Telecel Money';
    case 'CASH':
      return 'Espèces';
    case 'SYSTEM':
      return 'Système';
  }
}

const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export const PaymentHistoryItem: React.FC<PaymentHistoryItemProps> = ({
  entry,
  onPress,
}) => {
  const total = Math.round(entry.amount + entry.penaltyAmount);
  const dotColor = useMemo(() => {
    switch (entry.entryType) {
      case 'PAYMENT':
        return COLORS.primary;
      case 'PENALTY':
        return COLORS.dangerText;
      case 'CASH_VALIDATED':
        return COLORS.secondaryText;
      default:
        return COLORS.gray500;
    }
  }, [entry.entryType]);

  const amountColor = useMemo(() => {
    switch (entry.entryType) {
      case 'PAYMENT':
      case 'CASH_VALIDATED':
        return COLORS.primaryDark;
      case 'PENALTY':
        return COLORS.dangerText;
      default:
        return COLORS.gray700;
    }
  }, [entry.entryType]);

  const paidAt = useMemo(() => {
    const d = new Date(entry.paidAt);
    if (Number.isNaN(d.getTime())) return '—';
    return dateTimeFmt.format(d);
  }, [entry.paidAt]);

  const sub = useMemo(() => {
    const parts = [
      `Cycle ${entry.cycleNumber}`,
      methodLabel(entry.method),
    ];
    if (entry.externalRef != null && entry.externalRef.trim() !== '') {
      parts.push(`REF ${entry.externalRef}`);
    }
    return parts.join(' · ');
  }, [entry.cycleNumber, entry.externalRef, entry.method]);

  const amountLabel = `−${formatFcfa(total)}`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <View style={styles.center}>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {entry.tontineName}
        </Text>
        <Text style={styles.sub} numberOfLines={2}>
          {sub}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: amountColor }]}>{amountLabel}</Text>
        <Text style={styles.date}>{paidAt}</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: COLORS.white,
  },
  pressed: {
    opacity: 0.92,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  center: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  sub: {
    fontSize: 10,
    color: COLORS.gray500,
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'right',
  },
  date: {
    fontSize: 10,
    color: COLORS.gray500,
    marginTop: 2,
    textAlign: 'right',
  },
});
