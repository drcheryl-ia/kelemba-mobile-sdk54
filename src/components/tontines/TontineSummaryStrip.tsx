import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';
import { formatFcfa } from '@/utils/formatters';

export interface TontineSummaryStripProps {
  activeCount: number;
  totalEngagedThisMonth: number;
  nextBeneficiaryCycleLabel: string | null;
}

export const TontineSummaryStrip: React.FC<TontineSummaryStripProps> = ({
  activeCount,
  totalEngagedThisMonth,
  nextBeneficiaryCycleLabel,
}) => {
  const thirdLine =
    nextBeneficiaryCycleLabel != null && nextBeneficiaryCycleLabel !== ''
      ? `Mon tour : ${nextBeneficiaryCycleLabel}`
      : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.cell}>
        <Text style={styles.label}>Tontines actives</Text>
        <Text style={styles.valuePrimary}>{Math.round(activeCount)}</Text>
      </View>
      <View style={styles.sep} />
      <View style={styles.cell}>
        <Text style={styles.label}>Engagé ce mois</Text>
        <Text style={styles.valueAccent}>
          {formatFcfa(Math.round(totalEngagedThisMonth))}
        </Text>
      </View>
      <View style={styles.sep} />
      <View style={styles.cell}>
        <Text style={styles.label}>À percevoir</Text>
        {thirdLine != null ? (
          <Text style={styles.valueSecondary} numberOfLines={2}>
            {thirdLine}
          </Text>
        ) : (
          <Text style={styles.valueDash}>—</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  cell: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
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
  valuePrimary: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.primary,
  },
  valueAccent: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.accent,
    textAlign: 'center',
  },
  valueSecondary: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.secondaryText,
    textAlign: 'center',
  },
  valueDash: {
    fontSize: 15,
    color: COLORS.gray500,
  },
});
