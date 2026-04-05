import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { TontineDto } from '@/api/types/api.types';
import type { ScoreEventReason } from '@/api/types/api.types';
import type { ScoreResponseDto } from '@/types/user.types';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';
import { formatScoreEventDate } from '@/components/profile/profileHelpers';

export interface ScoreHistorySectionProps {
  score: ScoreResponseDto | null;
  tontines: TontineDto[];
  onSeeAll: () => void;
}

function reasonLabel(reason: ScoreEventReason): string {
  switch (reason) {
    case 'PAYMENT_ON_TIME':
      return 'Cotisation à temps';
    case 'PAYMENT_EARLY':
      return 'Cotisation en avance';
    case 'PAYMENT_LATE':
    case 'LATE_1_3_DAYS':
    case 'LATE_4_7_DAYS':
    case 'LATE_OVER_7_DAYS':
      return 'Retard de paiement';
    case 'PAYMENT_MISSED':
      return 'Cotisation manquée';
    case 'CYCLE_COMPLETED':
      return 'Cycle complété';
    case 'TONTINE_ABANDONED':
      return 'Abandon de tontine';
    case 'ADMIN_ADJUSTMENT':
      return 'Ajustement administrateur';
    case 'PENALTY_APPLIED':
      return 'Pénalité appliquée';
    case 'DISPUTE_LOST':
      return 'Litige';
    case 'BONUS_REFERRAL':
      return 'Bonus parrainage';
    default:
      return String(reason);
  }
}

export const ScoreHistorySection: React.FC<ScoreHistorySectionProps> = ({
  score,
  tontines,
  onSeeAll,
}) => {
  const nameByUid = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of tontines) {
      m[t.uid] = t.name;
    }
    return m;
  }, [tontines]);

  const recent = score?.history != null ? [...score.history].slice(0, 3) : [];

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Score Kelemba</Text>
      <View style={styles.card}>
        <View style={styles.head}>
          <Text style={styles.headTitle}>Historique récent</Text>
          <Pressable onPress={onSeeAll} hitSlop={8}>
            <Text style={styles.seeAll}>Voir tout</Text>
          </Pressable>
        </View>
        {recent.length === 0 ? (
          <Text style={styles.empty}>
            Aucun événement de score pour le moment
          </Text>
        ) : (
          recent.map((ev, idx) => {
            const dot =
              ev.delta > 0
                ? COLORS.primary
                : ev.delta < 0
                  ? COLORS.dangerText
                  : COLORS.gray500;
            const tname =
              ev.tontineUid != null ? nameByUid[ev.tontineUid] : undefined;
            const line1 =
              tname != null
                ? `${reasonLabel(ev.reason)} — ${tname}`
                : reasonLabel(ev.reason);
            const deltaTxt =
              ev.delta > 0
                ? `+${ev.delta} pts`
                : ev.delta < 0
                  ? `${ev.delta} pts`
                  : '0 pts';
            const deltaColor =
              ev.delta > 0 ? COLORS.primaryDark : ev.delta < 0 ? COLORS.dangerText : COLORS.gray500;

            return (
              <View
                key={ev.uid}
                style={[
                  styles.evRow,
                  idx === recent.length - 1 && styles.evRowLast,
                ]}
              >
                <View style={[styles.dot, { backgroundColor: dot }]} />
                <View style={styles.evMid}>
                  <Text style={styles.evReason} numberOfLines={2}>
                    {line1}
                  </Text>
                  <Text style={styles.evDate}>
                    {formatScoreEventDate(ev.createdAt)}
                  </Text>
                </View>
                <Text style={[styles.evDelta, { color: deltaColor }]}>
                  {deltaTxt}
                </Text>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.gray100,
  },
  headTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  seeAll: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '500',
  },
  empty: {
    padding: 16,
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.gray500,
  },
  evRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F1EFE8',
  },
  evRowLast: {
    borderBottomWidth: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  evMid: {
    flex: 1,
    minWidth: 0,
  },
  evReason: {
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  evDate: {
    fontSize: 10,
    color: COLORS.gray500,
    marginTop: 2,
  },
  evDelta: {
    fontSize: 13,
    fontWeight: '500',
  },
});
