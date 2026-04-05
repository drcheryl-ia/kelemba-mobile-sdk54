import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonPulse } from '@/components/common/SkeletonPulse';
import { COLORS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/spacing';

function CardSkeleton(): React.ReactElement {
  return (
    <View style={styles.card}>
      <View style={styles.main}>
        <SkeletonPulse width={40} height={40} borderRadius={10} />
        <View style={styles.center}>
          <SkeletonPulse width={110} height={10} borderRadius={4} />
          <SkeletonPulse width={160} height={13} borderRadius={4} />
          <SkeletonPulse width={130} height={10} borderRadius={4} />
        </View>
        <View style={styles.right}>
          <SkeletonPulse width={55} height={16} borderRadius={4} />
          <SkeletonPulse width={48} height={28} borderRadius={8} />
        </View>
      </View>
      <View style={styles.stripSep} />
      <View style={styles.stripRow}>
        <View style={styles.stripCell}>
          <SkeletonPulse width="100%" height={34} borderRadius={0} />
        </View>
        <View style={styles.stripCell}>
          <SkeletonPulse width="100%" height={34} borderRadius={0} />
        </View>
        <View style={styles.stripCell}>
          <SkeletonPulse width="100%" height={34} borderRadius={0} />
        </View>
      </View>
    </View>
  );
}

export const PaymentDueSkeleton: React.FC = () => (
  <View style={styles.wrap}>
    <CardSkeleton />
    <CardSkeleton />
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    gap: 0,
  },
  card: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    overflow: 'hidden',
  },
  main: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  center: {
    flex: 1,
    gap: SPACING.sm,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  stripSep: {
    height: 0.5,
    backgroundColor: COLORS.gray200,
  },
  stripRow: {
    flexDirection: 'row',
    height: 34,
  },
  stripCell: {
    flex: 1,
  },
});
