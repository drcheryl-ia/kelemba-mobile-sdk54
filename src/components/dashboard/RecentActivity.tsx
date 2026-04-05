import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ActivityItem } from '@/types/dashboard.types';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';
import { formatFcfaAmount } from '@/utils/formatters';

export interface RecentActivityProps {
  items: ActivityItem[];
  onSeeAll: () => void;
}

export const RecentActivity: React.FC<RecentActivityProps> = ({
  items,
}) => {
  const rows = items.slice(0, 3);

  if (rows.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.empty}>Aucune activité récente</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {rows.map((it, index) => (
        <View key={it.id}>
          {index > 0 ? <View style={styles.sep} /> : null}
          <View
            style={styles.row}
            accessibilityRole="text"
            accessibilityLabel={
              it.amount != null
                ? `${it.description}, ${it.timestamp}, ${formatFcfaAmount(it.amount)}${it.amountSuffix ?? ''}`
                : `${it.description}, ${it.timestamp}`
            }
          >
            <View
              style={[styles.dot, { backgroundColor: it.dotColor }]}
              accessibilityElementsHidden
            />
            <View style={styles.textCol}>
              <Text style={styles.desc} numberOfLines={1} ellipsizeMode="tail">
                {it.description}
              </Text>
              <Text style={styles.time}>{it.timestamp}</Text>
            </View>
            {it.amount != null ? (
              <Text style={styles.amt}>
                {formatFcfaAmount(it.amount)}
                {it.amountSuffix ?? ''}
              </Text>
            ) : (
              <View style={styles.amtPlaceholder} />
            )}
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    overflow: 'hidden',
  },
  empty: {
    padding: 16,
    fontSize: 13,
    color: COLORS.gray500,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  sep: {
    height: 0.5,
    backgroundColor: COLORS.gray200,
    marginHorizontal: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 9999,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  desc: {
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  time: {
    fontSize: 10,
    color: COLORS.gray500,
    marginTop: 2,
  },
  amt: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textPrimary,
    textAlign: 'right',
    minWidth: 72,
  },
  amtPlaceholder: {
    minWidth: 72,
  },
});
