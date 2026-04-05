import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/spacing';
import { formatFcfa } from '@/utils/formatters';

export interface PaymentSummaryStripProps {
  paidThisMonth: number;
  pendingTotal: number;
  penaltiesThisMonth: number;
}

export const PaymentSummaryStrip: React.FC<PaymentSummaryStripProps> = ({
  paidThisMonth,
  pendingTotal,
  penaltiesThisMonth,
}) => {
  const merged =
    pendingTotal === 0 && penaltiesThisMonth === 0;

  const paid = Math.round(paidThisMonth);
  const pending = Math.round(pendingTotal);
  const pen = Math.round(penaltiesThisMonth);

  if (merged) {
    return (
      <View style={styles.wrap}>
        <View style={styles.cell}>
          <Text style={styles.label}>Payé ce mois</Text>
          <Text style={styles.valuePrimary}>{formatFcfa(paid)}</Text>
        </View>
        <View style={styles.sep} />
        <View style={[styles.cell, styles.cellMerged]}>
          <Text style={styles.valueMerged} numberOfLines={2}>
            Aucune obligation · À jour
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.cell}>
        <Text style={styles.label}>Payé ce mois</Text>
        <Text style={styles.valuePrimary}>{formatFcfa(paid)}</Text>
      </View>
      <View style={styles.sep} />
      <View style={styles.cell}>
        <Text style={styles.label}>En attente</Text>
        <Text style={styles.valueSecondary}>{formatFcfa(pending)}</Text>
      </View>
      <View style={styles.sep} />
      <View style={styles.cell}>
        <Text style={styles.label}>Pénalités</Text>
        <Text style={styles.valueDanger}>{formatFcfa(pen)}</Text>
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
  cellMerged: {
    flex: 2,
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
  valuePrimary: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.primary,
    textAlign: 'center',
  },
  valueSecondary: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.secondaryText,
    textAlign: 'center',
  },
  valueDanger: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.dangerText,
    textAlign: 'center',
  },
  valueMerged: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.primaryDark,
    textAlign: 'center',
  },
});
