import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { FilterTab } from '@/types/notification.types';

export interface NotificationFilterTabsProps {
  activeTab: FilterTab;
  onTabChange: (tab: FilterTab) => void;
}

const TABS: FilterTab[] = ['ALL', 'PAYMENTS', 'TONTINES', 'SYSTEM'];

const TAB_I18N_KEYS: Record<FilterTab, string> = {
  ALL: 'notifications.filters.all',
  PAYMENTS: 'notifications.filters.payments',
  TONTINES: 'notifications.filters.tontines',
  SYSTEM: 'notifications.filters.system',
};

export const NotificationFilterTabs: React.FC<NotificationFilterTabsProps> = ({
  activeTab,
  onTabChange,
}) => {
  const { t } = useTranslation();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      style={styles.scroll}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab;
        return (
          <Pressable
            key={tab}
            onPress={() => onTabChange(tab)}
            style={[styles.chip, isActive && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
              {t(TAB_I18N_KEYS[tab])}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  chipActive: {
    backgroundColor: '#1A6B3C',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
});
