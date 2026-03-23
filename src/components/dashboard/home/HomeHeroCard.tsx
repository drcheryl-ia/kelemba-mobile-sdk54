/**
 * Carte héro Accueil — priorité métier membre ou organisateur.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NextPaymentData } from '@/types/payment';
import { formatFcfa } from '@/utils/formatters';
import type { DashboardReminderCardVm } from '@/components/dashboard/paymentReminderBanner.helpers';

type MemberHeroProps = {
  variant: 'member';
  primaryReminder: DashboardReminderCardVm | null;
  nextPayment: NextPaymentData | null;
  isLoading: boolean;
  onPressPrimary: () => void;
  onPressUpToDate: () => void;
};

type OrganizerHeroProps = {
  variant: 'organizer';
  cashPendingCount: number;
  overdueMembersHint: number;
  isLoading: boolean;
  onPressTreat: () => void;
  onPressDashboard: () => void;
};

export type HomeHeroCardProps = MemberHeroProps | OrganizerHeroProps;

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
): { title: string; subtitle: string; tone: 'danger' | 'warning' | 'info' | 'success' } {
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
    title: 'Vous êtes à jour',
    subtitle: 'Aucune cotisation urgente pour le moment.',
    tone: 'success',
  };
}

const TONE_STYLES = {
  danger: { bg: '#FEF2F2', border: '#FECACA', accent: '#D0021B' },
  warning: { bg: '#FFFBEB', border: '#FDE68A', accent: '#F5A623' },
  info: { bg: '#EFF6FF', border: '#BFDBFE', accent: '#0055A5' },
  success: { bg: '#F0FDF4', border: '#BBF7D0', accent: '#1A6B3C' },
};

export const HomeHeroCard: React.FC<HomeHeroCardProps> = (props) => {
  if (props.variant === 'organizer') {
    const {
      cashPendingCount,
      overdueMembersHint,
      isLoading,
      onPressTreat,
      onPressDashboard,
    } = props;
    const hasWork = cashPendingCount > 0 || overdueMembersHint > 0;
    const colors = hasWork ? TONE_STYLES.warning : TONE_STYLES.success;
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
                  onPress={onPressTreat}
                  accessibilityRole="button"
                  accessibilityLabel="Traiter maintenant"
                >
                  <Text style={styles.ctaMainText}>Traiter maintenant</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" />
                </Pressable>
              ) : null}
              <Pressable
                style={styles.ctaGhost}
                onPress={onPressDashboard}
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

  const { primaryReminder, nextPayment, isLoading, onPressPrimary, onPressUpToDate } = props;
  const meta = memberHeroTitle(primaryReminder, nextPayment);
  const colors = TONE_STYLES[meta.tone];
  const showPrimaryCta =
    primaryReminder != null ||
    (nextPayment != null && meta.tone !== 'success');

  return (
    <View style={[styles.wrap, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ paddingVertical: 24 }} />
      ) : (
        <>
          <View style={styles.heroTop}>
            <View style={[styles.iconCircle, { backgroundColor: colors.accent }]}>
              <Ionicons
                name={meta.tone === 'danger' ? 'alert-circle-outline' : 'wallet-outline'}
                size={22}
                color="#FFF"
              />
            </View>
            <View style={styles.heroText}>
              <Text style={styles.heroTitle}>{meta.title}</Text>
              <Text style={styles.heroSub}>{meta.subtitle}</Text>
            </View>
          </View>
          <View style={styles.heroActions}>
            {showPrimaryCta ? (
              <Pressable
                style={[styles.ctaMain, { backgroundColor: colors.accent }]}
                onPress={onPressPrimary}
                accessibilityRole="button"
                accessibilityLabel="Cotiser maintenant"
              >
                <Text style={styles.ctaMainText}>
                  {primaryReminder?.kind === 'pendingValidation' ? 'Voir paiements' : 'Cotiser maintenant'}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </Pressable>
            ) : (
              <Pressable
                style={[styles.ctaMain, { backgroundColor: colors.accent }]}
                onPress={onPressUpToDate}
                accessibilityRole="button"
              >
                <Text style={styles.ctaMainText}>Voir mes tontines</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </Pressable>
            )}
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
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
