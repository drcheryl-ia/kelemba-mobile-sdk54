import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { ScoreCircle } from './ScoreCircle';
import { ScoreProgressBar } from './ScoreProgressBar';
import { SCORE_LABEL_CONFIG } from '@/types/user.types';
import type { ScoreLabel, UserProfileResponseDto, ScoreResponseDto } from '@/types/user.types';

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

export const ProfileScoreCard: React.FC<ProfileScoreCardProps> = ({
  userProfile,
  scoreData,
  isLoading,
  onImproveScorePress,
}) => {
  const { t, i18n } = useTranslation();

  const handleInfoPress = () => {
    Alert.alert(
      t('profile.scoreInfoTitle'),
      t('profile.scoreInfoMessage')
    );
  };

  if (isLoading) {
    return (
      <View style={styles.card}>
        <SkeletonBlock width="100%" height={280} borderRadius={16} />
      </View>
    );
  }

  const score = scoreData?.currentScore ?? 0;
  const scoreLabel = (scoreData?.scoreLabel ?? 'MOYEN') as ScoreLabel;
  const config = SCORE_LABEL_CONFIG[scoreLabel];
  const badgeText = i18n.language === 'sango' ? config.sango : config.badge;

  const ponctualite = computePonctualite(scoreData);
  const anciennete = computeAnciennete(userProfile);
  const nbTontines = computeNbTontines(userProfile);
  const absenceLitiges = computeAbsenceLitiges(scoreData);

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{t('profile.scoreTitle')}</Text>
        <Pressable onPress={handleInfoPress} hitSlop={8}>
          <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
        </Pressable>
      </View>

      <View style={styles.circleRow}>
        <ScoreCircle score={score} />
        <View style={[styles.badge, { backgroundColor: `${config.color}20` }]}>
          <Text style={[styles.badgeText, { color: config.color }]}>{badgeText}</Text>
        </View>
      </View>

      <View style={styles.bars}>
        <ScoreProgressBar
          label={t('profile.ponctualite')}
          percentage={ponctualite}
        />
        <ScoreProgressBar
          label={t('profile.anciennete')}
          percentage={anciennete}
        />
        <ScoreProgressBar
          label={t('profile.nbTontines')}
          percentage={nbTontines}
        />
        <ScoreProgressBar
          label={t('profile.absenceLitiges')}
          percentage={absenceLitiges}
        />
      </View>

      <Pressable style={styles.improveLink} onPress={onImproveScorePress}>
        <Text style={styles.improveText}>{t('profile.improveScore')}</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  circleRow: {
    alignItems: 'center',
    marginBottom: 20,
  },
  badge: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bars: {
    marginBottom: 16,
  },
  improveLink: {
    paddingVertical: 8,
  },
  improveText: {
    fontSize: 14,
    color: '#1A6B3C',
    fontWeight: '600',
  },
});
