/**
 * Mini KPI — score compact + 1 à 2 indicateurs selon le rôle.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CompactScoreCard } from '@/components/dashboard/home/CompactScoreCard';
import type { ScoreLabel } from '@/api/types/api.types';
import { formatFcfa } from '@/utils/formatters';

export type HomeKpiRowVariant = 'member' | 'organizer';

export interface HomeKpiRowProps {
  variant: HomeKpiRowVariant;
  score: number | null;
  scoreLabel: ScoreLabel | null;
  scoreLoading: boolean;
  scoreError: boolean;
  onScoreDetail: () => void;
  memberTotalEngaged?: number;
  memberNextDueLabel?: string | null;
  organizerCashPending?: number;
  organizerCollectedHint?: string | null;
  memberKpiLoading?: boolean;
  organizerKpiLoading?: boolean;
}

function MiniKpi({
  title,
  value,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  value: string;
  subtitle?: string | null;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}) {
  const Inner = (
    <>
      <Text style={styles.miniTitle}>{title}</Text>
      <View style={styles.miniRow}>
        <Ionicons name={icon} size={18} color="#1A6B3C" />
        <Text style={styles.miniValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
      {subtitle != null && subtitle !== '' ? (
        <Text style={styles.miniSub} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </>
  );
  if (onPress != null) {
    return (
      <Pressable
        style={({ pressed }) => [styles.miniCard, pressed && styles.pressed]}
        onPress={onPress}
        accessibilityRole="button"
      >
        {Inner}
      </Pressable>
    );
  }
  return <View style={styles.miniCard}>{Inner}</View>;
}

export const HomeKpiRow: React.FC<HomeKpiRowProps> = ({
  variant,
  score,
  scoreLabel,
  scoreLoading,
  scoreError,
  onScoreDetail,
  memberTotalEngaged,
  memberNextDueLabel,
  organizerCashPending,
  organizerCollectedHint,
  memberKpiLoading,
  organizerKpiLoading,
}) => {
  const pad = { paddingHorizontal: 20 };

  if (variant === 'member') {
    return (
      <View style={pad}>
        <View style={styles.rowTwo}>
          <View style={styles.flexItem}>
            <CompactScoreCard
              score={score}
              scoreLabel={scoreLabel}
              isLoading={scoreLoading}
              isError={scoreError}
              onPressDetail={onScoreDetail}
            />
          </View>
          <MiniKpi
            title="Engagement"
            value={
              memberKpiLoading
                ? '…'
                : memberTotalEngaged != null
                  ? formatFcfa(memberTotalEngaged)
                  : '—'
            }
            subtitle={memberNextDueLabel ?? undefined}
            icon="layers-outline"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={pad}>
      <CompactScoreCard
        score={score}
        scoreLabel={scoreLabel}
        isLoading={scoreLoading}
        isError={scoreError}
        onPressDetail={onScoreDetail}
      />
      <View style={[styles.rowTwo, { marginTop: 10 }]}>
        <MiniKpi
          title="Validations espèces"
          value={
            organizerKpiLoading
              ? '…'
              : organizerCashPending != null
                ? String(organizerCashPending)
                : '0'
          }
          subtitle="en attente"
          icon="cash-outline"
        />
        <MiniKpi
          title="Collectes"
          value={organizerCollectedHint != null ? organizerCollectedHint : '—'}
          subtitle="détail par tontine"
          icon="stats-chart-outline"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  rowTwo: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
  },
  flexItem: {
    flex: 1,
    minWidth: 0,
  },
  miniCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 110,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.9,
  },
  miniTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  miniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  miniValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C1C1E',
    flex: 1,
  },
  miniSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 6,
    lineHeight: 14,
  },
});
