import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, type DimensionValue } from 'react-native';
import { COLORS } from '@/theme/colors';

export interface SkeletonPulseProps {
  width: DimensionValue;
  height: number;
  borderRadius?: number;
  /** Par défaut `COLORS.gray200` (#D3D1C7) — ex. fond blanc semi-transparent sur header vert */
  baseColor?: string;
}

export const SkeletonPulse: React.FC<SkeletonPulseProps> = ({
  width,
  height,
  borderRadius = 6,
  baseColor = COLORS.gray200,
}) => {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        {
          width,
          height,
          borderRadius,
          backgroundColor: baseColor,
          opacity,
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
};

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
