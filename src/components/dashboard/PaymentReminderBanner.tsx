/**
 * PaymentReminderBanner — rappel cotisation sur l'accueil.
 * Affiche le prochain versement dû avec accès direct au paiement.
 */
import React, { useEffect, useRef } from 'react';
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
import { formatFcfa } from '@/utils/formatters';
import { logger } from '@/utils/logger';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MS_PER_DAY = 86_400_000;

/** Jours jusqu'à l'échéance (local) — aligné sur useNextPayment / dueDate YYYY-MM-DD */
function computeDaysUntilDue(dueDate: string): number {
  const parts = dueDate.split('T')[0].split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return 0;
  const [y, m, d] = parts;
  const dueLocal = new Date(y, m - 1, d);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((dueLocal.getTime() - todayStart.getTime()) / MS_PER_DAY);
}

// ── Seuils d'urgence ─────────────────────────────────────────────
type UrgencyLevel = 'overdue' | 'today' | 'soon' | 'upcoming';

function getUrgency(daysUntilDue: number): UrgencyLevel {
  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue === 0) return 'today';
  if (daysUntilDue <= 3) return 'soon';
  return 'upcoming';
}

const URGENCY_COLORS: Record<
  UrgencyLevel,
  {
    bg: string;
    text: string;
    icon: string;
    circle: string;
  }
> = {
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

// ── Composant ─────────────────────────────────────────────────────
export const PaymentReminderBanner: React.FC = () => {
  const navigation = useNavigation();
  const { nextPayment, isLoading } = useNextPayment();

  // Animation d'entrée
  const slideAnim = useRef(new Animated.Value(-8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!nextPayment) return;
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
  }, [nextPayment, slideAnim, opacityAnim]);

  // Pulse sur overdue
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!nextPayment) return;
    const daysUntilDue = computeDaysUntilDue(nextPayment.dueDate);
    const urgency = getUrgency(daysUntilDue);
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
  }, [nextPayment, pulseAnim]);

  if (isLoading || !nextPayment) return null;

  const daysUntilDue = computeDaysUntilDue(nextPayment.dueDate);
  const urgency = getUrgency(daysUntilDue);
  const colors = URGENCY_COLORS[urgency];
  const dueLabel = getDueLabel(daysUntilDue);
  const amount = nextPayment.totalDue ?? nextPayment.amountDue ?? 0;

  const handleCotiser = () => {
    logger.info('[PaymentReminderBanner] Cotiser pressed', {
      tontineUid: nextPayment.tontineUid,
    });
    (navigation as Nav).navigate('TontineDetails', {
      tontineUid: nextPayment.tontineUid,
      isCreator: false,
    });
  };

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { backgroundColor: colors.bg },
        {
          opacity: opacityAnim,
          transform: [{ translateY: slideAnim }, { scale: pulseAnim }],
        },
      ]}
    >
      {/* Icône horloge */}
      <View style={[styles.iconCircle, { backgroundColor: colors.circle }]}>
        <Ionicons name="time" size={18} color={colors.icon} />
      </View>

      {/* Texte principal */}
      <View style={styles.textBlock}>
        <Text style={[styles.dueLabel, { color: colors.text }]} numberOfLines={1}>
          {dueLabel}
          {nextPayment.tontineName ? ` — ${nextPayment.tontineName}` : ''}
        </Text>
        {amount > 0 && (
          <Text style={[styles.amountLabel, { color: colors.circle }]}>
            {formatFcfa(amount)}
          </Text>
        )}
      </View>

      {/* CTA */}
      <Pressable
        onPress={handleCotiser}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        accessibilityRole="button"
        accessibilityLabel={`Cotiser — ${nextPayment.tontineName}`}
        hitSlop={12}
      >
        <Text style={[styles.ctaText, { color: colors.text }]}>Cotiser</Text>
        <Ionicons name="chevron-forward" size={15} color={colors.text} />
      </Pressable>
    </Animated.View>
  );
};

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginBottom: 16,
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
  dueLabel: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 2,
    minWidth: 72,
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
