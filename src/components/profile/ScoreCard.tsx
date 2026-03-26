import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { KelembaScoreGauge } from './KelembaScoreGauge';
import { ScoreProgressBar } from './ScoreProgressBar';
import { SCORE_LABEL_CONFIG } from '@/types/user.types';
import type { ScoreLabel, UserProfileResponseDto, ScoreResponseDto } from '@/types/user.types';
import type { ScoreEventDto } from '@/types/user.types';
import {
  getScoreGaugeLevel,
  SCORE_GAUGE_COLOR,
  SCORE_REASON_LABEL,
} from '@/utils/scoreUtils';

export interface ProfileScoreCardProps {
  userProfile: UserProfileResponseDto | null;
  scoreData: ScoreResponseDto | null;
  isLoading: boolean;
  onImproveScorePress: () => void;
}

function computePonctualite(scoreData: ScoreResponseDto | null): number {
  if (!scoreData?.stats) return 0;
  const { totalEvents, positiveEvents } = scoreData.stats;
  const total = totalEvents ?? 0;
  return total > 0 ? Math.round((positiveEvents / total) * 100) : 0;
}

function computeAnciennete(profile: UserProfileResponseDto | null): number {
  if (!profile?.createdAt) return 0;
  const ageMs = Date.now() - Date.parse(profile.createdAt);
  const twoYearsMs = 2 * 365 * 86_400_000;
  return Math.min(Math.round((ageMs / twoYearsMs) * 100), 100);
}

function computeNbTontines(profile: UserProfileResponseDto | null): number {
  if (!profile) return 0;
  return Math.min(profile.tontinesCount * 10, 100);
}

function computeAbsenceLitiges(scoreData: ScoreResponseDto | null): number {
  if (!scoreData?.stats) return 100;
  const neg = scoreData.stats.negativeEvents ?? 0;
  return Math.max(100 - neg * 10, 0);
}

function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

function recentScoreEvents(history: ScoreEventDto[], limit: number): ScoreEventDto[] {
  return [...history]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit);
}

export const ProfileScoreCard: React.FC<ProfileScoreCardProps> = ({
  userProfile,
  scoreData,
  isLoading,
  onImproveScorePress,
}) => {
  const { t, i18n } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const compactGauge = windowWidth < 360;

  const handleInfoPress = () => {
    Alert.alert(t('profile.scoreInfoTitle'), t('profile.scoreInfoMessage'));
  };

  const recentFactors = useMemo(
    () => (scoreData?.history?.length ? recentScoreEvents(scoreData.history, 3) : []),
    [scoreData?.history]
  );

  if (isLoading) {
    return (
      <View style={styles.card}>
        <SkeletonBlock width="100%" height={360} borderRadius={20} />
      </View>
    );
  }

  if (!scoreData) {
    return (
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('profile.scoreTitle')}</Text>
          <Pressable onPress={handleInfoPress} hitSlop={8}>
            <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
          </Pressable>
        </View>
        <View style={styles.unavailableBlock}>
          <Ionicons name="cloud-offline-outline" size={40} color="#9CA3AF" />
          <Text style={styles.unavailableText}>{t('profile.scoreUnavailable')}</Text>
        </View>
        <Pressable style={styles.improveLink} onPress={onImproveScorePress}>
          <Text style={styles.improveText}>{t('profile.scoreSeeHistory')}</Text>
        </Pressable>
      </View>
    );
  }

  const score = scoreData.currentScore;
  const scoreLabel = (scoreData.scoreLabel ?? 'MOYEN') as ScoreLabel;
  const config = SCORE_LABEL_CONFIG[scoreLabel];
  const badgeText = i18n.language === 'sango' ? config.sango : config.badge;
  const isBanned = userProfile?.status === 'BANNED';
  const gaugeLevel = getScoreGaugeLevel(score, isBanned);
  const accentColor = SCORE_GAUGE_COLOR[gaugeLevel];
  const trustLine = t(`profile.scoreTrust.${gaugeLevel}`);

  const ponctualite = computePonctualite(scoreData);
  const anciennete = computeAnciennete(userProfile);
  const nbTontines = computeNbTontines(userProfile);
  const absenceLitiges = computeAbsenceLitiges(scoreData);

  const locale = i18n.language === 'sango' ? 'fr-FR' : 'fr-FR';

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{t('profile.scoreTitle')}</Text>
        <Pressable onPress={handleInfoPress} hitSlop={8} accessibilityRole="button">
          <Ionicons name="information-circle-outline" size={22} color="#4B5563" />
        </Pressable>
      </View>

      <Text style={styles.gaugeCaption}>{t('profile.scoreGaugeSubtitle')}</Text>

      <View style={styles.gaugeBlock}>
        <KelembaScoreGauge
          score={score}
          accentColor={accentColor}
          level={gaugeLevel}
          size={compactGauge ? 'compact' : 'standard'}
        />
        <View style={[styles.badge, { backgroundColor: `${accentColor}18` }]}>
          <Text style={[styles.badgeText, { color: accentColor }]} numberOfLines={1}>
            {badgeText}
          </Text>
        </View>
      </View>

      <Text style={styles.trustLine} numberOfLines={2}>
        {trustLine}
      </Text>
      <Text style={styles.microcopy} numberOfLines={3}>
        {t('profile.scoreMicrocopy')}
      </Text>

    
      <View style={styles.bars}>
        <ScoreProgressBar label={t('profile.ponctualite')} percentage={ponctualite} />
        <ScoreProgressBar label={t('profile.anciennete')} percentage={anciennete} />
        <ScoreProgressBar label={t('profile.nbTontines')} percentage={nbTontines} />
        <ScoreProgressBar label={t('profile.absenceLitiges')} percentage={absenceLitiges} />
      </View>

      <Pressable style={styles.improveLink} onPress={onImproveScorePress}>
        <Text style={styles.improveText}>{t('profile.scoreSeeHistory')}</Text>
        <Ionicons name="chevron-forward" size={18} color="#1A6B3C" style={styles.chevron} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
    flex: 1,
  },
  gaugeCaption: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  gaugeBlock: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginBottom: 14,
  },
  badge: {
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 14,
    maxWidth: '100%',
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  trustLine: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 21,
  },
  microcopy: {
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  insightsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  insightsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  insightsPlaceholder: {
    fontSize: 13,
    lineHeight: 20,
    color: '#6B7280',
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  factorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
    marginTop: 6,
    marginRight: 10,
  },
  factorTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  factorLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  factorMeta: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  bars: {
    marginBottom: 12,
  },
  improveLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 4,
  },
  improveText: {
    fontSize: 14,
    color: '#1A6B3C',
    fontWeight: '700',
  },
  chevron: {
    marginTop: 1,
  },
  unavailableBlock: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 12,
  },
  unavailableText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 12,
  },
});
