import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SkeletonPulse } from '@/components/common/SkeletonPulse';
import { COLORS } from '@/theme/colors';
import { formatFcfaAmount } from '@/utils/formatters';
import type { ReportMetrics, ReportPeriod } from '@/types/report.types';

function scoreLabel(rate: number): string {
  if (rate >= 90) return 'Excellent';
  if (rate >= 70) return 'Bon';
  if (rate >= 50) return 'Moyen';
  return 'À améliorer';
}

function punctualityValueColor(rate: number): string {
  if (rate >= 90) return '#F5A623';
  if (rate >= 70) return '#fff';
  return '#FCEBEB';
}

export interface ReportSummaryGridProps {
  metrics: ReportMetrics;
  period: ReportPeriod;
  isLoading: boolean;
}

export const ReportSummaryGrid: React.FC<ReportSummaryGridProps> = ({
  metrics,
  period: _period,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <View style={styles.grid}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.cell}>
            <SkeletonPulse width="100%" height={60} borderRadius={10} baseColor="rgba(255,255,255,0.2)" />
          </View>
        ))}
      </View>
    );
  }

  const pr = Math.round(metrics.punctualityRate);
  const pColor = punctualityValueColor(pr);

  return (
    <View style={styles.grid}>
      <View style={styles.cell}>
        <Text style={styles.label}>Total versé (cumulé)</Text>
        <Text style={styles.value}>{formatFcfaAmount(metrics.totalPaidAllTime)}</Text>
        <Text style={styles.sub}>FCFA · toutes tontines</Text>
      </View>
      <View style={styles.cell}>
        <Text style={styles.label}>Ponctualité</Text>
        <Text style={[styles.value, { color: pColor }]}>{pr} %</Text>
        <Text style={styles.sub}>
          {scoreLabel(pr)} · {metrics.cyclesOnTime} / {metrics.cyclesTotal} cycles
        </Text>
      </View>
      <View style={styles.cell}>
        <Text style={styles.label}>Tontines complétées</Text>
        <Text style={styles.value}>{String(metrics.completedTontinesCount)}</Text>
        <Text style={styles.sub}>
          sur {metrics.completedTontinesCount + metrics.activeTontinesCount} participations
        </Text>
      </View>
      <View style={styles.cell}>
        <Text style={styles.label}>Pénalités</Text>
        <Text
          style={[
            styles.value,
            { color: metrics.penaltiesPaid > 0 ? '#FCEBEB' : COLORS.white },
          ]}
        >
          {formatFcfaAmount(metrics.penaltiesPaid)}
        </Text>
        <Text style={styles.sub}>
          FCFA · {metrics.penaltiesPaid === 0 ? 'Aucun retard' : 'sur la période'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  cell: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  label: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 3,
  },
  value: {
    fontSize: 17,
    fontWeight: '500',
    color: COLORS.white,
  },
  sub: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
});
