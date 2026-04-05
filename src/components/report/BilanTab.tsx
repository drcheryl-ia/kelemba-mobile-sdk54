import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { KelembaBadge } from '@/components/common/KelembaBadge';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';
import { formatFcfaAmount } from '@/utils/formatters';
import type { ReportMetrics, ReportPeriod } from '@/types/report.types';

function periodLabel(period: ReportPeriod): string {
  switch (period) {
    case 'current_month':
      return 'Ce mois';
    case 'quarter':
      return 'Trimestre';
    case 'year':
      return 'Cette année';
    case 'all':
    default:
      return "Tout l'historique";
  }
}

function punctualityBarColor(rate: number): string {
  if (rate >= 90) return COLORS.primary;
  if (rate >= 70) return COLORS.secondary;
  return COLORS.danger;
}

function punctualityTextColor(rate: number): string {
  if (rate >= 90) return COLORS.primary;
  if (rate >= 70) return COLORS.secondary;
  return COLORS.danger;
}

export interface BilanTabProps {
  metrics: ReportMetrics;
  period: ReportPeriod;
  isLoading: boolean;
}

export const BilanTab: React.FC<BilanTabProps> = ({ metrics, period, isLoading }) => {
  if (isLoading) {
    return (
      <View style={styles.pad}>
        <Text style={styles.loadingText}>Chargement du bilan…</Text>
      </View>
    );
  }

  const pr = Math.round(metrics.punctualityRate);
  const net =
    metrics.totalReceivedAsBeneficiaryPeriod -
    (metrics.contributionsExcludingPenalty + metrics.penaltiesPaid);
  const netPositive = net > 0;
  const lateN = Math.max(0, metrics.cyclesTotal - metrics.cyclesOnTime);

  return (
    <View style={styles.pad}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Flux financiers</Text>
          <KelembaBadge variant="active" label={periodLabel(period)} size="sm" />
        </View>
        <View style={styles.rowLine}>
          <Text style={styles.rowLeft}>Cotisations versées</Text>
          <Text style={[styles.rowRight, { color: COLORS.primaryDark }]}>
            {formatFcfaAmount(metrics.contributionsExcludingPenalty)} FCFA
          </Text>
        </View>
        <View style={styles.sep} />
        <View style={styles.rowLine}>
          <Text style={styles.rowLeft}>Pénalités</Text>
          <Text style={[styles.rowRight, { color: COLORS.dangerText }]}>
            {formatFcfaAmount(metrics.penaltiesPaid)} FCFA
          </Text>
        </View>
        <View style={styles.sep} />
        <View style={styles.rowLine}>
          <Text style={styles.rowLeft}>Cagnottes perçues</Text>
          <Text style={[styles.rowRight, { color: COLORS.accentDark }]}>
            {formatFcfaAmount(metrics.totalReceivedAsBeneficiaryPeriod)} FCFA
          </Text>
        </View>
        <View style={styles.footerNet}>
          <Text style={styles.netLabel}>Solde net de la période</Text>
          <Text
            style={[
              styles.netValue,
              { color: netPositive ? COLORS.primaryDark : COLORS.dangerText },
          ]}
          >
            {formatFcfaAmount(Math.round(net))} FCFA
          </Text>
        </View>
      </View>

      <View style={[styles.card, { marginTop: 8 }]}>
        <View style={styles.puncHeader}>
          <Text style={styles.puncTitle}>Taux de ponctualité</Text>
          <Text style={[styles.puncPct, { color: punctualityTextColor(pr) }]}>
            {pr} %
          </Text>
        </View>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${Math.min(100, Math.max(0, pr))}%`, backgroundColor: punctualityBarColor(pr) },
            ]}
          />
        </View>
        <View style={styles.puncFooter}>
          <Text style={styles.smallMuted}>
            {metrics.cyclesOnTime} cycles à temps
          </Text>
          {lateN > 0 ? (
            <Text style={styles.smallDanger}>
              {lateN} retard{lateN > 1 ? 's' : ''} · {Math.round(metrics.lateDaysSum)} jours
            </Text>
          ) : (
            <Text style={styles.smallMuted}> </Text>
          )}
        </View>
        {pr >= 90 ? (
          <View style={styles.encart}>
            <Text style={styles.encartText}>
              Excellent niveau · Éligible au microcrédit Kelemba
            </Text>
          </View>
        ) : null}
      </View>

      {metrics.nextPayoutAmount != null && metrics.nextPayoutAmount > 0 ? (
        <View style={[styles.card, styles.payoutRow, { marginTop: 8 }]}>
          <View style={styles.payoutIcon}>
            <Text style={styles.payoutIconTxt}>$</Text>
          </View>
          <View style={styles.payoutMid}>
            <Text style={styles.payoutName}>{metrics.nextPayoutTontineName}</Text>
            <Text style={styles.payoutSub}>
              Cycle {metrics.nextPayoutCycleNumber ?? '—'} · Mon tour de cagnotte
            </Text>
          </View>
          <View style={styles.payoutEnd}>
            <Text style={styles.payoutAmt}>{formatFcfaAmount(metrics.nextPayoutAmount)}</Text>
            <Text style={styles.payoutFcfa}>FCFA · prévu</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  pad: { paddingTop: 8 },
  loadingText: { textAlign: 'center', color: COLORS.gray500, padding: 24 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: { fontSize: 12, fontWeight: '500', color: COLORS.textPrimary },
  rowLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  rowLeft: { fontSize: 12, color: COLORS.textPrimary },
  rowRight: { fontSize: 12, fontWeight: '600' },
  sep: { height: 0.5, backgroundColor: COLORS.gray100 },
  footerNet: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.primaryLight,
  },
  netLabel: { fontSize: 12, color: COLORS.gray500 },
  netValue: { fontSize: 14, fontWeight: '500' },
  puncHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  puncTitle: { fontSize: 13, fontWeight: '500', color: COLORS.textPrimary },
  puncPct: { fontSize: 18, fontWeight: '500' },
  barTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.primaryLight,
    overflow: 'hidden',
  },
  barFill: { height: 5, borderRadius: 3 },
  puncFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  smallMuted: { fontSize: 10, color: COLORS.gray500 },
  smallDanger: { fontSize: 10, color: COLORS.dangerText },
  encart: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
  },
  encartText: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.primaryDark,
  },
  payoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  payoutIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutIconTxt: { fontSize: 18, fontWeight: '600', color: COLORS.accentDark },
  payoutMid: { flex: 1, minWidth: 0 },
  payoutName: { fontSize: 13, fontWeight: '500', color: COLORS.textPrimary },
  payoutSub: { fontSize: 11, color: COLORS.gray500, marginTop: 2 },
  payoutEnd: { alignItems: 'flex-end' },
  payoutAmt: { fontSize: 16, fontWeight: '500', color: COLORS.accentDark },
  payoutFcfa: { fontSize: 10, color: COLORS.gray500, marginTop: 2 },
});
