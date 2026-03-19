import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface ScoreProgressBarProps {
  label: string;
  percentage: number;
}

export const ScoreProgressBar: React.FC<ScoreProgressBarProps> = ({
  label,
  percentage,
}) => {
  const clamped = Math.min(100, Math.max(0, percentage));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.percentage}>{Math.round(clamped)}%</Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${clamped}%`,
              backgroundColor: clamped >= 60 ? '#1A6B3C' : clamped >= 40 ? '#F5A623' : '#D0021B',
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    color: '#6B7280',
  },
  percentage: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
});
