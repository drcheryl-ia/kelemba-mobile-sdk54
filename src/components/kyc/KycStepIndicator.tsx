import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface KycStepIndicatorProps {
  currentStep: 1 | 2 | 3;
}

export const KycStepIndicator: React.FC<KycStepIndicatorProps> = ({
  currentStep,
}) => {
  return (
    <View style={styles.container}>
      {[1, 2, 3].map((step) => (
        <View key={step} style={styles.stepRow}>
          <View
            style={[
              styles.dot,
              step <= currentStep && styles.dotActive,
              step === currentStep && styles.dotCurrent,
            ]}
          />
          {step < 3 && <View style={styles.line} />}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 0,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  dotActive: {
    backgroundColor: '#1A6B3C',
  },
  dotCurrent: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#1A6B3C',
    backgroundColor: '#FFFFFF',
  },
  line: {
    width: 40,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
  },
});
