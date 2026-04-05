import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonPulse } from '@/components/common/SkeletonPulse';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';

/** Placeholder aligné sur la carte tontine pleine (liste). */
export const TontineCardSkeleton: React.FC = () => {
  return (
    <View style={styles.card}>
      <View style={styles.body}>
        <View style={styles.rowHeader}>
          <SkeletonPulse width={140} height={14} borderRadius={6} />
          <SkeletonPulse width={52} height={18} borderRadius={20} />
        </View>
        <SkeletonPulse width={100} height={18} borderRadius={20} />
        <View style={styles.metricsRow}>
          <View style={styles.metricCell}>
            <SkeletonPulse width="100%" height={44} borderRadius={0} />
          </View>
          <View style={styles.metricGap} />
          <View style={styles.metricCell}>
            <SkeletonPulse width="100%" height={44} borderRadius={0} />
          </View>
          <View style={styles.metricGap} />
          <View style={styles.metricCell}>
            <SkeletonPulse width="100%" height={44} borderRadius={0} />
          </View>
        </View>
        <SkeletonPulse width="100%" height={5} borderRadius={3} />
      </View>
      <View style={styles.sep} />
      <View style={styles.strip}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[styles.stripCell, i > 0 && styles.stripCellBorder]}
          >
            <SkeletonPulse width="100%" height={36} borderRadius={0} />
          </View>
        ))}
      </View>
    </View>
  );
};

/** Deux cartes squelette empilées (chargement liste). */
export const TontineCardSkeletonList: React.FC = () => (
  <>
    <TontineCardSkeleton />
    <TontineCardSkeleton />
  </>
);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    overflow: 'hidden',
  },
  body: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  metricGap: {
    width: 1,
    backgroundColor: COLORS.gray200,
  },
  metricCell: {
    flex: 1,
    overflow: 'hidden',
  },
  sep: {
    height: 0.5,
    backgroundColor: COLORS.gray200,
  },
  strip: {
    flexDirection: 'row',
  },
  stripCell: {
    flex: 1,
    overflow: 'hidden',
  },
  stripCellBorder: {
    borderLeftWidth: 0.5,
    borderLeftColor: COLORS.gray200,
  },
});
