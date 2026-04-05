import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '@/theme/colors';

export interface OverdueBannerProps {
  tontineName: string;
  daysLate: number;
  onPayPress: () => void;
}

function AlertIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
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

export const OverdueBanner: React.FC<OverdueBannerProps> = ({
  tontineName,
  daysLate,
  onPayPress,
}) => {
  const days = Math.round(daysLate);
  return (
    <View style={styles.row} accessibilityRole="alert">
      <AlertIcon color={COLORS.dangerText} />
      <Text style={styles.text} numberOfLines={2}>
        Cotisation en retard — {tontineName} · {days} j
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
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: COLORS.dangerLight,
  },
  text: {
    flex: 1,
    fontSize: 11,
    color: COLORS.dangerText,
  },
  btn: {
    flexShrink: 0,
    backgroundColor: COLORS.danger,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    minHeight: 44,
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
