/**
 * TextInput numérique — valeur formatée FCFA en temps réel, message validation.
 */
import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { formatFCFA } from '@/utils/savings.utils';

export interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  minimumAmount: number;
  label?: string;
}

export const AmountInput: React.FC<AmountInputProps> = ({
  value,
  onChange,
  minimumAmount,
  label = 'Montant (FCFA)',
}) => {
  const numValue = parseInt(value.replace(/\D/g, ''), 10) || 0;
  const isValid = numValue >= minimumAmount;

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    onChange(digits);
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={handleChange}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor="#9CA3AF"
      />
      <Text style={styles.formatted}>
        {numValue > 0 ? formatFCFA(numValue) : '—'}
      </Text>
      {value.length > 0 && (
        <Text
          style={[styles.validation, isValid ? styles.validationValid : styles.validationInvalid]}
        >
          {isValid ? '✓ Montant valide' : `Minimum : ${formatFCFA(minimumAmount)}`}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  formatted: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  validation: {
    fontSize: 12,
    fontWeight: '500',
  },
  validationValid: {
    color: '#1A6B3C',
  },
  validationInvalid: {
    color: '#D0021B',
  },
});
