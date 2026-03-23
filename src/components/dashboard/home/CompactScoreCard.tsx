/**
 * Score Kelemba — carte compacte (dashboard).
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import type { ScoreLabel } from '@/api/types/api.types';
import {
  scoreLabelToBandDisplay,
  scoreValueToBandDisplay,
  type ScoreBandDisplay,
} from '@/utils/scoreBandLabel';

export interface CompactScoreCardProps {
  score: number | null;
  scoreLabel: ScoreLabel | null;
  isLoading: boolean;
  isError: boolean;
  onPressDetail: () => void;
}

function displayBand(
  score: number | null,
  label: ScoreLabel | null
): ScoreBandDisplay | null {
  if (label != null) return scoreLabelToBandDisplay(label);
  if (score != null) return scoreValueToBandDisplay(score);
  return null;
}

export const CompactScoreCard: React.FC<CompactScoreCardProps> = ({
  score,
  scoreLabel,
  isLoading,
  isError,
  onPressDetail,
}) => {
  if (isLoading) {
    return (
      <View style={styles.card}>
        <SkeletonBlock width="100%" height={72} borderRadius={14} />
      </View>
    );
  }
  if (isError || score == null) {
    return (
      <View style={styles.cardMuted}>
        <Text style={styles.mutedTitle}>Score Kelemba</Text>
        <Text style={styles.mutedBody}>Indisponible pour le moment</Text>
      </View>
    );
  }
  const band = displayBand(score, scoreLabel);
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPressDetail}
      accessibilityRole="button"
      accessibilityLabel="Voir le détail du score"
    >
      <View style={styles.row}>
        <View>
          <Text style={styles.label}>Score</Text>
          <Text style={styles.scoreLine}>
            <Text style={styles.scoreVal}>{score}</Text>
            <Text style={styles.scoreMax}> / 1000</Text>
          </Text>
          {band != null ? (
            <View style={styles.badge}>
              <Ionicons name="ribbon-outline" size={14} color="#1A6B3C" />
              <Text style={styles.badgeText}>{band}</Text>
            </View>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    flex: 1,
    minWidth: 0,
  },
  cardMuted: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flex: 1,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.88,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  scoreLine: {
    marginTop: 4,
  },
  scoreVal: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  scoreMax: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A6B3C',
  },
  mutedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },
  mutedBody: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
});
