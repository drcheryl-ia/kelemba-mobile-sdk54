/**
 * Carte héro Accueil — seule surface de rappel (priorité = buildDashboardReminderCards).
 * Shell aligné sur `DashboardReminderCard`.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NextPaymentData } from '@/types/payment';
import { formatFcfa } from '@/utils/formatters';
import type { DashboardReminderCardVm } from '@/components/dashboard/paymentReminderBanner.helpers';
import { DASHBOARD_REMINDER_TONES } from '@/components/dashboard/dashboardReminderTokens';
import { DashboardReminderCard } from '@/components/dashboard/DashboardReminderCard';
import type { DashboardReminderTone } from '@/components/dashboard/dashboardReminderTokens';
import { getDashboardReminderContent } from '@/components/dashboard/dashboardReminderContent';

export type HomeHeroCardProps = {
  reminders: DashboardReminderCardVm[];
  nextPayment: NextPaymentData | null;
  isLoading: boolean;
  nextPaymentAmountDue: number | null;
  nextPaymentPenaltyAmount: number | null;
  /** Affiché uniquement si `reminders` est vide (organisateur). */
  organizerFallback?: {
    cashPendingCount: number;
    overdueMembersHint: number;
  };
  onPressPrimary: () => void;
  onPressUpToDate: () => void;
  onOrganizerTreat?: () => void;
};

const MS_PER_DAY = 86_400_000;

function daysUntilDue(dueDate: string): number {
  const parts = dueDate.split('T')[0].split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return 0;
  const [y, m, d] = parts;
  const dueLocal = new Date(y, m - 1, d);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((dueLocal.getTime() - todayStart.getTime()) / MS_PER_DAY);
}

function memberHeroTitle(
  reminder: DashboardReminderCardVm | null,
  nextPayment: NextPaymentData | null
): { title: string; subtitle: string; tone: DashboardReminderTone } {
  if (reminder?.kind === 'pendingValidation') {
    return {
      title: 'Cotisation en attente de validation',
      subtitle: `${reminder.tontineName} · ${formatFcfa(reminder.amount)}`,
      tone: 'info',
    };
  }
  if (reminder?.kind === 'nextPayment' && reminder.dueDate) {
    const days = daysUntilDue(reminder.dueDate);
    if (days < 0) {
      return {
        title: 'Cotisation en retard',
        subtitle: `${reminder.tontineName} · ${formatFcfa(reminder.amount)}`,
        tone: 'danger',
      };
    }
    if (days === 0) {
      return {
        title: 'Cotisation à payer aujourd’hui',
        subtitle: `${reminder.tontineName} · ${formatFcfa(reminder.amount)}`,
        tone: 'warning',
      };
    }
    if (days <= 5) {
      return {
        title: 'Échéance proche',
        subtitle: `${reminder.tontineName} · ${formatFcfa(reminder.amount)}`,
        tone: 'warning',
      };
    }
    return {
      title: 'Prochaine cotisation',
      subtitle: `${reminder.tontineName} · ${formatFcfa(reminder.amount)}`,
      tone: 'info',
    };
  }
  if (nextPayment?.dueDate) {
    const days = daysUntilDue(nextPayment.dueDate);
    if (days < 0) {
      return {
        title: 'Cotisation en retard',
        subtitle: `${nextPayment.tontineName} · ${formatFcfa(nextPayment.totalDue)}`,
        tone: 'danger',
      };
    }
    if (days === 0) {
      return {
        title: 'Cotisation à payer aujourd’hui',
        subtitle: `${nextPayment.tontineName} · ${formatFcfa(nextPayment.totalDue)}`,
        tone: 'warning',
      };
    }
    return {
      title: 'Prochaine cotisation',
      subtitle: `${nextPayment.tontineName} · ${formatFcfa(nextPayment.totalDue)}`,
      tone: 'info',
    };
  }
  return {
    title: 'Tout est sous contrôle',
    subtitle: 'Aucune cotisation urgente pour le moment.',
    tone: 'success',
  };
}

function memberHeroIcon(
  primaryReminder: DashboardReminderCardVm | null,
  tone: DashboardReminderTone
): React.ComponentProps<typeof Ionicons>['name'] {
  if (tone === 'success') return 'checkmark-done-outline';
  if (primaryReminder?.kind === 'pendingValidation') return 'shield-checkmark-outline';
  if (tone === 'danger') return 'alert-circle-outline';
  return 'wallet-outline';
}

export const HomeHeroCard: React.FC<HomeHeroCardProps> = (props) => {
  const {
    reminders,
    nextPayment,
    isLoading,
    nextPaymentAmountDue,
    nextPaymentPenaltyAmount,
    organizerFallback,
    onPressPrimary,
    onPressUpToDate,
    onOrganizerTreat,
  } = props;

  const primary = reminders[0] ?? null;
  const otherCount = Math.max(0, reminders.length - 1);

  if (organizerFallback != null && reminders.length === 0) {
    const { cashPendingCount, overdueMembersHint } = organizerFallback;
    const hasWork = cashPendingCount > 0 || overdueMembersHint > 0;
    const colors = hasWork ? DASHBOARD_REMINDER_TONES.warning : DASHBOARD_REMINDER_TONES.success;
    return (
      <View style={[styles.wrap, { backgroundColor: colors.bg, borderColor: colors.border }]}>
        {isLoading ? (
          <ActivityIndicator color={colors.accent} style={{ paddingVertical: 24 }} />
        ) : (
          <>
            <View style={styles.heroTop}>
              <View style={[styles.iconCircle, { backgroundColor: colors.accent }]}>
                <Ionicons
                  name={hasWork ? 'flash-outline' : 'checkmark-done-outline'}
                  size={22}
                  color="#FFF"
                />
              </View>
              <View style={styles.heroText}>
                <Text style={styles.heroTitle}>
                  {hasWork ? 'Actions en attente' : 'Tout est sous contrôle'}
                </Text>
                <Text style={styles.heroSub}>
                  {cashPendingCount > 0
                    ? `${cashPendingCount} validation${cashPendingCount > 1 ? 's' : ''} espèces`
                    : 'Aucune validation espèce en attente'}
                  {overdueMembersHint > 0
                    ? ` · ${overdueMembersHint} membre${overdueMembersHint > 1 ? 's' : ''} en retard (estim.)`
                    : ''}
                </Text>
              </View>
            </View>
            <View style={styles.heroActions}>
              {hasWork ? (
                <Pressable
                  style={[styles.ctaMain, { backgroundColor: colors.accent }]}
                  onPress={onOrganizerTreat}
                  accessibilityRole="button"
                  accessibilityLabel="Traiter maintenant"
                >
                  <Text style={styles.ctaMainText}>Traiter maintenant</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" />
                </Pressable>
              ) : null}
              <Pressable
                style={styles.ctaGhost}
                onPress={onPressUpToDate}
                accessibilityRole="button"
              >
                <Text style={styles.ctaGhostText}>Voir mes tontines</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    );
  }

  if (primary != null) {
    const amtDue =
      primary.kind === 'nextPayment' ? nextPaymentAmountDue : null;
    const penalty =
      primary.kind === 'nextPayment' ? nextPaymentPenaltyAmount : null;
    const content = getDashboardReminderContent(primary, amtDue, penalty);
    const detailLines = [content.amountLabel, content.detail].filter(
      (s) => typeof s === 'string' && s.trim() !== ''
    );

    if (isLoading) {
      const loadTone = DASHBOARD_REMINDER_TONES.info;
      return (
        <View
          style={[
            styles.wrap,
            { backgroundColor: loadTone.bg, borderColor: loadTone.border },
          ]}
        >
          <ActivityIndicator color={loadTone.accent} style={{ paddingVertical: 24 }} />
        </View>
      );
    }

    return (
      <View style={styles.heroBlock}>
        <DashboardReminderCard
          tone={content.tone}
          iconName={content.iconName}
          title={content.title}
          subtitle={content.subtitle}
          detailLines={detailLines.length > 0 ? detailLines : undefined}
          ctaLabel={content.ctaLabel}
          onPress={onPressPrimary}
          accessibilityLabel={`${content.ctaLabel} — ${primary.tontineName}`}
        />
        {otherCount > 0 ? (
          <Text style={styles.otherRemindersHint} accessibilityRole="text">
            {otherCount === 1
              ? '1 autre rappel'
              : `${otherCount} autres rappels`}
          </Text>
        ) : null}
      </View>
    );
  }

  const meta = memberHeroTitle(null, nextPayment);
  const showPrimaryCta = nextPayment != null && meta.tone !== 'success';

  if (isLoading) {
    const loadTone = DASHBOARD_REMINDER_TONES.info;
    return (
      <View
        style={[
          styles.wrap,
          { backgroundColor: loadTone.bg, borderColor: loadTone.border },
        ]}
      >
        <ActivityIndicator color={loadTone.accent} style={{ paddingVertical: 24 }} />
      </View>
    );
  }

  const ctaLabel = showPrimaryCta ? 'Cotiser maintenant' : 'Voir mes tontines';

  return (
    <DashboardReminderCard
      tone={meta.tone}
      iconName={memberHeroIcon(null, meta.tone)}
      title={meta.title}
      subtitle={meta.subtitle}
      ctaLabel={ctaLabel}
      onPress={showPrimaryCta ? onPressPrimary : onPressUpToDate}
    />
  );
};

const styles = StyleSheet.create({
  heroBlock: {
    marginBottom: 0,
  },
  otherRemindersHint: {
    marginHorizontal: 20,
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  wrap: {
    marginHorizontal: 20,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1C1C1E',
    lineHeight: 22,
  },
  heroSub: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 6,
    lineHeight: 20,
  },
  heroActions: {
    marginTop: 16,
    gap: 10,
  },
  ctaMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  ctaMainText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  ctaGhost: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  ctaGhostText: {
    color: '#1A6B3C',
    fontWeight: '700',
    fontSize: 15,
  },
});
