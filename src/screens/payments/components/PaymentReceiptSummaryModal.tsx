/**
 * Modal — résumé honnête d’un paiement (données historique uniquement).
 */
import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PaymentHistoryItem } from '@/types/tontine';
import { formatFcfa } from '@/utils/formatters';

const GREEN = '#1A6B3C';

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const datePart = dateStr.split('T')[0];
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return '—';
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  item: PaymentHistoryItem | null;
};

export const PaymentReceiptSummaryModal: React.FC<Props> = ({ visible, onClose, item }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={styles.backdrop} onPress={onClose}>
      <Pressable style={styles.box} onPress={(e) => e.stopPropagation()}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Résumé du paiement</Text>
          <Pressable onPress={onClose} accessibilityLabel="Fermer">
            <Ionicons name="close" size={26} color="#6B7280" />
          </Pressable>
        </View>
        {item ? (
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Tontine</Text>
            <Text style={styles.value}>{item.tontineName}</Text>
            <Text style={styles.label}>Montant</Text>
            <Text style={styles.amount}>{formatFcfa(item.amount)}</Text>
            <Text style={styles.label}>Montant total payé</Text>
            <Text style={styles.value}>{formatFcfa(item.totalPaid)}</Text>
            {item.penalty > 0 ? (
              <>
                <Text style={styles.label}>Pénalités</Text>
                <Text style={styles.penalty}>{formatFcfa(item.penalty)}</Text>
              </>
            ) : null}
            <Text style={styles.label}>Statut</Text>
            <Text style={styles.value}>{item.status}</Text>
            <Text style={styles.label}>Cycle</Text>
            <Text style={styles.value}>{item.cycleNumber}</Text>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>
              {item.paidAt
                ? `Payé le ${formatDate(item.paidAt)}`
                : `Créé le ${formatDate(item.createdAt)}`}
            </Text>
          </ScrollView>
        ) : null}
        <Text style={styles.footnote}>
          Résumé basé sur les données de votre historique de cotisations.
        </Text>
        <Pressable style={styles.ok} onPress={onClose} accessibilityRole="button">
          <Text style={styles.okText}>Fermer</Text>
        </Pressable>
      </Pressable>
    </Pressable>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  box: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 10,
    fontWeight: '600',
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  amount: {
    fontSize: 22,
    fontWeight: '800',
    color: GREEN,
  },
  penalty: {
    fontSize: 15,
    fontWeight: '700',
    color: '#D0021B',
  },
  footnote: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 12,
  },
  ok: {
    marginTop: 16,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  okText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
  },
});
