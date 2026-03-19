/**
 * Badge statut de période — PENDING/OPEN/CLOSED avec animation pulsante pour OPEN.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import type { SavingsPeriodStatus } from '@/types/savings.types';

export interface PeriodStatusBadgeProps {
  status: SavingsPeriodStatus;
}

const STATUS_CONFIG: Record<
  SavingsPeriodStatus,
  { label: string; color: string }
> = {
  PENDING: { label: 'À venir', color: '#9E9E9E' },
  OPEN: { label: 'En cours', color: '#1A6B3C' },
  CLOSED: { label: 'Terminée', color: '#0055A5' },
};

export const PeriodStatusBadge: React.FC<PeriodStatusBadgeProps> = ({
  status,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const config = STATUS_CONFIG[status];

  useEffect(() => {
    if (status === 'OPEN') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.05,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [status, scaleAnim]);

  const badgeStyle = [
    styles.badge,
    { backgroundColor: config.color },
    status === 'OPEN' && { transform: [{ scale: scaleAnim }] },
  ];

  return (
    <Animated.View style={badgeStyle}>
      <Text style={styles.text}>{config.label}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
