import React from 'react';
import { View } from 'react-native';
import type { SavingsListItem } from '@/types/savings.types';
import { SavingsCompactCard } from '@/components/dashboard/SavingsCompactCard';

export interface SavingsDashboardSectionProps {
  savingsTontines: SavingsListItem[];
  onItemPress: (item: SavingsListItem) => void;
}

export const SavingsDashboardSection: React.FC<
  SavingsDashboardSectionProps
> = ({ savingsTontines, onItemPress }) => {
  if (savingsTontines.length === 0) {
    return null;
  }

  const preview = savingsTontines.slice(0, 2);

  return (
    <View>
      {preview.map((item) => (
        <SavingsCompactCard
          key={item.uid}
          item={item}
          onPress={() => onItemPress(item)}
        />
      ))}
    </View>
  );
};
