import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { TontineDto } from '@/api/types/api.types';
import type { ScoreResponseDto } from '@/types/user.types';
import { COLORS } from '@/theme/colors';
import { formatFcfaAbbrev, totalFcfaPaidApprox } from '@/components/profile/profileHelpers';

export interface ProfileStatsStripProps {
  tontines: TontineDto[];
  score: ScoreResponseDto | null;
}

export const ProfileStatsStrip: React.FC<ProfileStatsStripProps> = ({
  tontines,
  score,
}) => {
  const activesCount = useMemo(
    () => tontines.filter((t) => t.status === 'ACTIVE').length,
    [tontines]
  );
  const completedCount = useMemo(
    () => tontines.filter((t) => t.status === 'COMPLETED').length,
    [tontines]
  );

  const punctualityRate = useMemo(() => {
    if (score == null) return '—';
    const te = score.stats.totalEvents ?? 0;
    if (te === 0) return '—';
    return `${Math.round((score.stats.positiveEvents / te) * 100)}%`;
  }, [score]);

  const totalPaid = useMemo(() => formatFcfaAbbrev(totalFcfaPaidApprox(tontines)), [tontines]);

  const cells = [
    { value: String(activesCount), label: 'Actives' },
    { value: String(completedCount), label: 'Terminées' },
    { value: punctualityRate, label: 'Ponctualité' },
    { value: totalPaid, label: 'Versé (est.)' },
  ];

  return (
    <View style={styles.row}>
      {cells.map((c, i) => (
        <React.Fragment key={c.label}>
          {i > 0 ? <View style={styles.sep} /> : null}
          <View style={styles.cell}>
            <Text style={styles.val}>{c.value}</Text>
            <Text style={styles.lab}>{c.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.gray200,
  },
  sep: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.gray200,
  },
  cell: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  val: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.primary,
    textAlign: 'center',
  },
  lab: {
    fontSize: 9,
    color: COLORS.gray500,
    marginTop: 2,
    textAlign: 'center',
  },
});
