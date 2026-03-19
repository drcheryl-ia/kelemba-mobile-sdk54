import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface ScoreStatsSummaryProps {
  totalEvents: number;
  positiveEvents: number;
  negativeEvents: number;
}

export const ScoreStatsSummary: React.FC<ScoreStatsSummaryProps> = ({
  totalEvents,
  positiveEvents,
  negativeEvents,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.block}>
        <View style={[styles.iconWrap, { backgroundColor: '#E3F2FD' }]}>
          <Ionicons name="stats-chart-outline" size={20} color="#0055A5" />
        </View>
        <Text style={styles.value}>{totalEvents}</Text>
        <Text style={styles.label}>Total</Text>
      </View>
      <View style={styles.block}>
        <View style={[styles.iconWrap, { backgroundColor: '#E8F5E9' }]}>
          <Ionicons name="trending-up-outline" size={20} color="#1A6B3C" />
        </View>
        <Text style={[styles.value, { color: '#1A6B3C' }]}>{positiveEvents}</Text>
        <Text style={styles.label}>Positifs</Text>
      </View>
      <View style={styles.block}>
        <View style={[styles.iconWrap, { backgroundColor: '#FFEBEE' }]}>
          <Ionicons name="trending-down-outline" size={20} color="#D0021B" />
        </View>
        <Text style={[styles.value, { color: '#D0021B' }]}>{negativeEvents}</Text>
        <Text style={styles.label}>Négatifs</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  block: {
    flex: 1,
    alignItems: 'center',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  label: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
});
