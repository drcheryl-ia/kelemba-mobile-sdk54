/**
 * Carte tontine — variante standard ou DRAFT avec CTA inviter.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { isMembershipPending } from '@/utils/tontineMerge';
import { GradientBorderCard } from '@/components/common/GradientBorderCard';
import type { TontineListItem, TontineStatus, TontineFrequency } from '@/types/tontine';

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
  DRAFT: '#9E9E9E',
  ACTIVE: '#1A6B3C',
  BETWEEN_ROUNDS: '#F5A623',
  PAUSED: '#F5A623',
  COMPLETED: '#0055A5',
  CANCELLED: '#D0021B',
};

function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Calcule le nombre de jours restants depuis une date ISO retournée
 * par le serveur. Retourne null si dateStr est absent.
 * On tronque les deux dates à minuit UTC pour ignorer l'heure.
 */
function computeDaysLeft(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const due = new Date(dateStr.split('T')[0] + 'T00:00:00.000Z');
  const now = new Date();
  const todayUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  return Math.round((due.getTime() - todayUTC.getTime()) / 86_400_000);
}

function urgencyColor(daysLeft: number | null): string {
  if (daysLeft === null) return '#6B7280';
  if (daysLeft < 0) return '#D0021B';
  if (daysLeft <= 2) return '#F5A623';
  return '#1A6B3C';
}

function urgencyLabel(daysLeft: number | null): string {
  if (daysLeft === null) return '';
  if (daysLeft < 0) return `En retard de ${Math.abs(daysLeft)} jour(s)`;
  if (daysLeft === 0) return "Dû aujourd'hui";
  if (daysLeft === 1) return 'Dû demain';
  return `Dans ${daysLeft} jours`;
}

function formatFcfa(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} FCFA`;
}

export interface TontineCardProps {
  item: TontineListItem;
  onPress: (item: TontineListItem) => void;
  onInvitePress: (uid: string, name: string) => void;
  PaymentDueBadge?: React.ComponentType;
  /** Créateur : CTA « Nouvelle rotation » (détail avec panneau d’activation) */
  onNewRotationPress?: (item: TontineListItem) => void;
}

export const TontineCard: React.FC<TontineCardProps> = ({
  item,
  onPress,
  onInvitePress,
  PaymentDueBadge,
  onNewRotationPress,
}) => {
  const { t } = useTranslation();
  const isDraft = item.status === 'DRAFT';
  const statusLabel = t(STATUS_KEYS[item.status]);
  const statusColor = STATUS_COLORS[item.status];
  const freqLabel = t(FREQ_KEYS[item.frequency ?? 'MONTHLY']);

  // ── PRIORITÉ 1 : membership PENDING — grisage systématique ──────────
  const isMembershipPendingState = isMembershipPending(item);
  if (isMembershipPendingState) {
    const isJoinRequest = item.invitationOrigin === 'JOIN_REQUEST';
    const pendingBadgeLabel = t('tontineList.pendingBadge', 'En attente');
    const pendingSubLabel = isJoinRequest
      ? t('tontineList.pendingSubJoinRequest', 'En attente de validation par l\'organisateur.')
      : item.invitationOrigin === 'INVITE'
        ? t('tontineList.pendingSubInvite', 'Acceptez cette invitation pour rejoindre la tontine.')
        : t('tontineList.pendingSubGeneric', 'Adhésion non finalisée. Sera activée après validation.');

    return (
      <View style={styles.pendingCardWrapper}>
        <View style={styles.pendingCardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <Text style={styles.statusText}>{statusLabel}</Text>
            </View>
          </View>
          <Text style={styles.cardAmount}>
            {formatFcfa(item.amountPerShare)} / {t('tontineList.part', 'part')}
          </Text>
          <Text style={styles.cardFreq}>{freqLabel}</Text>
          <Text style={styles.cardCycle}>
            {item.totalCycles} {t('tontineList.cycles', 'cycles')}
          </Text>
        </View>
        <View style={styles.pendingOverlay}>
          <View style={styles.pendingBadge}>
            <Ionicons name="time-outline" size={16} color="#FFFFFF" />
            <Text style={styles.pendingBadgeText}>{pendingBadgeLabel}</Text>
          </View>
          <Text style={styles.pendingSubText}>{pendingSubLabel}</Text>
        </View>
      </View>
    );
  }

  // ── PRIORITÉ 2 : tontine DRAFT (organisateur) ────────────────────────
  if (isDraft) {
    const memberCount = item.activeMemberCount ?? 1;
    const startDateFormatted = item.startDate
      ? formatDateLong(item.startDate)
      : t('tontineList.dateUndefined', 'Date non définie');
    const notStartedBadgeLabel = t('tontineList.notStartedBadge', 'Non démarrée');
    const notStartedSubLabel = t('tontineList.notStartedSub', 'Cette tontine n\'a pas encore démarré.');

    return (
      <Pressable
        style={styles.draftCard}
        onPress={() => onPress(item)}
        accessibilityRole="button"
        accessibilityLabel={item.name}
      >
        <View style={styles.draftBadgesRow}>
          <View style={styles.draftBadge}>
            <Text style={styles.draftBadgeText}>{statusLabel}</Text>
          </View>
          <View style={styles.notStartedBadge}>
            <Text style={styles.notStartedBadgeText}>{notStartedBadgeLabel}</Text>
          </View>
        </View>
        <Text style={styles.draftCardName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.draftCardNotStartedSub}>{notStartedSubLabel}</Text>
        <Text style={styles.draftCardSub}>
          {item.startDate
            ? t('tontineList.startsOn', 'Démarre le {{date}}', { date: startDateFormatted })
            : startDateFormatted}
        </Text>
        <Text style={styles.draftCardMeta}>
          {formatFcfa(item.amountPerShare)} · {freqLabel} · {item.totalCycles}{' '}
          {t('tontineList.cycles', 'cycles')}
        </Text>
        <Text style={styles.draftCardMembers}>
          👥 {t('tontineList.memberCount', '{{count}} membre(s)', { count: memberCount })}
        </Text>
        {(item.canInvite ?? item.isCreator ?? false) && (
          <Pressable
            style={styles.inviteCtaButton}
            onPress={() => onInvitePress(item.uid, item.name)}
            accessibilityRole="button"
            accessibilityLabel={t('tontineList.inviteMembersCta', 'Inviter des membres')}
          >
            <Ionicons name="mail-outline" size={20} color="#FFFFFF" />
            <Text style={styles.inviteCtaText}>
              {t('tontineList.inviteMembersCta', 'Inviter des membres')} →
            </Text>
          </Pressable>
        )}
      </Pressable>
    );
  }

  // ── PRIORITÉ 3 : BETWEEN_ROUNDS (entre deux rotations) ────────────────
  if (item.status === 'BETWEEN_ROUNDS') {
    const isOrganizer =
      item.isCreator ?? item.membershipRole === 'CREATOR';
    const handleNewRotation = () => {
      if (onNewRotationPress) onNewRotationPress(item);
      else onPress(item);
    };

    const betweenRoundsNode = (
      <View style={[styles.card, styles.cardActive]}>
        <Pressable
          onPress={() => onPress(item)}
          accessibilityRole="button"
          accessibilityLabel={item.name}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.name}
            </Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: '#F5A623' },
              ]}
            >
              <Text style={styles.statusText}>
                {t(
                  'tontineList.betweenRoundsBadge',
                  'Rotation terminée'
                )}
              </Text>
            </View>
          </View>
          <Text style={styles.cardCycle}>
            {t('tontineList.rotationCompletedLine', 'Rotation {{n}} complétée', {
              n: item.totalCycles,
            })}
          </Text>
          <Text style={styles.cardAmount}>
            {formatFcfa(item.amountPerShare)} / {t('tontineList.part', 'part')}
          </Text>
          <Text style={styles.cardFreq}>{freqLabel}</Text>
        </Pressable>
        {isOrganizer ? (
          <Pressable
            style={styles.newRotationBtn}
            onPress={handleNewRotation}
            accessibilityRole="button"
            accessibilityLabel={t(
              'tontineList.newRotationCta',
              'Nouvelle rotation'
            )}
          >
            <Text style={styles.newRotationBtnText}>
              {t('tontineList.newRotationCta', 'Nouvelle rotation')} →
            </Text>
          </Pressable>
        ) : null}
      </View>
    );

    return (
      <GradientBorderCard
        style={styles.cardGradientWrapper}
        innerStyle={styles.cardGradientInner}
      >
        {betweenRoundsNode}
      </GradientBorderCard>
    );
  }

  const isActiveConfirmed = item.status === 'ACTIVE';

  const cardNode = (
    <Pressable
      style={[styles.card, isActiveConfirmed && styles.cardActive]}
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={item.name}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      </View>
      <Text style={styles.cardCycle}>
        {item.currentCycle != null
          ? t('tontineList.cycleFormat', 'Cycle {{current}} / {{total}}', {
              current: item.currentCycle,
              total: item.totalCycles,
            })
          : t('tontineList.notStarted', 'Non démarré')}
      </Text>
      <Text style={styles.cardAmount}>
        {formatFcfa(item.amountPerShare)} / {t('tontineList.part', 'part')}
      </Text>
      <Text style={styles.cardFreq}>{freqLabel}</Text>
      {item.hasPaymentDue && PaymentDueBadge && <PaymentDueBadge />}
      {item.nextPaymentDate && (() => {
        const daysLeft = computeDaysLeft(item.nextPaymentDate);
        const color = urgencyColor(daysLeft);
        const label = urgencyLabel(daysLeft);
        const listItem = item as TontineListItem & { userSharesCount?: number };
        const amountDue =
          listItem.amountPerShare * (listItem.userSharesCount ?? 1);

        return (
          <View style={styles.paymentDueBlock}>
            {/* Date longue + décompte coloré */}
            <View style={styles.paymentDueRow}>
              <Ionicons name="calendar-outline" size={14} color={color} />
              <Text style={[styles.paymentDueDate, { color }]}>
                {formatDateLong(item.nextPaymentDate)}
              </Text>
            </View>
            <View style={styles.paymentDueRow}>
              <Ionicons name="time-outline" size={14} color={color} />
              <Text style={[styles.paymentDueCountdown, { color }]}>
                {label}
              </Text>
            </View>
            {/* Montant dû */}
            <View style={styles.paymentDueRow}>
              <Ionicons name="wallet-outline" size={14} color="#1C1C1E" />
              <Text style={styles.paymentDueAmount}>
                {formatFcfa(amountDue)} à verser
              </Text>
              {item.hasPaymentDue && (
                <View style={styles.penaltyPill}>
                  <Ionicons name="warning-outline" size={11} color="#FFFFFF" />
                  <Text style={styles.penaltyPillText}>Pénalités</Text>
                </View>
              )}
            </View>
          </View>
        );
      })()}
      {item.membershipRole === 'CREATOR' && (
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{t('tontineList.organizer', 'Organisateur')}</Text>
        </View>
      )}
    </Pressable>
  );

  if (isActiveConfirmed) {
    return (
      <GradientBorderCard
        style={styles.cardGradientWrapper}
        innerStyle={styles.cardGradientInner}
      >
        {cardNode}
      </GradientBorderCard>
    );
  }

  return cardNode;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardActive: {
    marginBottom: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  cardGradientWrapper: {
    marginBottom: 12,
    marginHorizontal: 0,
  },
  cardGradientInner: {
    padding: 0,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cardCycle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  cardAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  cardFreq: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  paymentDueBlock: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    gap: 5,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  paymentDueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paymentDueDate: {
    fontSize: 12,
    fontWeight: '600',
  },
  paymentDueCountdown: {
    fontSize: 13,
    fontWeight: '700',
  },
  paymentDueAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
    flex: 1,
  },
  penaltyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#D0021B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  penaltyPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5A623',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  draftCard: {
    borderWidth: 1.5,
    borderColor: '#1A6B3C',
    borderStyle: 'dashed',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 12,
  },
  draftBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  draftBadge: {
    backgroundColor: '#E8F5EE',
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  draftBadgeText: {
    color: '#1A6B3C',
    fontSize: 12,
    fontWeight: '600',
  },
  notStartedBadge: {
    backgroundColor: '#6B7280',
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  notStartedBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  draftCardNotStartedSub: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
    fontStyle: 'italic',
  },
  draftCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 12,
    marginBottom: 4,
  },
  draftCardSub: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 4,
  },
  draftCardMeta: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 8,
  },
  draftCardMembers: {
    fontSize: 12,
    color: '#8E8E93',
  },
  inviteCtaButton: {
    backgroundColor: '#F5A623',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    minHeight: 44,
  },
  inviteCtaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  newRotationBtn: {
    marginTop: 12,
    alignSelf: 'stretch',
    backgroundColor: '#1A6B3C',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newRotationBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  cardPending: {
    opacity: 0.75,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
  },
  pendingCardWrapper: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
  },
  pendingCardContent: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    opacity: 0.6,
  },
  pendingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(55,65,81,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  pendingBadgeText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pendingSubText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 18,
  },
});
