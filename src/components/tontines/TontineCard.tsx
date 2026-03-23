/**
 * Carte tontine - carte de situation mobile-first.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { isMembershipPending } from '@/utils/tontineMerge';
import {
  deriveTontinePaymentUiState,
  getTontineListDueDateHeadingKey,
  resolveDisplayPaymentDate,
  resolveTontinePaymentContext,
} from '@/utils/tontinePaymentState';
import type { TontineListItem, TontineStatus, TontineFrequency } from '@/types/tontine';
import {
  getPersonalStatusKind,
  getPrimaryActionKind,
  type TontinePersonalStatusKind,
  type TontinePrimaryActionKind,
} from '@/screens/tontines/tontineListViewModel';

const GREEN = '#1A6B3C';
const ORANGE = '#F5A623';
const BLUE = '#0055A5';
const RED = '#D0021B';
const GRAY = '#6B7280';

const FREQ_KEYS: Record<TontineFrequency, string> = {
  DAILY: 'createTontine.freqDAILY',
  WEEKLY: 'createTontine.freqWEEKLY',
  BIWEEKLY: 'createTontine.freqBIWEEKLY',
  MONTHLY: 'createTontine.freqMONTHLY',
};

const STATUS_KEYS: Record<TontineStatus, string> = {
  DRAFT: 'tontineList.statusDraft',
  ACTIVE: 'tontineList.statusActive',
  BETWEEN_ROUNDS: 'tontineList.statusBetweenRounds',
  PAUSED: 'tontineList.statusPaused',
  COMPLETED: 'tontineList.statusCompleted',
  CANCELLED: 'tontineList.statusCancelled',
};

const STATUS_COLORS: Record<TontineStatus, string> = {
  DRAFT: ORANGE,
  ACTIVE: GREEN,
  BETWEEN_ROUNDS: BLUE,
  PAUSED: ORANGE,
  COMPLETED: GRAY,
  CANCELLED: RED,
};

function formatFcfa(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} FCFA`;
}

function formatDateLong(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateShort(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const date = new Date(`${dateStr.split('T')[0]}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function roleLabel(item: TontineListItem, t: (key: string, fallback: string) => string): string {
  return item.isCreator === true || item.membershipRole === 'CREATOR'
    ? t('tontineList.organizer', 'Organisateur')
    : t('tontineList.memberRole', 'Membre');
}

function personalStatusMeta(
  kind: TontinePersonalStatusKind,
  item: TontineListItem,
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string
): { label: string; color: string; background: string } {
  switch (kind) {
    case 'INVITATION_RECEIVED':
      return {
        label: t('tontineList.invitationReceived', 'Invitation reçue'),
        color: GREEN,
        background: '#E8F5E9',
      };
    case 'VALIDATION_PENDING':
      return {
        label: t('tontineList.pendingBadge', 'En attente'),
        color: GRAY,
        background: '#F3F4F6',
      };
    case 'PAYMENT_DUE':
      return {
        label: t('tontineList.personalDue', 'Cotisation attendue'),
        color: ORANGE,
        background: '#FFF7E6',
      };
    case 'OVERDUE':
      return {
        label: t('tontineList.personalOverdue', 'En retard'),
        color: RED,
        background: '#FEE2E2',
      };
    case 'PROCESSING':
      return {
        label: t('tontineList.personalProcessing', 'En traitement'),
        color: BLUE,
        background: '#E8F1FF',
      };
    case 'UP_TO_DATE':
      return {
        label: t('tontineList.personalUpToDate', 'À jour'),
        color: GREEN,
        background: '#E8F5E9',
      };
    case 'DRAFT':
      return {
        label: t('tontineList.statusDraft', 'Brouillon'),
        color: ORANGE,
        background: '#FFF7E6',
      };
    default:
      return {
        label:
          item.status === 'COMPLETED'
            ? t('tontineList.personalClosed', 'Terminée')
            : t('tontineList.personalUnknown', 'Statut indisponible'),
        color: GRAY,
        background: '#F3F4F6',
      };
  }
}

function primaryActionLabel(
  kind: TontinePrimaryActionKind,
  t: (key: string, fallback: string) => string
): string {
  switch (kind) {
    case 'RESPOND':
      return t('tontineList.respond', 'Répondre');
    case 'FINALIZE':
      return t('common.continue', 'Continuer');
    case 'MANAGE':
      return t('tontineList.manage', 'Gérer');
    case 'PAY':
      return t('tontineList.payNow', 'Cotiser');
    case 'NEW_ROTATION':
      return t('tontineList.newRotationCta', 'Nouvelle rotation');
    default:
      return t('tontineList.viewDetails', 'Voir détails');
  }
}

function insightText(
  item: TontineListItem,
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string
): string {
  if (item.status === 'DRAFT') {
    return t(
      'tontineList.draftInsight',
      'Publiez et complétez cette tontine avant son démarrage.'
    );
  }

  if (isMembershipPending(item)) {
    return item.invitationOrigin === 'INVITE'
      ? t(
          'tontineList.pendingSubInvite',
          'Acceptez cette invitation pour activer la tontine.'
        )
      : t(
          'tontineList.pendingSubJoinRequest',
          'En attente de validation par l’organisateur.'
        );
  }

  if (item.status === 'BETWEEN_ROUNDS') {
    return t(
      'tontineList.rotationCompletedLine',
      'Rotation {{n}} complétée',
      { n: item.totalCycles }
    );
  }

  if (item.status === 'COMPLETED') {
    return t('tontineList.completedInsight', 'Cette tontine est terminée.');
  }

  if (item.status === 'CANCELLED') {
    return t('tontineList.cancelledInsight', 'Cette tontine a été annulée.');
  }

  if (item.status === 'PAUSED') {
    return t('tontineList.pausedInsight', 'Cette tontine est temporairement en pause.');
  }

  const payState = deriveTontinePaymentUiState(item);
  const paymentContext = resolveTontinePaymentContext(item);

  if (payState.uiStatus === 'OVERDUE') {
    return t('tontineList.overdueInsight', 'Cotisation attendue depuis {{count}} jour(s).', {
      count: payState.daysOverdue ?? 0,
    });
  }

  if (payState.uiStatus === 'DUE_TODAY') {
    return t('tontineList.dueTodayInsight', 'Cotisation attendue aujourd’hui.');
  }

  if (payState.uiStatus === 'DUE_SOON') {
    return t('tontineList.dueSoonInsight', 'Prochaine cotisation dans {{count}} jour(s).', {
      count: payState.daysLeft ?? 0,
    });
  }

  if (payState.uiStatus === 'UP_TO_DATE' && item.currentCycle != null) {
    return t('tontineList.turnSummary', 'Tour {{current}} sur {{total}}.', {
      current: item.currentCycle,
      total: item.totalCycles,
    });
  }

  if (paymentContext.totalDue > 0 && paymentContext.showAmountBreakdown) {
    return t('tontineList.amountDueSummary', '{{amount}} à verser sur le cycle courant.', {
      amount: formatFcfa(paymentContext.totalDue),
    });
  }

  if (item.activeMemberCount != null && item.currentCycle != null) {
    return t('tontineList.membersCycleSummary', '{{count}} membres actifs · Tour {{current}}/{{total}}', {
      count: item.activeMemberCount,
      current: item.currentCycle,
      total: item.totalCycles,
    });
  }

  if (item.startDate) {
    return t('tontineList.startsOn', 'Démarre le {{date}}', {
      date: formatDateLong(item.startDate),
    });
  }

  return t('tontineList.genericInsight', 'Consultez les détails de cette tontine.');
}

export interface TontineCardProps {
  item: TontineListItem;
  onPress: (item: TontineListItem) => void;
  onInvitePress?: (uid: string, name: string) => void;
  PaymentDueBadge?: React.ComponentType;
  onNewRotationPress?: (item: TontineListItem) => void;
}

export const TontineCard: React.FC<TontineCardProps> = ({
  item,
  onPress,
  onNewRotationPress,
}) => {
  const { t } = useTranslation();
  const statusLabel = t(STATUS_KEYS[item.status], STATUS_KEYS[item.status]);
  const frequencyLabel = t(FREQ_KEYS[item.frequency ?? 'MONTHLY'], item.frequency ?? 'MONTHLY');
  const cycleLabel =
    item.currentCycle != null
      ? t('tontineList.cycleFormat', 'Cycle {{current}} / {{total}}', {
          current: item.currentCycle,
          total: item.totalCycles,
        })
      : t('tontineList.notStarted', 'Non démarré');
  const rawDue = resolveDisplayPaymentDate(item);
  const dueDate = formatDateShort(rawDue ?? undefined);
  const dueHeadingKey = getTontineListDueDateHeadingKey(item);
  const personalStatus = personalStatusMeta(getPersonalStatusKind(item), item, t);
  const actionKind = getPrimaryActionKind(item);
  const actionLabel = primaryActionLabel(actionKind, t);
  const creator = item.isCreator === true || item.membershipRole === 'CREATOR';
  const handlePrimaryAction = () => {
    if (actionKind === 'NEW_ROTATION' && onNewRotationPress) {
      onNewRotationPress(item);
      return;
    }
    if (item.status === 'DRAFT' && item.canInvite) {
      onPress(item);
      return;
    }
    onPress(item);
  };

  // 1. membershipStatus === 'PENDING'
  if (isMembershipPending(item)) {
    return (
      <View style={styles.pendingCard}>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={[styles.statusBadge, styles.pendingBadgeWrap]}>
            <Text style={styles.statusBadgeText}>{statusLabel}</Text>
          </View>
        </View>

        <Text style={styles.primaryAmount}>{formatFcfa(item.amountPerShare)}</Text>
        <Text style={styles.metaLine}>
          {frequencyLabel} · {cycleLabel}
        </Text>
        <Text style={styles.infoRowLabel}>
          {item.invitationOrigin === 'INVITE'
            ? t('tontineList.invitationReceived', 'Invitation reçue')
            : t('tontineList.pendingBadge', 'En attente')}
        </Text>
        <Text style={styles.pendingText}>{insightText(item, t)}</Text>
        {item.invitationOrigin === 'INVITE' ? (
          <Pressable
            style={styles.primaryButton}
            onPress={() => onPress(item)}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
          >
            <Text style={styles.primaryButtonText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  // 2. status === 'DRAFT'
  if (item.status === 'DRAFT') {
    return (
      <Pressable
        style={styles.card}
        onPress={() => onPress(item)}
        accessibilityRole="button"
        accessibilityLabel={item.name}
      >
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS.DRAFT }]}>
            <Text style={styles.statusBadgeText}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.amountRow}>
          <Text style={styles.primaryAmount}>{formatFcfa(item.amountPerShare)}</Text>
          <Text style={styles.secondaryMeta}>{frequencyLabel}</Text>
        </View>
        <Text style={styles.metaLine}>{cycleLabel}</Text>
        <Text style={styles.infoRowLabel}>{t('tontineList.draftReadyLabel', 'Statut personnel')}</Text>
        <View style={styles.pillsRow}>
          <View style={[styles.subBadge, { backgroundColor: personalStatus.background }]}>
            <Text style={[styles.subBadgeText, { color: personalStatus.color }]}>
              {t('tontineList.pendingFinalization', 'À finaliser')}
            </Text>
          </View>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{roleLabel(item, t)}</Text>
          </View>
        </View>
        <Text style={styles.insightText}>{insightText(item, t)}</Text>

        <View style={styles.actionsRow}>
          <Pressable
            style={styles.primaryButton}
            onPress={handlePrimaryAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
          >
            <Text style={styles.primaryButtonText}>{actionLabel}</Text>
          </Pressable>
        </View>
      </Pressable>
    );
  }

  // 3. ACTIVE and other standard states
  return (
    <Pressable
      style={styles.card}
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={item.name}
    >
      <View style={styles.headerRow}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] }]}>
          <Text style={styles.statusBadgeText}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.amountRow}>
        <Text style={styles.primaryAmount}>{formatFcfa(item.amountPerShare)}</Text>
        <Text style={styles.secondaryMeta}>{frequencyLabel}</Text>
      </View>

      <Text style={styles.metaLine}>{cycleLabel}</Text>

      <View style={styles.dueRow}>
        <Ionicons
          name="calendar-outline"
          size={16}
          color={item.status === 'CANCELLED' ? RED : GREEN}
        />
        <Text style={styles.dueText}>
          {dueDate
            ? dueHeadingKey === 'currentDue'
              ? t('tontineList.currentDueWithDate', 'Échéance actuelle : {{date}}', {
                  date: dueDate,
                })
              : t('tontineList.nextDueWithDate', 'Prochaine échéance : {{date}}', {
                  date: dueDate,
                })
            : t('tontineList.dateUndefined', 'Date non définie')}
        </Text>
      </View>

      <View style={styles.pillsRow}>
        <View style={[styles.subBadge, { backgroundColor: personalStatus.background }]}>
          <Text style={[styles.subBadgeText, { color: personalStatus.color }]}>
            {personalStatus.label}
          </Text>
        </View>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{roleLabel(item, t)}</Text>
        </View>
      </View>

      <Text style={styles.insightText}>{insightText(item, t)}</Text>

      <View style={styles.actionsRow}>
        <Pressable
          style={styles.primaryButton}
          onPress={handlePrimaryAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.primaryButtonText}>{actionLabel}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  pendingCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    opacity: 0.95,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pendingBadgeWrap: {
    backgroundColor: '#9CA3AF',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
    marginTop: 12,
  },
  primaryAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: GREEN,
  },
  secondaryMeta: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  metaLine: {
    marginTop: 4,
    fontSize: 14,
    color: '#6B7280',
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  dueText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  subBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  subBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  roleBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  infoRowLabel: {
    marginTop: 14,
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  insightText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 19,
    color: '#374151',
  },
  pendingText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: '#4B5563',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
