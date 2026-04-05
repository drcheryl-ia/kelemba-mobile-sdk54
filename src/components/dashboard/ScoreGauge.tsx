import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';

const MOYEN_LABEL_COLOR = '#FFD580';

export interface ScoreGaugeProps {
  score: number;
  onPress?: () => void;
}

function clampScore(value: number): number {
  return Math.min(1000, Math.max(0, value));
}

function getLevel(score: number): { label: string; color: string } {
  const s = clampScore(score);
  if (s >= 800) {
    return { label: 'EXCELLENT', color: COLORS.secondary };
  }
  if (s >= 600) {
    return { label: 'BON', color: COLORS.secondary };
  }
  if (s >= 400) {
    return { label: 'MOYEN', color: MOYEN_LABEL_COLOR };
  }
  if (s >= 200) {
    return { label: 'FAIBLE', color: COLORS.dangerLight };
  }
  return { label: 'CRITIQUE', color: COLORS.dangerText };
}

function getBarColor(score: number): string {
  const s = clampScore(score);
  if (s >= 800) return '#F5A623';
  if (s >= 500) return '#4CAF50';
  return '#D0021B';
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score, onPress }) => {
  const clamped = useMemo(() => clampScore(score), [score]);
  const level = useMemo(() => getLevel(clamped), [clamped]);
  const barColor = useMemo(() => getBarColor(clamped), [clamped]);
  const fillPct = Math.min(100, Math.round((clamped / 1000) * 100));

  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, clamped]);

  const fillWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${fillPct}%`],
  });

  const body = (
    <>
      <View style={styles.leftCol}>
        <Text style={styles.kicker}>Score Kelemba</Text>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: fillWidth, backgroundColor: barColor }]} />
        </View>
      </View>
      <View style={styles.rightCol}>
        <Text style={styles.scoreValue}>{Math.round(clamped)}</Text>
        <Text style={[styles.levelLabel, { color: level.color }]}>
          {level.label}
        </Text>
      </View>
      <Text style={styles.chevron} accessibilityElementsHidden>
        ›
      </Text>
    </>
  );

  const a11yLabel = `Score Kelemba ${Math.round(clamped)} sur 1000, niveau ${level.label}. Appuyer pour voir le détail.`;

  if (onPress != null) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View style={styles.container} accessibilityLabel={a11yLabel}>
      {body}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: 'stretch',
  },
  pressed: {
    opacity: 0.92,
  },
  leftCol: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 6,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
  rightCol: {
    alignItems: 'flex-end',
  },
  scoreValue: {
    fontSize: 22,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  levelLabel: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  chevron: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '300',
  },
});
