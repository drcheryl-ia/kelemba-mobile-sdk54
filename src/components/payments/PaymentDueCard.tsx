import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/spacing';
import { formatFcfa, formatFcfaAmount } from '@/utils/formatters';
import { freqLabel } from '@/utils/paymentUiLabels';
import type { PaymentObligation } from '@/types/payments.types';

export interface PaymentDueCardProps {
  obligation: PaymentObligation;
  onPayPress: () => void;
  onViewRotation: () => void;
  onShare: () => void;
  /** Reçu PDF — uniquement si `obligation.obligationStatus === 'PAID'` */
  onReceiptPress?: () => void;
}

const dateFmtShort = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const dateFmtUpcoming = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
});

function parseDueDate(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ClockIconSvg({ stroke }: { stroke: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={stroke} strokeWidth={2} />
      <Path
        d="M12 9v4l3 2"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CheckIconSvg({ stroke }: { stroke: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 13l4 4L19 7"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export const PaymentDueCard: React.FC<PaymentDueCardProps> = ({
  obligation: o,
  onPayPress,
  onViewRotation,
  onShare,
  onReceiptPress,
}) => {
  const total = Math.round(o.totalAmountDue);
  const pen = Math.round(o.penaltyAmount);

  const dueD = parseDueDate(o.dueDate);
  const dueLine = dueD != null ? dateFmtShort.format(dueD) : o.dueDate;

  const eyebrow = useMemo(() => {
    switch (o.obligationStatus) {
      case 'OVERDUE': {
        const days = Math.max(0, Math.round(o.daysLate));
        return {
          text: `En retard · ${days} jour${days > 1 ? 's' : ''} · Pénalité : ${formatFcfa(pen)}`,
          color: COLORS.dangerText,
        };
      }
      case 'DUE_TODAY':
        return {
          text: "Paiement dû · Aujourd'hui",
          color: COLORS.secondaryText,
        };
      case 'DUE_SOON': {
        const n = Math.abs(Math.round(o.daysLate));
        return {
          text: `Paiement dû · dans ${n} jour${n > 1 ? 's' : ''}`,
          color: COLORS.secondaryText,
        };
      }
      case 'UPCOMING': {
        const d = parseDueDate(o.dueDate);
        const label =
          d != null ? dateFmtUpcoming.format(d) : dueLine;
        return {
          text: `Prochain paiement · ${label}`,
          color: COLORS.gray500,
        };
      }
      case 'PAID':
        return { text: 'Payé', color: COLORS.primaryDark };
    }
  }, [o.dueDate, o.daysLate, o.obligationStatus, pen, dueLine]);

  const amountColor = useMemo(() => {
    switch (o.obligationStatus) {
      case 'OVERDUE':
        return COLORS.danger;
      case 'DUE_TODAY':
      case 'DUE_SOON':
        return COLORS.primary;
      default:
        return COLORS.gray500;
    }
  }, [o.obligationStatus]);

  const showPay =
    o.obligationStatus === 'OVERDUE' ||
    o.obligationStatus === 'DUE_TODAY' ||
    o.obligationStatus === 'DUE_SOON';

  const payBtnBg =
    o.obligationStatus === 'OVERDUE' ? COLORS.danger : COLORS.primary;

  const iconMeta = useMemo(() => {
    switch (o.obligationStatus) {
      case 'OVERDUE':
        return { bg: '#FCEBEB', color: COLORS.dangerText, kind: 'clock' as const };
      case 'DUE_TODAY':
      case 'DUE_SOON':
        return { bg: '#FFF3D4', color: COLORS.secondaryText, kind: 'clock' as const };
      case 'UPCOMING':
        return { bg: COLORS.primaryLight, color: COLORS.primaryDark, kind: 'clock' as const };
      case 'PAID':
        return { bg: COLORS.primaryLight, color: COLORS.primary, kind: 'check' as const };
    }
  }, [o.obligationStatus]);

  const subLine = `Cycle ${o.cycleNumber} · ${freqLabel(o.frequency)} · Échéance ${dueLine}`;

  const isPaid = o.obligationStatus === 'PAID';

  const a11yLabel = `${o.tontineName}, ${eyebrow.text}, ${formatFcfaAmount(total)} FCFA`;

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.main}
        onPress={onPayPress}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
      >
        <View style={[styles.iconWrap, { backgroundColor: iconMeta.bg }]}>
          {iconMeta.kind === 'clock' ? (
            <ClockIconSvg stroke={iconMeta.color} />
          ) : (
            <CheckIconSvg stroke={iconMeta.color} />
          )}
        </View>
        <View style={styles.center}>
          <Text style={[styles.eyebrow, { color: eyebrow.color }]} numberOfLines={2}>
            {eyebrow.text}
          </Text>
          <Text style={styles.tontineName} numberOfLines={1} ellipsizeMode="tail">
            {o.tontineName}
          </Text>
          <Text style={styles.subLine} numberOfLines={2}>
            {subLine}
          </Text>
        </View>
        <View style={styles.right}>
          <View style={styles.amountRow}>
            <Text style={[styles.amount, { color: amountColor }]}>
              {formatFcfaAmount(total)}
            </Text>
            <Text style={styles.fcfa}>FCFA</Text>
          </View>
          {showPay ? (
            <Pressable
              onPress={onPayPress}
              style={({ pressed }) => [
                styles.btnPay,
                { backgroundColor: payBtnBg },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Payer la cotisation"
            >
              <Text style={styles.btnPayText}>Payer</Text>
            </Pressable>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.strip}>
        <Pressable
          onPress={isPaid && onReceiptPress ? onReceiptPress : undefined}
          disabled={!isPaid || !onReceiptPress}
          style={({ pressed }) => [
            styles.stripBtn,
            (!isPaid || !onReceiptPress) && styles.stripBtnMuted,
            pressed && isPaid && onReceiptPress && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !isPaid || !onReceiptPress }}
        >
          <Ionicons
            name="document-text-outline"
            size={16}
            color={isPaid && onReceiptPress ? COLORS.primary : COLORS.gray500}
          />
          <Text
            style={[
              styles.stripLabel,
              { color: isPaid && onReceiptPress ? COLORS.primary : COLORS.gray500 },
            ]}
          >
            Reçu
          </Text>
        </Pressable>

        <View style={styles.stripSep} />

        <Pressable
          onPress={onViewRotation}
          style={({ pressed }) => [styles.stripBtn, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Ionicons name="time-outline" size={16} color={COLORS.primary} />
          <Text style={[styles.stripLabel, { color: COLORS.primary }]}>Rotation</Text>
        </Pressable>

        <View style={styles.stripSep} />

        <Pressable
          onPress={onShare}
          style={({ pressed }) => [styles.stripBtn, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Ionicons name="share-outline" size={16} color={COLORS.gray500} />
          <Text style={[styles.stripLabel, { color: COLORS.gray500 }]}>Partager</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  main: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '500',
  },
  tontineName: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  subLine: {
    fontSize: 11,
    color: COLORS.gray500,
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
    gap: 3,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  amount: {
    fontSize: 16,
    fontWeight: '500',
  },
  fcfa: {
    fontSize: 10,
    color: COLORS.gray500,
  },
  btnPay: {
    minHeight: 32,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPayText: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.white,
  },
  pressed: {
    opacity: 0.9,
  },
  strip: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: COLORS.gray100,
  },
  stripBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    gap: 3,
  },
  stripBtnMuted: {
    opacity: 0.4,
  },
  stripSep: {
    width: 0.5,
    backgroundColor: COLORS.gray200,
    alignSelf: 'stretch',
  },
  stripLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
});
