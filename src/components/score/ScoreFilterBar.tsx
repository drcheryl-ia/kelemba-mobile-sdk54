import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import {
  type ScoreEventCategory,
  type PeriodFilter,
} from '@/utils/scoreUtils';

export interface ScoreFilterBarProps {
  periodFilter: PeriodFilter;
  categoryFilter: ScoreEventCategory;
  onPeriodChange: (p: PeriodFilter) => void;
  onCategoryChange: (c: ScoreEventCategory) => void;
}

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: '1M', label: '1 mois' },
  { value: '3M', label: '3 mois' },
  { value: '6M', label: '6 mois' },
  { value: 'ALL', label: 'Tout' },
];

const CATEGORY_OPTIONS: { value: ScoreEventCategory; label: string }[] = [
  { value: 'ALL', label: 'Tout' },
  { value: 'POSITIVE', label: 'Positifs' },
  { value: 'NEGATIVE', label: 'Négatifs' },
];

export const ScoreFilterBar: React.FC<ScoreFilterBarProps> = ({
  periodFilter,
  categoryFilter,
  onPeriodChange,
  onCategoryChange,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Période</Text>
        <View style={styles.chips}>
          {PERIOD_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[
                styles.chip,
                periodFilter === opt.value && styles.chipActive,
              ]}
              onPress={() => onPeriodChange(opt.value)}
            >
              <Text
                style={[
                  styles.chipText,
                  periodFilter === opt.value && styles.chipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Catégorie</Text>
        <View style={styles.chips}>
          {CATEGORY_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[
                styles.chip,
                categoryFilter === opt.value && styles.chipActive,
              ]}
              onPress={() => onCategoryChange(opt.value)}
            >
              <Text
                style={[
                  styles.chipText,
                  categoryFilter === opt.value && styles.chipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 6,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  chipActive: {
    backgroundColor: '#1A6B3C',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
});
