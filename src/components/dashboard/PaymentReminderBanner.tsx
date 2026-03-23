/**
 * PaymentReminderBanner — pile de rappels paiement sur l'accueil.
 * Priorité :
 * 1. Cotisation cash déjà payée mais en attente de validation organisateur
 * 2. Prochain versement dû
 */
import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useNextPayment } from '@/hooks/useNextPayment';
import { useContributionHistory } from '@/hooks/useContributionHistory';
import { formatFcfa } from '@/utils/formatters';
import { logger } from '@/utils/logger';
import { withNextPaymentPenaltyWaivedForPendingCashValidation } from '@/utils/nextPaymentPenaltyWaive';
import {
  buildDashboardReminderCards,
  type DashboardReminderCardVm,
} from './paymentReminderBanner.helpers';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type UrgencyLevel = 'overdue' | 'today' | 'soon' | 'upcoming' | 'pendingValidation';

const MS_PER_DAY = 86_400_000;

function computeDaysUntilDue(dueDate: string): number {
  const parts = dueDate.split('T')[0].split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return 0;
  const [y, m, d] = parts;
  const dueLocal = new Date(y, m - 1, d);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((dueLocal.getTime() - todayStart.getTime()) / MS_PER_DAY);
}

function getUrgency(daysUntilDue: number): Exclude<UrgencyLevel, 'pendingValidation'> {
  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue === 0) return 'today';
  if (daysUntilDue <= 3) return 'soon';
  return 'upcoming';
}

const URGENCY_COLORS: Record<
  UrgencyLevel,
  { bg: string; text: string; icon: string; circle: string }
> = {
  pendingValidation: {
    bg: '#EEF4FF',
    text: '#1D4ED8',
    icon: '#FFFFFF',
    circle: '#0055A5',
  },
  overdue: {
    bg: '#FFF0EE',
    text: '#7C2D12',
    icon: '#FFFFFF',
    circle: '#C0392B',
  },
  today: {
    bg: '#FFF3EC',
    text: '#7C2D12',
    icon: '#FFFFFF',
    circle: '#D0021B',
  },
  soon: {
    bg: '#FFF3EC',
    text: '#7C2D12',
    icon: '#FFFFFF',
    circle: '#7C2D12',
  },
  upcoming: {
    bg: '#FFF7ED',
    text: '#92400E',
    icon: '#FFFFFF',
    circle: '#F5A623',
  },
};

function getDueLabel(daysUntilDue: number): string {
  if (daysUntilDue < 0) {
    const late = Math.abs(daysUntilDue);
    return `En retard de ${late} jour${late > 1 ? 's' : ''}`;
  }
  if (daysUntilDue === 0) return "Aujourd'hui";
  if (daysUntilDue === 1) return 'Demain';
  return `Dans ${daysUntilDue} jours`;
}

function formatDateFr(dateStr: string): string {
  const parts = dateStr.split('T')[0].split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return dateStr;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTimeFr(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAmountBreakdown(amountDue: number, penaltyAmount: number): string {
  if (penaltyAmount <= 0) {
    return `Cotisation : ${formatFcfa(amountDue)}`;
  }
  return `Cotisation : ${formatFcfa(amountDue)} + Penalite : ${formatFcfa(penaltyAmount)}`;
}

function getReminderContent(
  reminder: DashboardReminderCardVm,
  nextPaymentAmountDue: number | null,
  nextPaymentPenaltyAmount: number | null
): {
  urgency: UrgencyLevel;
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  amountLabel: string;
  detail: string;
  ctaLabel: string;
} {
  if (reminder.kind === 'pendingValidation') {
    return {
      urgency: 'pendingValidation',
      iconName: 'shield-checkmark-outline',
      title: `Cotisation ${reminder.tontineName} en attente de validation`,
      subtitle:
        reminder.status === 'PROCESSING'
          ? 'Preuve envoyee · validation en cours'
          : "Paiement en especes declare · validation organisateur en attente",
      amountLabel: `Montant : ${formatFcfa(reminder.amount)}`,
      detail: reminder.createdAt
        ? `Declaree le ${formatDateTimeFr(reminder.createdAt)}`
        : 'Suivez cette cotisation dans vos paiements.',
      ctaLabel: 'Voir paiements',
    };
  }

  const daysUntilDue = reminder.dueDate ? computeDaysUntilDue(reminder.dueDate) : 0;
  const urgency = getUrgency(daysUntilDue);
  return {
    urgency,
    iconName: 'time-outline',
    title: `${getDueLabel(daysUntilDue)}${reminder.tontineName ? ` — ${reminder.tontineName}` : ''}`,
    subtitle: reminder.dueDate
      ? `Echeance : ${formatDateFr(reminder.dueDate)}`
      : 'Echeance a confirmer',
    amountLabel: `Total : ${formatFcfa(reminder.amount)}`,
    detail: formatAmountBreakdown(nextPaymentAmountDue ?? reminder.amount, nextPaymentPenaltyAmount ?? 0),
    ctaLabel: 'Cotiser',
  };
}

function ReminderCard({
  reminder,
  content,
  onPress,
  animatedStyle,
}: {
  reminder: DashboardReminderCardVm;
  content: ReturnType<typeof getReminderContent>;
  onPress: () => void;
  animatedStyle?: {
    opacity: Animated.Value;
    translateY: Animated.Value;
    scale: Animated.Value;
  };
}) {
  const colors = URGENCY_COLORS[content.urgency];
  return (
    <Animated.View
      style={[
        styles.wrapper,
        { backgroundColor: colors.bg },
        animatedStyle
          ? {
              opacity: animatedStyle.opacity,
              transform: [
                { translateY: animatedStyle.translateY },
                { scale: animatedStyle.scale },
              ],
            }
          : null,
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: colors.circle }]}>
        <Ionicons name={content.iconName} size={18} color={colors.icon} />
      </View>

      <View style={styles.textBlock}>
        <Text style={[styles.titleLabel, { color: colors.text }]} numberOfLines={2}>
          {content.title}
        </Text>
        <Text style={styles.dateLabel}>{content.subtitle}</Text>
        <Text style={[styles.amountLabel, { color: colors.circle }]}>{content.amountLabel}</Text>
        <Text style={styles.amountBreakdown}>{content.detail}</Text>
      </View>

      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${content.ctaLabel} — ${reminder.tontineName}`}
        hitSlop={12}
      >
        <Text style={[styles.ctaText, { color: colors.text }]}>{content.ctaLabel}</Text>
        <Ionicons name="chevron-forward" size={15} color={colors.text} />
      </Pressable>
    </Animated.View>
  );
}

export interface PaymentReminderBannerProps {
  /** Si true, n’affiche pas la première carte (déjà montrée dans la héro). */
  skipFirst?: boolean;
}

export const PaymentReminderBanner: React.FC<PaymentReminderBannerProps> = ({
  skipFirst = false,
}) => {
  const navigation = useNavigation<Nav>();
  const { nextPayment, isLoading: nextPaymentLoading } = useNextPayment();
  const { items: cashHistoryItems, isFetching: cashHistoryFetching } =
    useContributionHistory(undefined, {
      methodFilter: 'CASH',
      sortField: 'date',
      sortOrder: 'desc',
    });

  const nextPaymentForUi = useMemo(
    () =>
      withNextPaymentPenaltyWaivedForPendingCashValidation(
        nextPayment,
        cashHistoryItems
      ),
    [nextPayment, cashHistoryItems]
  );

  const reminders = useMemo(
    () => buildDashboardReminderCards(nextPaymentForUi, cashHistoryItems),
    [cashHistoryItems, nextPaymentForUi]
  );

  const slideAnim = useRef(new Animated.Value(-8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const vis = skipFirst ? reminders.slice(1) : reminders;
    if (vis.length === 0) return;
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [reminders.length, opacityAnim, slideAnim, skipFirst]);

  useEffect(() => {
    const vis = skipFirst ? reminders.slice(1) : reminders;
    const topReminder = vis[0];
    if (!topReminder || topReminder.kind !== 'nextPayment' || !topReminder.dueDate) return;
    const urgency = getUrgency(computeDaysUntilDue(topReminder.dueDate));
    if (urgency !== 'overdue' && urgency !== 'today') return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.015,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim, reminders, skipFirst]);

  const visibleReminders = skipFirst ? reminders.slice(1) : reminders;

  if (!nextPaymentLoading && !cashHistoryFetching && visibleReminders.length === 0) {
    return null;
  }

  return (
    <View style={styles.stack}>
      {visibleReminders.map((reminder, index) => {
        const content = getReminderContent(
          reminder,
          reminder.kind === 'nextPayment' ? nextPaymentForUi?.amountDue ?? null : null,
          reminder.kind === 'nextPayment' ? nextPaymentForUi?.penaltyAmount ?? null : null
        );
        const onPress =
          reminder.kind === 'pendingValidation'
            ? () => {
                logger.info('[PaymentReminderBanner] Pending validation pressed', {
                  tontineUid: reminder.tontineUid,
                });
                navigation.navigate('MainTabs', { screen: 'Payments' });
              }
            : () => {
                if (!reminder.cycleUid) return;
                logger.info('[PaymentReminderBanner] Cotiser pressed', {
                  tontineUid: reminder.tontineUid,
                });
                navigation.navigate('PaymentScreen', {
                  cycleUid: reminder.cycleUid,
                  tontineUid: reminder.tontineUid,
                  tontineName: reminder.tontineName,
                  baseAmount: nextPaymentForUi?.amountDue ?? reminder.amount,
                  penaltyAmount: nextPaymentForUi?.penaltyAmount ?? 0,
                  cycleNumber: reminder.cycleNumber ?? nextPaymentForUi?.cycleNumber ?? 1,
                });
              };

        return (
          <ReminderCard
            key={reminder.key}
            reminder={reminder}
            content={content}
            onPress={onPress}
            animatedStyle={
              index === 0
                ? {
                    opacity: opacityAnim,
                    translateY: slideAnim,
                    scale: pulseAnim,
                  }
                : undefined
            }
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    gap: 12,
    shadowColor: '#7C2D12',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  titleLabel: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dateLabel: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
  amountBreakdown: {
    fontSize: 11,
    color: '#4B5563',
    lineHeight: 16,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 2,
    minWidth: 84,
    justifyContent: 'flex-end',
  },
  ctaPressed: {
    opacity: 0.6,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
});
