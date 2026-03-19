import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface AlertBannerProps {
  daysLeft: number;
  tontineName: string;
  amount: number;
  onCotiserPress: () => void;
  isVisible: boolean;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  daysLeft,
  tontineName,
  onCotiserPress,
  isVisible,
}) => {
  if (!isVisible || daysLeft > 3) return null;

  const urgencyColor = daysLeft <= 1 ? '#D0021B' : '#F5A623';
  const urgencyBg = daysLeft <= 1 ? '#FEE2E2' : '#FEF3C7';
  const borderColor = daysLeft <= 1 ? '#D0021B' : '#F5A623';

  const daysText =
    daysLeft === 0
      ? "Aujourd'hui"
      : daysLeft === 1
        ? 'Demain'
        : `Dans ${daysLeft} jours`;

  return (
    <View style={[styles.container, { backgroundColor: urgencyBg }]}>
      <View style={[styles.borderLeft, { backgroundColor: borderColor }]} />
      <View style={styles.content}>
        <Ionicons name="time-outline" size={20} color="#D97706" />
        <Text style={styles.text} numberOfLines={2}>
          Versement {daysText.toLowerCase()} — {tontineName}
        </Text>
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
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  text: {
    flex: 1,
    fontSize: 14,
    color: '#1C1C1E',
    fontWeight: '500',
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
