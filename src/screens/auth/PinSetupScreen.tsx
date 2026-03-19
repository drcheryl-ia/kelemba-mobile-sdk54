/**
 * Écran de configuration du PIN — après vérification OTP (flux register).
 * Placeholder : à connecter au flux d'inscription complet.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PinSetup'>;

export const PinSetupScreen: React.FC<Props> = ({ route }) => {
  const { phone } = route.params;
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Configuration du PIN</Text>
      <Text style={styles.subtitle}>Téléphone : {phone}</Text>
      <Text style={styles.hint}>
        À connecter au flux d'inscription (Register).
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  hint: {
    fontSize: 12,
    color: '#999',
  },
});
