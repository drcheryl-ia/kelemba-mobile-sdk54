import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatFcfa } from '@/utils/formatters';

export interface AlertBannerProps {
  daysLeft: number;
  tontineName: string;
  /** Cotisation de base */
  amount: number;
  /** Pénalité (0 si aucune) */
  penaltyAmount?: number;
  /** Total = amount + penaltyAmount */
  totalDue?: number;
  onCotiserPress: () => void;
  isVisible: boolean;
}

function formatAmountLine(
  amount: number,
  penaltyAmount: number,
  totalDue: number | undefined
): string {
  if (penaltyAmount > 0) {
    const total = totalDue ?? amount + penaltyAmount;
    return `Cotisation : ${formatFcfa(amount)} + Pénalité : ${formatFcfa(penaltyAmount)} = Total : ${formatFcfa(total)}`;
  }
  return `Montant dû : ${formatFcfa(amount)}`;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  daysLeft,
  tontineName,
  amount,
  penaltyAmount = 0,
  totalDue,
  onCotiserPress,
  isVisible,
}) => {
  if (!isVisible) return null;

  let urgencyColor: string;
  let urgencyBg: string;
  let borderColor: string;
  if (daysLeft < 0) {
    urgencyColor = '#D0021B';
    urgencyBg = '#FEE2E2';
    borderColor = '#D0021B';
  } else if (daysLeft <= 2) {
    urgencyColor = '#F5A623';
    urgencyBg = '#FEF3C7';
    borderColor = '#F5A623';
  } else {
    urgencyColor = '#1A6B3C';
    urgencyBg = '#E8F5EE';
    borderColor = '#1A6B3C';
  }

  const daysText =
    daysLeft < 0
      ? `En retard de ${Math.abs(daysLeft)} jour${Math.abs(daysLeft) === 1 ? '' : 's'}`
      : daysLeft === 0
        ? "Aujourd'hui"
        : daysLeft === 1
          ? 'Demain'
          : `Dans ${daysLeft} jours`;

  const headline = `Versement ${daysText.toLowerCase()} — ${tontineName}`;
  const amountLine = formatAmountLine(amount, penaltyAmount, totalDue);

  return (
    <View style={[styles.container, { backgroundColor: urgencyBg }]}>
      <View style={[styles.borderLeft, { backgroundColor: borderColor }]} />
      <View style={styles.content}>
        <Ionicons name="time-outline" size={20} color={urgencyColor} />
        <View style={styles.textColumn}>
          <Text style={styles.text} numberOfLines={2}>
            {headline}
          </Text>
          <Text style={styles.amountText} numberOfLines={3}>
            {amountLine}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onCotiserPress}
        hitSlop={8}
        style={styles.link}
        accessibilityRole="button"
        accessibilityLabel="Cotiser"
      >
        <Text style={[styles.linkText, { color: urgencyColor }]}>Cotiser &gt;</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 48,
  },
  borderLeft: {
    width: 4,
    alignSelf: 'stretch',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  textColumn: {
    flex: 1,
    gap: 4,
  },
  text: {
    fontSize: 14,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  amountText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  link: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
