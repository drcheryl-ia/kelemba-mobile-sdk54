/**
 * Barre Paiements : période + statut (chips) + Filtres + Trier.
 * ScrollView horizontal : hauteur sur le wrapper uniquement (CLAUDE.md).
 */
import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const GREEN = '#1A6B3C';

type Props = {
  periodLabel: string;
  statusLabel: string;
  onOpenFilters: () => void;
  onSortPress: () => void;
};

export const PaymentHistoryToolbar: React.FC<Props> = ({
  periodLabel,
  statusLabel,
  onOpenFilters,
  onSortPress,
}) => (
  <View style={styles.wrap}>
    <View style={styles.chipsWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsContent}
      >
        <Pressable
          style={styles.filterChip}
          onPress={onOpenFilters}
          accessibilityRole="button"
          accessibilityLabel={`Période : ${periodLabel}. Ouvrir les filtres`}
        >
          <Ionicons name="calendar-outline" size={16} color={GREEN} />
          <Text style={styles.filterChipText} numberOfLines={1}>
            {periodLabel}
          </Text>
        </Pressable>
        <Pressable
          style={styles.filterChip}
          onPress={onOpenFilters}
          accessibilityRole="button"
          accessibilityLabel={`Statut : ${statusLabel}. Ouvrir les filtres`}
        >
          <Ionicons name="flag-outline" size={16} color={GREEN} />
          <Text style={styles.filterChipText} numberOfLines={1}>
            {statusLabel}
          </Text>
        </Pressable>
      </ScrollView>
    </View>

    <View style={styles.actionsRow}>
      <Pressable
        style={styles.actionBtn}
        onPress={onOpenFilters}
        accessibilityRole="button"
        accessibilityLabel="Ouvrir les filtres avancés"
      >
        <Ionicons name="options-outline" size={20} color={GREEN} />
        <Text style={styles.actionLabel}>Filtres</Text>
      </Pressable>
      <Pressable
        style={styles.actionBtn}
        onPress={onSortPress}
        accessibilityRole="button"
        accessibilityLabel="Ouvrir le tri"
      >
        <Ionicons name="swap-vertical-outline" size={20} color={GREEN} />
        <Text style={styles.actionLabel}>Trier</Text>
      </Pressable>
    </View>
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
    gap: 10,
  },
  chipsWrap: {
    height: 48,
  },
  chipsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxWidth: 200,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    flexShrink: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: GREEN,
  },
});
