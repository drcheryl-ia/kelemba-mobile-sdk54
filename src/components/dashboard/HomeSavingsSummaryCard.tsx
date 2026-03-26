/**
 * Résumé épargne — accueil (agrégation liste uniquement).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatFcfa } from '@/utils/formatters';
import type { SavingsHomeAggregate } from '@/utils/homeSavingsRowViewModel';

const KELEMBA = '#1A6B3C';

export type HomeSavingsSummaryCardProps = {
  aggregate: SavingsHomeAggregate;
};

function formatShortDate(iso: string | null): string {
  if (iso == null || iso === '') return '—';
  const parts = iso.split('T')[0].split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return iso;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

export const HomeSavingsSummaryCard: React.FC<HomeSavingsSummaryCardProps> = ({ aggregate }) => {
  const { t } = useTranslation();
  const { activeCount, totalSaved, soonestDueIso } = aggregate;

  if (activeCount === 0) return null;

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={styles.title}>{t('dashboard.homeSavingsSummaryTitle', 'Mon épargne (tontines actives)')}</Text>
      <View style={styles.row}>
        <View style={styles.cell}>
          <Text style={styles.label}>{t('dashboard.homeSavingsSummaryCount', 'Tontines')}</Text>
          <Text style={styles.value}>{activeCount}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>{t('dashboard.homeSavingsSummaryTotal', 'Total épargné')}</Text>
          <Text style={styles.value}>
            {totalSaved != null ? formatFcfa(totalSaved) : '—'}
          </Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>{t('dashboard.homeSavingsSummarySoonest', 'Prochaine échéance')}</Text>
          <Text style={styles.value}>{formatShortDate(soonestDueIso)}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 16,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: KELEMBA,
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  value: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
});
