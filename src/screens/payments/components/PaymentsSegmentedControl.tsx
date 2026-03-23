/**
 * Segmented control — onglets Paiements (cotisations / validations espèces).
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export type PaymentsSegment = 'contributions' | 'cashValidations';

const GREEN = '#1A6B3C';
const GREEN_LIGHT = '#E8F5E9';

type Props = {
  value: PaymentsSegment;
  onChange: (segment: PaymentsSegment) => void;
};

export const PaymentsSegmentedControl: React.FC<Props> = ({ value, onChange }) => (
  <View style={styles.wrap} accessibilityRole="tablist">
    <Pressable
      style={[styles.segment, value === 'contributions' && styles.segmentActive]}
      onPress={() => onChange('contributions')}
      accessibilityRole="tab"
      accessibilityState={{ selected: value === 'contributions' }}
      accessibilityLabel="Mes cotisations"
    >
      <Text
        style={[styles.segmentText, value === 'contributions' && styles.segmentTextActive]}
        numberOfLines={1}
      >
        Mes cotisations
      </Text>
    </Pressable>
    <Pressable
      style={[styles.segment, value === 'cashValidations' && styles.segmentActive]}
      onPress={() => onChange('cashValidations')}
      accessibilityRole="tab"
      accessibilityState={{ selected: value === 'cashValidations' }}
      accessibilityLabel="Validations espèces"
    >
      <Text
        style={[styles.segmentText, value === 'cashValidations' && styles.segmentTextActive]}
        numberOfLines={1}
      >
        Validations espèces
      </Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 4,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  segmentActive: {
    backgroundColor: GREEN_LIGHT,
    borderWidth: 1,
    borderColor: GREEN,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
  },
  segmentTextActive: {
    color: GREEN,
    fontWeight: '700',
  },
});
