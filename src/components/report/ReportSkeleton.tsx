import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { SkeletonPulse } from '@/components/common/SkeletonPulse';

export const ReportSkeleton: React.FC = () => {
  const { width } = useWindowDimensions();
  const cardW = Math.max(0, width - 32);
  return (
    <View style={styles.wrap}>
      {[0, 1, 2].map((i) => (
        <View key={`c-${i}`} style={[styles.cardWrap, { width: cardW }]}>
          <SkeletonPulse width="100%" height={100} borderRadius={14} />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingTop: 8, paddingBottom: 80, alignItems: 'center' },
  cardWrap: { marginHorizontal: 16, marginBottom: 8 },
});
