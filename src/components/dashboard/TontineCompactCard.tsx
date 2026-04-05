import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { TontineListItem } from '@/types/tontine';
import type { TontineFrequency } from '@/api/types/api.types';
import { KelembaBadge } from '@/components/common/KelembaBadge';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';
import { formatFcfaAmount } from '@/utils/formatters';
import { isMembershipPending } from '@/utils/tontineMerge';
import {
  deriveTontinePaymentUiState,
  resolveTontineDueState,
} from '@/utils/tontinePaymentState';

export interface TontineCompactCardProps {
  item: TontineListItem;
  onPress: () => void;
}

function frequencyShort(f: TontineFrequency): string {
  switch (f) {
    case 'DAILY':
      return 'Quotidienne';
    case 'WEEKLY':
      return 'Hebdo';
    case 'BIWEEKLY':
      return 'Bimensuelle';
    case 'MONTHLY':
      return 'Mensuelle';
    default:
      return '';
  }
}

export const TontineCompactCard: React.FC<TontineCompactCardProps> = ({
  item,
  onPress,
}) => {
  const pending = isMembershipPending(item);
  const ui = deriveTontinePaymentUiState(item);
  const dueState = resolveTontineDueState(item);

  const badge = useMemo(() => {
    if (pending) {
      return { variant: 'pending' as const, label: 'En attente' };
    }
    if (item.status === 'DRAFT') {
      return { variant: 'draft' as const, label: 'Brouillon' };
    }
    if (item.status === 'ACTIVE' || item.status === 'BETWEEN_ROUNDS') {
      return { variant: 'active' as const, label: 'Active' };
    }
    return { variant: 'pending' as const, label: item.status };
  }, [item.status, pending]);

  const totalCycles = Math.max(1, item.totalCycles ?? 1);
  const current = Math.min(
    item.currentCycle ?? 0,
    totalCycles
  );
  const progress =
    item.status === 'ACTIVE' && item.currentCycle != null
      ? Math.min(100, Math.max(0, (current / totalCycles) * 100))
      : 0;

  const a11yLabel = useMemo(() => {
    if (pending) {
      return `${item.name}, adhésion en attente de validation`;
    }
    return `${item.name}, ${badge.label}, ${formatFcfaAmount(item.amountPerShare)} FCFA par part, cycle ${current} sur ${totalCycles}`;
  }, [badge.label, current, item.name, pending, item.amountPerShare, totalCycles]);

  const footer = useMemo(() => {
    if (item.status === 'DRAFT') {
      return { text: 'Activer →', color: COLORS.secondaryText as string };
    }
    if (item.status !== 'ACTIVE' && item.status !== 'BETWEEN_ROUNDS') {
      return { text: '—', color: COLORS.gray500 as string };
    }
    if (dueState === 'SETTLED' || ui.uiStatus === 'UP_TO_DATE') {
      return { text: 'Payé ✓', color: COLORS.primaryDark as string };
    }
    if (ui.uiStatus === 'OVERDUE') {
      return { text: 'En retard', color: COLORS.dangerText as string };
    }
    if (
      ui.needsPaymentAttention &&
      ui.daysLeft !== null &&
      ui.daysLeft >= 0
    ) {
      return {
        text: `· ${ui.daysLeft} j`,
        color: COLORS.secondaryText as string,
      };
    }
    if (ui.displayDate != null) {
      return {
        text: `Prochain: ${ui.displayDate}`,
        color: COLORS.gray500 as string,
      };
    }
    return { text: '—', color: COLORS.gray500 as string };
  }, [dueState, item.status, ui]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pending && styles.cardDisabled,
        { opacity: pressed ? 0.94 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
    >
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={2}>
          {item.name}
        </Text>
        <KelembaBadge variant={badge.variant} label={badge.label} />
      </View>
      <Text style={styles.amount}>
        {formatFcfaAmount(item.amountPerShare)}
        <Text style={styles.amountSuffix}>
          {' '}
          FCFA / part · {frequencyShort(item.frequency)}
        </Text>
      </Text>
      {(item.status === 'ACTIVE' || item.status === 'BETWEEN_ROUNDS') &&
      item.currentCycle != null ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress}%` }]} />
        </View>
      ) : (
        <View style={styles.trackSpacer} />
      )}
      <View style={styles.footer}>
        <Text style={styles.cycleHint}>
          Cycle {current} / {totalCycles}
        </Text>
        <Text style={[styles.footerRight, { color: footer.color }]}>
          {footer.text}
        </Text>
      </View>
      {pending ? (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>En attente de validation</Text>
        </View>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 180,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    padding: 14,
    position: 'relative',
  },
  cardDisabled: {
    opacity: 0.85,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 6,
  },
  name: {
    flex: 1,
    maxWidth: 120,
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  amount: {
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.primary,
  },
  amountSuffix: {
    fontSize: 10,
    fontWeight: '400',
    color: COLORS.gray500,
  },
  track: {
    height: 3,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 2,
    marginVertical: 10,
    overflow: 'hidden',
  },
  fill: {
    height: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  trackSpacer: {
    height: 23,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cycleHint: {
    fontSize: 10,
    color: COLORS.gray500,
  },
  footerRight: {
    fontSize: 10,
    fontWeight: '600',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245,245,240,0.7)',
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  overlayText: {
    fontSize: 11,
    color: COLORS.gray500,
    textAlign: 'center',
    fontWeight: '500',
  },
});
