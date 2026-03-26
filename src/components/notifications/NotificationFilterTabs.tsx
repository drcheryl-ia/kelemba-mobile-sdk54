/**
 * Filtres notifications — onglets tactiles (Toutes, Non lues, Paiements, Tontines, Système).
 */
import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { FilterTab } from '@/types/notification.types';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

export interface NotificationFilterTabsProps {
  activeTab: FilterTab;
  onTabChange: (tab: FilterTab) => void;
}

const TABS: FilterTab[] = ['ALL', 'UNREAD', 'PAYMENTS', 'TONTINES', 'SYSTEM'];

const TAB_I18N_KEYS: Record<FilterTab, string> = {
  ALL: 'notifications.filters.all',
  UNREAD: 'notifications.filters.unread',
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
    <View style={styles.wrap}>
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
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.gray[200],
    minHeight: spacing.minTouchTarget - 4,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.grayTagline,
  },
  chipTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
});
