/**
 * Grille KPI 2x2 — résumé cotisations (période / filtres affichés).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatFcfa } from '@/utils/formatters';

type Props = {
  totalVersé: number;
  totalPénalités: number;
  ponctualitéPct: number;
  enAttente: number;
  scopeHint?: string;
};

const GREEN = '#1A6B3C';

export const PaymentSummaryGrid: React.FC<Props> = ({
  totalVersé,
  totalPénalités,
  ponctualitéPct,
  enAttente,
  scopeHint,
}) => (
  <View style={styles.card} accessibilityRole="summary">
    {scopeHint ? (
      <Text style={styles.scopeHint} accessibilityLabel={scopeHint}>
        {scopeHint}
      </Text>
    ) : null}
    <View style={styles.row}>
      <View style={styles.cell}>
        <Text style={styles.label}>Total versé</Text>
        <Text style={styles.valueLarge} numberOfLines={2}>
          {formatFcfa(totalVersé)}
        </Text>
      </View>
      <View style={styles.cell}>
        <Text style={styles.label}>Pénalités</Text>
        <Text style={styles.valueLarge} numberOfLines={2}>
          {formatFcfa(totalPénalités)}
        </Text>
      </View>
    </View>
    <View style={styles.row}>
      <View style={styles.cell}>
        <Text style={styles.label}>Ponctualité</Text>
        <Text style={styles.value}>{ponctualitéPct} %</Text>
      </View>
      <View style={styles.cell}>
        <Text style={styles.label}>En attente</Text>
        <Text style={styles.value}>{enAttente}</Text>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  scopeHint: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  cell: {
    flex: 1,
    minHeight: 72,
    justifyContent: 'flex-start',
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
    fontWeight: '600',
  },
  valueLarge: {
    fontSize: 17,
    fontWeight: '800',
    color: GREEN,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1C1C1E',
  },
});
