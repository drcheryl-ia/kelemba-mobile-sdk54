/**
 * Barre de progression — animation 600ms Easing.out(Easing.quad).
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

export interface SavingsProgressBarProps {
  current: number;
  target: number;
  height?: number;
  color?: string;
  showLabel?: boolean;
}

export const SavingsProgressBar: React.FC<SavingsProgressBarProps> = ({
  current,
  target,
  height = 8,
  color = '#1A6B3C',
  showLabel = false,
}) => {
  const animatedWidth = useRef(new Animated.Value(0)).current;
  const percent = target > 0 ? Math.min(100, (current / target) * 100) : 0;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: percent / 100,
      duration: 600,
      useNativeDriver: true,
      easing: Easing.out(Easing.quad),
    }).start();
  }, [animatedWidth, percent]);

  return (
    <View style={styles.container}>
      <View style={[styles.track, { height }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              height,
              backgroundColor: color,
              transform: [{ scaleX: animatedWidth }],
            },
          ]}
        />
      </View>
      {showLabel && (
        <Text style={styles.label}>{Math.round(percent)} %</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  track: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    borderRadius: 4,
    transformOrigin: 'left',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    minWidth: 36,
  },
});
