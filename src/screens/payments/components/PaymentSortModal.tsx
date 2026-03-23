/**
 * Modal — tri historique (date via API, montant en client sur pages chargées).
 */
import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { HistorySortField } from '@/hooks/useContributionHistory';

const GREEN = '#1A6B3C';

export type SortOption = {
  field: HistorySortField;
  order: 'asc' | 'desc';
  label: string;
};

const SORT_OPTIONS: SortOption[] = [
  { field: 'date', order: 'desc', label: 'Plus récents' },
  { field: 'date', order: 'asc', label: 'Plus anciens' },
  { field: 'amount', order: 'desc', label: 'Montant décroissant' },
  { field: 'amount', order: 'asc', label: 'Montant croissant' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  sortField: HistorySortField;
  sortOrder: 'asc' | 'desc';
  onApply: (field: HistorySortField, order: 'asc' | 'desc') => void;
};

export const PaymentSortModal: React.FC<Props> = ({
  visible,
  onClose,
  sortField,
  sortOrder,
  onApply,
}) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={styles.backdrop} onPress={onClose}>
      <Pressable style={styles.box} onPress={(e) => e.stopPropagation()}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Trier</Text>
          <Pressable onPress={onClose} accessibilityLabel="Fermer">
            <Ionicons name="close" size={26} color="#6B7280" />
          </Pressable>
        </View>
        <Text style={styles.hint}>
          Le tri par montant s’applique aux cotisations déjà chargées dans la liste.
        </Text>
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {SORT_OPTIONS.map((opt) => {
            const selected = sortField === opt.field && sortOrder === opt.order;
            return (
              <Pressable
                key={`${opt.field}-${opt.order}`}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => {
                  onApply(opt.field, opt.order);
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {opt.label}
                </Text>
                {selected ? <Ionicons name="checkmark-circle" size={22} color={GREEN} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </Pressable>
    </Pressable>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  box: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    maxHeight: '70%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  list: {
    maxHeight: 320,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  optionSelected: {
    backgroundColor: '#F0FDF4',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  optionTextSelected: {
    color: GREEN,
  },
});
