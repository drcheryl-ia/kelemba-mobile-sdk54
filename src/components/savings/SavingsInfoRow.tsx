import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface SavingsInfoRowProps {
  label: string;
  value: React.ReactNode;
}

export const SavingsInfoRow: React.FC<SavingsInfoRowProps> = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 6,
  },
  label: { fontSize: 14, color: '#6B7280', flex: 1 },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    flexShrink: 0,
    textAlign: 'right',
    maxWidth: '58%',
  },
});
