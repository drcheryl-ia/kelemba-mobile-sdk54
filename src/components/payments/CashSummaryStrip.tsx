import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/spacing';

export interface CashSummaryStripProps {
  pendingCount: number;
  approvedThisMonth: number;
  rejectedThisMonth: number;
}

export const CashSummaryStrip: React.FC<CashSummaryStripProps> = ({
  pendingCount,
  approvedThisMonth,
  rejectedThisMonth,
}) => {
  const p = Math.max(0, Math.round(pendingCount));
  const a = Math.max(0, Math.round(approvedThisMonth));
  const r = Math.max(0, Math.round(rejectedThisMonth));

  return (
    <View style={styles.wrap}>
      <View style={styles.cell}>
        <Text style={styles.label}>En attente</Text>
        <Text style={styles.valueSecondary}>{p}</Text>
      </View>
      <View style={styles.sep} />
      <View style={styles.cell}>
        <Text style={styles.label}>Validés (mois)</Text>
        <Text style={styles.valueApproved}>{a}</Text>
      </View>
      <View style={styles.sep} />
      <View style={styles.cell}>
        <Text style={styles.label}>Refusés (mois)</Text>
        <Text style={styles.valueRejected}>{r}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    marginBottom: 14,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  cell: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sep: {
    width: 0.5,
    backgroundColor: COLORS.gray200,
    alignSelf: 'stretch',
  },
  label: {
    fontSize: 10,
    color: COLORS.gray500,
    marginBottom: 4,
    textAlign: 'center',
  },
  valueSecondary: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.secondaryText,
  },
  valueApproved: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.primaryDark,
  },
  valueRejected: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.dangerText,
  },
});
