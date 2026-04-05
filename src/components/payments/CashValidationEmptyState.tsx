import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/spacing';

export type CashValidationEmptyFilter = 'pending' | 'approved' | 'rejected';

export interface CashValidationEmptyStateProps {
  filter: CashValidationEmptyFilter;
}

export const CashValidationEmptyState: React.FC<
  CashValidationEmptyStateProps
> = ({ filter }) => {
  if (filter === 'pending') {
    return (
      <View style={styles.wrap} accessibilityRole="text">
        <Ionicons name="checkmark-circle-outline" size={48} color={COLORS.primary} />
        <Text style={styles.title}>Tout est validé</Text>
        <Text style={styles.sub}>
          Aucun paiement espèces en attente
        </Text>
      </View>
    );
  }

  if (filter === 'approved') {
    return (
      <View style={styles.wrap} accessibilityRole="text">
        <Ionicons name="list-outline" size={48} color={COLORS.gray500} />
        <Text style={styles.titleMuted}>Aucune validation ce mois</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap} accessibilityRole="text">
      <Ionicons name="list-outline" size={48} color={COLORS.gray500} />
      <Text style={styles.titleMuted}>Aucun refus ce mois</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  titleMuted: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.gray500,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  sub: {
    fontSize: 13,
    color: COLORS.gray500,
    marginTop: SPACING.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
});
