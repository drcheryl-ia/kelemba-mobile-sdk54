import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface KycUploadProgressProps {
  progress: number;
  statusText?: string;
}

export const KycUploadProgress: React.FC<KycUploadProgressProps> = ({
  progress,
  statusText = 'Envoi en cours...',
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.barBg}>
        <View
          style={[styles.barFill, { width: `${Math.min(100, Math.max(0, progress))}%` }]}
        />
      </View>
      <Text style={styles.statusText}>{statusText}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  barBg: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#1A6B3C',
    borderRadius: 4,
  },
  statusText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});
