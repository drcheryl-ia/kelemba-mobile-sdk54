import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonPulse } from '@/components/common/SkeletonPulse';
import { COLORS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/spacing';

function CardSkeleton(): React.ReactElement {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <SkeletonPulse width={38} height={38} borderRadius={19} />
        <View style={styles.center}>
          <SkeletonPulse width={120} height={13} borderRadius={4} />
          <SkeletonPulse width={160} height={11} borderRadius={4} />
          <View style={styles.pillRow}>
            <SkeletonPulse width={52} height={18} borderRadius={20} />
            <SkeletonPulse width={72} height={18} borderRadius={20} />
          </View>
        </View>
        <View style={styles.right}>
          <SkeletonPulse width={55} height={16} borderRadius={4} />
          <SkeletonPulse width={45} height={11} borderRadius={4} />
        </View>
      </View>
      <View style={styles.proofWrap}>
        <SkeletonPulse width="100%" height={52} borderRadius={8} />
      </View>
      <View style={styles.actions}>
        <View style={styles.actionBtn}>
          <SkeletonPulse width="100%" height={36} borderRadius={9} />
        </View>
        <View style={styles.actionBtn}>
          <SkeletonPulse width="100%" height={36} borderRadius={9} />
        </View>
      </View>
    </View>
  );
}

export const CashValidationSkeleton: React.FC = () => (
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
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  center: {
    flex: 1,
    gap: 6,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  proofWrap: {
    marginHorizontal: 14,
    marginBottom: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  actionBtn: {
    flex: 1,
  },
});
