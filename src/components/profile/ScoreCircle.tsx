import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RADIUS = 50;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SIZE = 120;

export interface ScoreCircleProps {
  score: number;
  maxScore?: number;
}

export const ScoreCircle: React.FC<ScoreCircleProps> = ({
  score,
  maxScore = 1000,
}) => {
  const ratio = Math.min(1, Math.max(0, score / maxScore));
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(ratio, { duration: 800 });
  }, [ratio, progress]);

  const animatedProps = useAnimatedProps(() => {
    const strokeDash = progress.value * CIRCUMFERENCE;
    const strokeGap = CIRCUMFERENCE - strokeDash;
    return {
      strokeDasharray: `${strokeDash} ${strokeGap}`,
    };
  });

  return (
    <View style={styles.container}>
      <Svg width={SIZE} height={SIZE} style={styles.svg}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="#E5E7EB"
          strokeWidth={10}
          fill="none"
        />
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="#1A6B3C"
          strokeWidth={10}
          fill="none"
          strokeLinecap="round"
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={styles.scoreValue}>{score}</Text>
        <Text style={styles.scoreLabel}>POINTS</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: SIZE,
    height: SIZE,
  },
  svg: {
    position: 'absolute',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  scoreLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
});
