import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import type { ScoreLabel } from '@/api/types/api.types';

export interface ScoreCardProps {
  score: number; // 0–1000 · vient de ScoreResponseDto.currentScore
  scoreLabel: ScoreLabel; // vient de ScoreResponseDto.scoreLabel
  isLoading: boolean;
  /** Désactive marginHorizontal quand la card est dans GradientBorderCard */
  compact?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 600) return '#1A6B3C'; // color.primary — Vert Kelemba
  if (score >= 300) return '#F5A623'; // color.secondary — Orange
  return '#D0021B'; // color.danger — Rouge critique
}

const SCORE_LABELS: Record<ScoreLabel, { fr: string; sango: string }> = {
  EXCELLENT: { fr: 'Excellent', sango: 'Nzoni kolê' },
  BON: { fr: 'Fiable', sango: 'Î-kodê' },
  MOYEN: { fr: 'Correct', sango: 'Pîka' },
  FAIBLE: { fr: 'Insuffisant', sango: 'Âla tîngbi' },
  CRITIQUE: { fr: 'Critique', sango: 'Ayeke mbî' },
};

const RADIUS = 45;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SIZE = 120;

export const ScoreCard: React.FC<ScoreCardProps> = ({
  score,
  scoreLabel,
  isLoading,
  compact = false,
}) => {
  const cardStyle = [styles.card, compact && styles.cardCompact];
  if (isLoading) {
    return (
      <View style={cardStyle}>
        <SkeletonBlock width="100%" height={110} borderRadius={16} />
      </View>
    );
  }

  const color = getScoreColor(score);
  const label = SCORE_LABELS[scoreLabel];
  const strokeDash = (score / 1000) * CIRCUMFERENCE;
  const strokeGap = CIRCUMFERENCE - strokeDash;

  return (
    <View style={cardStyle}>
      <View style={styles.row}>
        <View style={styles.gaugeContainer}>
          <Svg width={110} height={110} style={styles.svg}>
            <Circle
              cx={55}
              cy={55}
              r={RADIUS}
              stroke="#E5E7EB"
              strokeWidth={10}
              fill="none"
            />
            <Circle
              cx={55}
              cy={55}
              r={RADIUS}
              stroke={color}
              strokeWidth={10}
              fill="none"
              strokeDasharray={`${strokeDash} ${strokeGap}`}
              strokeLinecap="round"
              transform="rotate(-90 55 55)"
            />
          </Svg>
          <View style={styles.scoreCenter}>
            <Text style={styles.scoreValue}>{score}</Text>
            <Text style={styles.scoreMax}>/ 1000</Text>
          </View>
        </View>
        <View style={styles.textBlock}>
          <Text style={styles.title}>Score Kelemba</Text>
          <Text style={styles.subtitle}>Score de Fiabilité</Text>
          <View
            style={[
              styles.badge,
              { borderColor: color, backgroundColor: `${color}15` },
            ]}
          >
            <Ionicons name="checkmark-circle" size={13} color={color} />
            <Text style={[styles.badgeText, { color }]}>
              {label.fr}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${(score / 1000) * 100}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardCompact: {
    marginHorizontal: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  gaugeContainer: {
    position: 'relative',
    width: 110,
    height: 110,
  },
  svg: {
    position: 'absolute',
  },
  scoreCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  scoreMax: {
    fontSize: 11,
    color: '#6B7280',
  },
  textBlock: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  subtitle: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#6B7280',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressTrack: {
    marginTop: 12,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
});
