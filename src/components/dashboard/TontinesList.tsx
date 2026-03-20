import React from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { GradientBorderCard } from '@/components/common/GradientBorderCard';
import { isMembershipPending } from '@/utils/tontineMerge';
import {
  deriveTontinePaymentUiState,
  type BadgeTone,
} from '@/utils/tontinePaymentState';
import type { TontineFrequency } from '@/api/types/api.types';
import type { TontineListItem } from '@/types/tontine';

export interface TontinesListProps {
  tontines: TontineListItem[];
  isLoading: boolean;
  onTontinePress: (tontine: TontineListItem) => void;
  onSeeAllPress: () => void;
}

const formatFCFA = (amount: number): string =>
  new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';

const frequencyLabel: Record<TontineFrequency, string> = {
  DAILY: '/ jour',
  WEEKLY: '/ semaine',
  BIWEEKLY: '/ quinzaine',
  MONTHLY: '/ mois',
};

function badgeStyleForTone(tone: BadgeTone) {
  switch (tone) {
    case 'success':
      return styles.badgeGreen;
    case 'danger':
      return styles.badgeRed;
    case 'warning':
      return styles.badgeOrange;
    default:
      return styles.badgeGray;
  }
}

export const TontinesList: React.FC<TontinesListProps> = ({
  tontines,
  isLoading,
  onTontinePress,
  onSeeAllPress,
}) => {
  const { t } = useTranslation();
  const getPendingLabel = (tontine: TontineListItem) => {
    if (tontine.invitationOrigin === 'JOIN_REQUEST') {
      return t('tontineList.pendingSubJoinRequest', 'En attente de validation par l\'organisateur.');
    }
    if (tontine.invitationOrigin === 'INVITE') {
      return t('tontineList.pendingSubInvite', 'Acceptez cette invitation pour activer la tontine.');
    }
    return t('tontineList.pendingSubGeneric', 'Adhésion non finalisée. Cette tontine sera activée après validation.');
  };

  if (isLoading) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>MES TONTINES ACTIVES</Text>
        </View>
        <View style={styles.listVertical}>
          <SkeletonBlock width="100%" height={130} borderRadius={16} />
          <SkeletonBlock width="100%" height={130} borderRadius={16} />
        </View>
      </View>
    );
  }

  const isEmpty = tontines.length === 0;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>MES TONTINES ACTIVES</Text>
        <Pressable onPress={onSeeAllPress} hitSlop={8}>
          <Text style={styles.seeAll}>Voir tout</Text>
        </Pressable>
      </View>
      <View style={styles.listVertical}>
        {isEmpty ? (
          <View style={styles.emptyStateCard}>
            <Ionicons name="people-outline" size={28} color="#9CA3AF" />
            <Text style={styles.emptyStateText}>
              {t('dashboard.emptyActiveTontines', "Vous n'êtes pas membre d'aucune tontine")}
            </Text>
          </View>
        ) : (
          tontines.slice(0, 3).map((tontine) => {
          const isPending = isMembershipPending(tontine);
          const payUi = deriveTontinePaymentUiState(tontine);
          const dateLine =
            payUi.displayDate ??
            (payUi.uiStatus === 'UNKNOWN'
              ? t('dashboard.paymentDateUnavailable', 'Date indisponible')
              : '—');
          return (
            <GradientBorderCard
              key={tontine.uid}
              style={styles.tontineCardWrapper}
              innerStyle={
                (isPending
                  ? {
                      ...StyleSheet.flatten(styles.tontineCardInner),
                      ...StyleSheet.flatten(styles.tontineCardPending),
                    }
                  : styles.tontineCardInner) as ViewStyle
              }
            >
              <Pressable
                onPress={() => {
                  if (isPending) return;
                  onTontinePress(tontine);
                }}
                disabled={isPending}
                style={styles.tontineCardPressable}
                accessibilityRole="button"
                accessibilityLabel={tontine.name}
                accessibilityState={{ disabled: isPending }}
              >
                {isPending && (
                  <View style={styles.pendingRow}>
                    <Ionicons name="time-outline" size={12} color="#9CA3AF" />
                    <Text style={styles.pendingText}>
                      {t('tontineList.pendingBadge', 'En attente')} — {getPendingLabel(tontine)}
                    </Text>
                  </View>
                )}
                <View style={styles.cardHeader}>
                <Ionicons
                  name="storefront-outline"
                  size={24}
                  color="#6B7280"
                />
                <View style={styles.cardTitleSection}>
                  <Text style={[styles.tontineName, isPending && styles.textMuted]} numberOfLines={1}>
                    {tontine.name}
                  </Text>
                  <Text style={styles.amount}>
                    {formatFCFA(tontine.amountPerShare)}
                    {tontine.frequency ? frequencyLabel[tontine.frequency] : ' / mois'}
                  </Text>
                </View>
              </View>
              <View style={styles.cardFooter}>
                <View>
                  <Text style={styles.footerLabel}>PROCHAIN VERSEMENT</Text>
                  <Text style={styles.nextDate}>{dateLine}</Text>
                </View>
                <View style={[styles.badge, badgeStyleForTone(payUi.badgeTone)]}>
                  <Text style={styles.badgeText}>{payUi.badgeLabel}</Text>
                </View>
              </View>
            </Pressable>
          </GradientBorderCard>
          );
        })
        )
        }
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.8,
  },
  seeAll: {
    color: '#1A6B3C',
    fontWeight: '600',
    fontSize: 14,
  },
  listVertical: {
    paddingHorizontal: 20,
    gap: 12,
  },
  emptyStateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  tontineCardWrapper: {},
  tontineCardInner: {
    padding: 16,
  },
  tontineCardPressable: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  cardTitleSection: {
    flex: 1,
  },
  tontineName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  amount: {
    fontSize: 13,
    color: '#6B7280',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 2,
  },
  nextDate: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeGreen: {
    backgroundColor: '#DCFCE7',
  },
  badgeOrange: {
    backgroundColor: '#FEF3C7',
  },
  badgeRed: {
    backgroundColor: '#FEE2E2',
  },
  badgeGray: {
    backgroundColor: '#F3F4F6',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  tontineCardPending: {
    opacity: 0.55,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  pendingText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  textMuted: {
    color: '#9CA3AF',
  },
});
