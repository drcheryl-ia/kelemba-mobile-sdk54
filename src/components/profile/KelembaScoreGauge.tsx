import React, { memo, useEffect } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import type { ScoreLevel } from '@/utils/scoreUtils';

/** Repères visuels (200 / 400 / 600 / 800) — lecture rapide des paliers sans texte dense. */
const SCALE_MARKS = [0.2, 0.4, 0.6, 0.8] as const;

export interface KelembaScoreGaugeProps {
  score: number;
  maxScore?: number;
  accentColor: string;
  trackColor?: string;
  level: ScoreLevel;
  size?: 'standard' | 'compact';
}

export const KelembaScoreGauge = memo(function KelembaScoreGauge({
  score,
  maxScore = 1000,
  accentColor,
  trackColor = '#E8ECF2',
  level,
  size = 'standard',
}: KelembaScoreGaugeProps) {
  const compact = size === 'compact';
  const layoutW = useSharedValue(0);
  const progress = useSharedValue(0);

  const ratio = Math.min(1, Math.max(0, score / maxScore));
  const displayScore = Math.round(score);

  useEffect(() => {
    progress.value = withTiming(ratio, {
      duration: 880,
      easing: Easing.out(Easing.cubic),
    });
  }, [ratio, progress]);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    layoutW.value = e.nativeEvent.layout.width;
  };

  const fillStyle = useAnimatedStyle(() => ({
    width: layoutW.value * progress.value,
  }));

  const showPositiveIcon = level === 'EXCELLENT';
  const showAlertIcon = level === 'CRITIQUE' || level === 'BANNI';

  const barH = compact ? 8 : 10;
  const tickH = compact ? 8 : 10;

  return (
    <View
      style={styles.root}
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: maxScore,
        now: displayScore,
      }}
    >
      <View style={styles.scoreRow}>
        <View style={styles.scoreLeft}>
          {showPositiveIcon ? (
            <Ionicons
              name="checkmark-circle"
              size={compact ? 18 : 20}
              color={accentColor}
              style={styles.leadIcon}
            />
          ) : null}
          {showAlertIcon ? (
            <Ionicons
              name="warning"
              size={compact ? 18 : 20}
              color={accentColor}
              style={styles.leadIcon}
            />
          ) : null}
          <Text
            style={[styles.scoreValue, compact && styles.scoreValueCompact]}
            numberOfLines={1}
          >
            {displayScore}
          </Text>
          <Text
            style={[styles.scoreSuffix, compact && styles.scoreSuffixCompact]}
            numberOfLines={1}
          >
            {' '}
            / {maxScore}
          </Text>
        </View>
      </View>

      <View style={[styles.trackWrap, { height: barH }]}>
        <View
          style={[styles.track, { backgroundColor: trackColor, height: barH }]}
          onLayout={onTrackLayout}
        >
          {SCALE_MARKS.map((pct) => (
            <View
              key={pct}
              pointerEvents="none"
              style={[
                styles.scaleMark,
                {
                  left: `${pct * 100}%`,
                  height: tickH,
                  transform: [{ translateX: -0.5 }],
                },
              ]}
            />
          ))}
          <Animated.View
            style={[
              styles.fill,
              {
                height: barH,
                backgroundColor: accentColor,
              },
              fillStyle,
            ]}
          />
        </View>
      </View>

      <View style={styles.scaleLabels}>
        <Text style={styles.scaleEnd}>0</Text>
        <Text style={styles.scaleMid}>500</Text>
        <Text style={styles.scaleEnd}>1000</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  scoreLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'nowrap',
    flexShrink: 1,
  },
  leadIcon: {
    marginRight: 6,
  },
  scoreValue: {
    fontSize: 34,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  scoreValueCompact: {
    fontSize: 28,
  },
  scoreSuffix: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
    fontVariant: ['tabular-nums'],
  },
  scoreSuffixCompact: {
    fontSize: 13,
  },
  trackWrap: {
    width: '100%',
  },
  track: {
    width: '100%',
    borderRadius: 999,
    overflow: 'hidden',
    position: 'relative',
  },
  scaleMark: {
    position: 'absolute',
    top: 0,
    width: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.1)',
    zIndex: 1,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: 999,
    zIndex: 2,
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  scaleEnd: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    fontVariant: ['tabular-nums'],
  },
  scaleMid: {
    fontSize: 11,
    fontWeight: '500',
    color: '#CBD5E1',
    fontVariant: ['tabular-nums'],
  },
});
