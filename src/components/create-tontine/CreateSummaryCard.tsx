import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { FormSectionCard } from '@/components/create-tontine/FormSectionCard';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';

export interface CreateSummaryCardProps {
  rows: Array<{ label: string; value: string }>;
  statusVariant: 'ready' | 'legal_warning';
}

export const CreateSummaryCard: React.FC<CreateSummaryCardProps> = ({
  rows,
  statusVariant,
}) => {
  return (
    <View style={styles.wrap}>
      <FormSectionCard title="Récapitulatif">
        {rows.map((r, idx) => (
          <View
            key={`${r.label}-${idx}`}
            style={[
              styles.row,
              idx === rows.length - 1 && styles.rowLast,
            ]}
          >
            <Text style={styles.label}>{r.label}</Text>
            <Text style={styles.value}>{r.value}</Text>
          </View>
        ))}
      </FormSectionCard>

      {statusVariant === 'ready' ? (
        <FormSectionCard
          backgroundColor={COLORS.primaryLight}
          borderColor={COLORS.primary}
        >
          <View style={styles.statusRow}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M20 6L9 17l-5-5"
                stroke={COLORS.primary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <View style={styles.statusText}>
              <Text style={styles.readyTitle}>Prête à être publiée</Text>
              <Text style={styles.readySub}>
                En confirmant, la tontine sera créée en brouillon. Vous pourrez ensuite inviter
                les membres et finaliser le contrat.
              </Text>
            </View>
          </View>
        </FormSectionCard>
      ) : (
        <FormSectionCard
          backgroundColor={COLORS.secondaryBg}
          borderColor={COLORS.secondary}
        >
          <View style={styles.statusRow}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                stroke={COLORS.secondaryText}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <View style={styles.statusText}>
              <Text style={styles.warnTitle}>Rappel légal</Text>
              <Text style={styles.warnSub}>
                Les montants projetés sont indicatifs. Le bonus est une redistribution interne, pas
                un rendement financier garanti.
              </Text>
            </View>
          </View>
        </FormSectionCard>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.gray100,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  label: {
    fontSize: 12,
    color: COLORS.gray500,
    flex: 1,
    marginRight: 8,
  },
  value: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textPrimary,
    flexShrink: 0,
    textAlign: 'right',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  statusText: {
    flex: 1,
    minWidth: 0,
  },
  readyTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.primaryDark,
  },
  readySub: {
    fontSize: 11,
    color: COLORS.primaryDark,
    marginTop: 4,
    lineHeight: 15,
  },
  warnTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.secondaryText,
  },
  warnSub: {
    fontSize: 11,
    color: COLORS.secondaryText,
    marginTop: 4,
    lineHeight: 15,
  },
});
