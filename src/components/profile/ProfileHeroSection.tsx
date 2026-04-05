import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '@/navigation/types';
import type { UserProfileResponseDto, ScoreResponseDto } from '@/types/user.types';
import { COLORS } from '@/theme/colors';
import {
  monthDeltaSum,
  scoreLevelCaption,
  nextObjective,
} from '@/components/profile/profileHelpers';

export interface ProfileHeroSectionProps {
  user: UserProfileResponseDto | null;
  score: ScoreResponseDto | null;
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'Profile'>;
  onEditProfile?: () => void;
}

function initials(fullName: string): string {
  const p = fullName.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return `${p[0][0] ?? ''}${p[p.length - 1][0] ?? ''}`.toUpperCase();
}

function kycStatusLabel(status: UserProfileResponseDto['kycStatus']): string {
  switch (status) {
    case 'VERIFIED':
      return 'Identité vérifiée';
    case 'PENDING':
      return 'Vérification en attente';
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
      return 'Documents envoyés';
    case 'REJECTED':
      return 'Vérification refusée';
    default:
      return 'KYC';
  }
}

export const ProfileHeroSection: React.FC<ProfileHeroSectionProps> = ({
  user,
  score,
  navigation,
  onEditProfile,
}) => {
  const fillAnim = useRef(new Animated.Value(0)).current;

  const pct = score != null ? Math.min((score.currentScore / 1000) * 100, 100) : 0;

  useEffect(() => {
    fillAnim.setValue(0);
    Animated.timing(fillAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [fillAnim, score?.currentScore]);

  const deltaMois = score != null ? monthDeltaSum(score.history) : 0;

  const deltaBlock = useMemo(() => {
    if (score == null) {
      return { text: '—', color: 'rgba(255,255,255,0.6)' as const };
    }
    if (deltaMois > 0) {
      return { text: `+${deltaMois} pts ce mois`, color: COLORS.secondary };
    }
    if (deltaMois < 0) {
      return { text: `${deltaMois} pts ce mois`, color: COLORS.dangerText };
    }
    return { text: 'Stable ce mois', color: 'rgba(255,255,255,0.6)' as const };
  }, [deltaMois, score]);

  const nextObj = score != null ? nextObjective(score.scoreLabel) : null;

  const fillWidthStyle = {
    width: fillAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', `${pct}%`],
    }),
  };

  const a11yScore =
    score != null
      ? `Score Kelemba ${score.currentScore} sur 1000, niveau ${score.scoreLabel}. Voir le détail.`
      : 'Score Kelemba, voir le détail.';

  return (
    <View style={styles.wrap}>
      <View style={styles.rowTop}>
        <View
          style={styles.avatar}
          accessibilityLabel={
            user?.fullName
              ? `Photo de profil de ${user.fullName}`
              : 'Photo de profil'
          }
        >
          <Text style={styles.avatarTxt}>{initials(user?.fullName ?? '')}</Text>
        </View>
        <View style={styles.infoCol}>
          <Text style={styles.name} numberOfLines={2}>
            {user?.fullName ?? '—'}
          </Text>
          <Text style={styles.phone} numberOfLines={1}>
            {user?.phone ?? '—'}
          </Text>
          <View style={styles.kycBadge}>
            <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
              <Path
                d="M20 6L9 17l-5-5"
                stroke={COLORS.white}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={styles.kycTxt}>
              {user != null ? kycStatusLabel(user.kycStatus) : '—'}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => onEditProfile?.()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Modifier le profil"
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
              stroke="rgba(255,255,255,0.8)"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
      </View>

      <Pressable
        onPress={() => navigation.navigate('ScoreHistory')}
        style={styles.scoreCard}
        accessibilityRole="button"
        accessibilityLabel={a11yScore}
      >
        <View style={styles.scoreTop}>
          <View style={styles.scoreLeft}>
            <Text style={styles.scoreKicker}>Score Kelemba</Text>
            <Text style={styles.scoreBig}>{score?.currentScore ?? '—'}</Text>
            <Text style={styles.scoreLevel}>
              {score != null ? scoreLevelCaption(score.scoreLabel) : '—'}
            </Text>
          </View>
          <View style={styles.scoreRight}>
            <Text style={styles.progKicker}>Progression</Text>
            <Text style={[styles.deltaMois, { color: deltaBlock.color }]}>
              {deltaBlock.text}
            </Text>
            <Text style={styles.objTxt}>
              {nextObj != null
                ? `Objectif : ${nextObj.title} (${nextObj.pts} pts)`
                : score?.scoreLabel === 'EXCELLENT'
                  ? 'Objectif : niveau maximum'
                  : '—'}
            </Text>
          </View>
        </View>

        <View style={styles.track}>
          <Animated.View style={[styles.fill, fillWidthStyle]} />
        </View>

        <View style={styles.legend}>
          <Text style={styles.legItem}>0</Text>
          <Text style={styles.legItem}>BON (600)</Text>
          <Text style={[styles.legItem, styles.legCurrent]}>
            {score?.currentScore ?? '—'}
          </Text>
          <Text style={styles.legItem}>Excellent (800)</Text>
          <Text style={styles.legItem}>1000</Text>
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 4,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginTop: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: {
    fontSize: 22,
    fontWeight: '500',
    color: COLORS.white,
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.white,
    marginBottom: 2,
  },
  phone: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 4,
  },
  kycBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  kycTxt: {
    fontSize: 10,
    color: COLORS.white,
    fontWeight: '500',
  },
  scoreCard: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  scoreTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scoreLeft: { flex: 1 },
  scoreKicker: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.75)',
  },
  scoreBig: {
    fontSize: 26,
    fontWeight: '500',
    color: COLORS.white,
    lineHeight: 30,
  },
  scoreLevel: {
    fontSize: 11,
    color: COLORS.secondary,
    fontWeight: '500',
    marginTop: 2,
  },
  scoreRight: { alignItems: 'flex-end' },
  progKicker: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  deltaMois: {
    fontSize: 13,
    fontWeight: '500',
  },
  objTxt: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
    textAlign: 'right',
  },
  track: {
    marginTop: 8,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    backgroundColor: COLORS.secondary,
    borderRadius: 4,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  legItem: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.6)',
  },
  legCurrent: {
    color: COLORS.secondary,
    fontWeight: '500',
  },
});
