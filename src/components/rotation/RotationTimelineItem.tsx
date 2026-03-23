/**
 * Item de timeline — carte de cycle avec icône statut.
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { RotationCycle, CycleDisplayStatus } from '@/types/rotation';

export interface RotationTimelineItemProps {
  cycle: RotationCycle;
  showProgressBar: boolean;
  /** Affiche le badge R{n} (rotation globale) à côté du libellé de tour */
  showRotationBadge?: boolean;
}

const DISPLAY_CONFIG: Record<
  CycleDisplayStatus,
  { icon: string; bg: string; border: string }
> = {
  VERSÉ: { icon: 'checkmark', bg: '#27AE60', border: 'transparent' },
  EN_COURS: { icon: 'time', bg: '#FFF8EC', border: '#F5A623' },
  PROCHAIN: { icon: 'star', bg: '#1A3C2E', border: '#1A3C2E' },
  À_VENIR: { icon: 'arrow-forward', bg: '#F5F5F5', border: '#E5E5EA' },
  RETARDÉ: { icon: 'warning', bg: '#FFF0F0', border: '#D0021B' },
};

function formatDateFr(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

const STATUS_LABELS: Record<CycleDisplayStatus, string> = {
  VERSÉ: 'VERSÉ',
  EN_COURS: 'EN COURS',
  PROCHAIN: 'PROCHAIN',
  À_VENIR: 'À VENIR',
  RETARDÉ: 'RETARDÉ',
};

export const RotationTimelineItem: React.FC<RotationTimelineItemProps> = ({
  cycle,
  showProgressBar,
  showRotationBadge = false,
}) => {
  const { t } = useTranslation();
  const config = DISPLAY_CONFIG[cycle.displayStatus];
  const isDarkCard = cycle.displayStatus === 'PROCHAIN';
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (cycle.displayStatus === 'EN_COURS') {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.5,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
  }, [cycle.displayStatus, opacity]);

  const progressPercent = Math.round(cycle.collectionProgress * 100);

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: config.bg, borderColor: config.border },
          config.border !== 'transparent' && styles.iconCircleBordered,
        ]}
      >
        <Ionicons
          name={config.icon as keyof typeof Ionicons.glyphMap}
          size={20}
          color={
            cycle.displayStatus === 'PROCHAIN' ? '#FFFFFF' : '#1A1A1A'
          }
        />
      </View>
      <View
        style={[
          styles.card,
          isDarkCard && styles.cardDark,
          cycle.displayStatus === 'EN_COURS' && styles.cardInProgress,
        ]}
      >
        <View style={styles.header}>
          <View style={styles.labelRow}>
            <Text
              style={[
                styles.tourLabel,
                isDarkCard && styles.textWhite,
              ]}
              numberOfLines={2}
            >
              {`Tour ${cycle.cycleNumber}`}
              {cycle.beneficiaryName ? ` : ${cycle.beneficiaryName}` : ''}
            </Text>
            {showRotationBadge ? (
              <View style={styles.rotationRoundPill}>
                <Text style={styles.rotationRoundPillText}>
                  R{cycle.rotationRound}
                </Text>
              </View>
            ) : null}
          </View>
          <Animated.View
            style={[
              styles.badge,
              cycle.displayStatus === 'VERSÉ' && styles.badgeVersed,
              cycle.displayStatus === 'EN_COURS' && styles.badgeInProgress,
              cycle.displayStatus === 'PROCHAIN' && styles.badgeNext,
              cycle.displayStatus === 'À_VENIR' && styles.badgeUpcoming,
              cycle.displayStatus === 'RETARDÉ' && styles.badgeDelayed,
              cycle.displayStatus === 'EN_COURS' && { opacity },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                cycle.displayStatus === 'PROCHAIN' && styles.badgeTextWhite,
                cycle.displayStatus === 'À_VENIR' && styles.badgeTextUpcoming,
              ]}
            >
              {STATUS_LABELS[cycle.displayStatus]}
            </Text>
          </Animated.View>
        </View>
        <Text
          style={[
            styles.date,
            isDarkCard ? styles.textWhiteMuted : styles.textMuted,
          ]}
        >
          {formatDateFr(cycle.expectedDate)}
        </Text>
        {cycle.isCurrentUserBeneficiary && cycle.displayStatus === 'PROCHAIN' && (
          <View style={styles.yourTurnBanner}>
            <Text style={styles.yourTurnText}>
              {t(
                'rotation.yourTurnContributorHint',
                'Vous recevez le pot ce tour une fois votre cotisation enregistrée.'
              )}
            </Text>
          </View>
        )}
        {cycle.beneficiaryNetAmount != null && cycle.beneficiaryNetAmount > 0 && (
          <Text
            style={[
              styles.netPayoutText,
              isDarkCard ? styles.textWhiteMuted : styles.textMuted,
            ]}
          >
            {t('rotation.netPayoutLabel', 'Bénéfice net (pot − votre cotisation)')} :{' '}
            {cycle.beneficiaryNetAmount.toLocaleString('fr-FR')} FCFA
          </Text>
        )}
        {showProgressBar && (
          <View style={styles.progressSection}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${cycle.collectionProgress * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.progressLabel}>
              {progressPercent}% {t('rotation.collected')}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  iconCircleBordered: {
    borderWidth: 2,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  cardDark: {
    backgroundColor: '#1A3C2E',
    borderColor: '#1A3C2E',
  },
  cardInProgress: {
    backgroundColor: '#FFF8EC',
    borderWidth: 2,
    borderColor: '#F5A623',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  labelRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    minWidth: 0,
  },
  tourLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  rotationRoundPill: {
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    flexShrink: 0,
  },
  rotationRoundPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1A6B3C',
  },
  textWhite: {
    color: '#FFFFFF',
  },
  textMuted: {
    color: '#8E8E93',
  },
  textWhiteMuted: {
    color: 'rgba(255,255,255,0.8)',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeVersed: {
    backgroundColor: '#27AE60',
  },
  badgeInProgress: {
    backgroundColor: '#F5A623',
  },
  badgeNext: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  badgeUpcoming: {
    backgroundColor: '#E5E5EA',
  },
  badgeTextUpcoming: {
    color: '#8E8E93',
  },
  badgeDelayed: {
    backgroundColor: '#D0021B',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  badgeTextWhite: {
    color: '#FFFFFF',
  },
  date: {
    fontSize: 13,
    marginBottom: 8,
  },
  yourTurnBanner: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  yourTurnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  netPayoutText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  progressSection: {
    marginTop: 4,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E8F5EE',
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#27AE60',
  },
  progressLabel: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'right',
  },
});
