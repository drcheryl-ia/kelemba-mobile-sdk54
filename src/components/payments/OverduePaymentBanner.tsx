import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '@/theme/colors';

export interface OverduePaymentBannerProps {
  tontineName: string;
  daysLate: number;
  onPayPress: () => void;
}

function AlertIcon({ color }: { color: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export const OverduePaymentBanner: React.FC<OverduePaymentBannerProps> = ({
  tontineName,
  daysLate,
  onPayPress,
}) => {
  const d = Math.max(0, Math.round(daysLate));
  if (d <= 0) return null;

  return (
    <View style={styles.row} accessibilityRole="alert">
      <View style={styles.iconWrap}>
        <AlertIcon color={COLORS.dangerText} />
      </View>
      <Text style={styles.text} numberOfLines={3}>
        Retard de {d} jour{d > 1 ? 's' : ''} · {tontineName} · Pénalité en cours
      </Text>
      <Pressable
        onPress={onPayPress}
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        accessibilityRole="button"
        accessibilityLabel={`Payer la cotisation en retard pour ${tontineName}`}
      >
        <Text style={styles.btnLabel}>Payer</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 16,
    backgroundColor: COLORS.dangerLight,
  },
  iconWrap: {
    flexShrink: 0,
  },
  text: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15.4,
    color: COLORS.dangerText,
  },
  btn: {
    flexShrink: 0,
    backgroundColor: COLORS.danger,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    minHeight: 32,
    justifyContent: 'center',
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.white,
  },
});
