/**
 * Barre de progression wizard — partagée création rotative / épargne.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface WizardProgressBarProps {
  currentStep: number;
  totalSteps: number;
  accentColor: string;
  trackColor?: string;
  label?: string;
}

export const WizardProgressBar: React.FC<WizardProgressBarProps> = ({
  currentStep,
  totalSteps,
  accentColor,
  trackColor = '#E5E7EB',
  label,
}) => {
  const ratio = Math.min(1, Math.max(0, currentStep / totalSteps));
  return (
    <View style={styles.wrap}>
      <View style={[styles.track, { backgroundColor: trackColor }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${ratio * 100}%`,
              backgroundColor: accentColor,
            },
          ]}
        />
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  label: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    letterSpacing: 0.3,
  },
});
