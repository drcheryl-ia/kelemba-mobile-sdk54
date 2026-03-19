import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';

interface SkeletonBlockProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const SkeletonBlock: React.FC<SkeletonBlockProps> = ({
  width,
  height,
  borderRadius = 8,
  style,
}) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius, opacity },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  skeleton: { backgroundColor: '#E5E7EB' },
});
