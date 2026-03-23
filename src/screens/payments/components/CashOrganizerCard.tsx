/**
 * Carte decision - validation especes (organisateur).
 */
import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { OrganizerCashPendingAction } from '@/api/cashPaymentApi';
import { formatFcfa } from '@/utils/formatters';
import type { CashDecisionAction } from '../organizerCashMutations';

const GREEN = '#1A6B3C';
const RED = '#D0021B';

function formatDateTime(str: string): string {
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type Props = {
  row: OrganizerCashPendingAction;
  onPressCard: () => void;
  onValidate: () => void;
  onReject: () => void;
  busy: boolean;
  busyAction?: CashDecisionAction | null;
};

export const CashOrganizerCard: React.FC<Props> = ({
  row,
  onPressCard,
  onValidate,
  onReject,
  busy,
  busyAction,
}) => (
  <View
    style={[
      styles.card,
      row.receiptPhotoUrl ? styles.cardWithProof : styles.cardWithoutProof,
      busy ? styles.cardBusy : null,
    ]}
  >
    <Pressable
      style={styles.cardMain}
      onPress={onPressCard}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={`Detail paiement ${row.memberName}`}
    >
      <View style={styles.row}>
        <Text style={styles.member} numberOfLines={1}>
          {row.memberName}
        </Text>
        <Text style={styles.amount}>{formatFcfa(row.amount)}</Text>
      </View>
      <Text style={styles.meta} numberOfLines={1}>
        Cycle {row.cycleNumber} · {row.tontineName}
      </Text>
      <Text style={styles.meta}>Soumis : {formatDateTime(row.submittedAt)}</Text>
      {row.receiverName ? (
        <Text style={styles.meta}>Depositaire : {row.receiverName}</Text>
      ) : null}
      <View style={styles.proofRow}>
        {row.receiptPhotoUrl ? (
          <Image source={{ uri: row.receiptPhotoUrl }} style={styles.thumb} />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Ionicons name="document-text-outline" size={28} color="#9CA3AF" />
          </View>
        )}
        <View style={styles.proofMeta}>
          <Text
            style={[
              styles.proofLabel,
              row.receiptPhotoUrl ? styles.proofLabelOk : styles.proofLabelKo,
            ]}
          >
            {row.receiptPhotoUrl ? 'Preuve recue' : 'Aucune preuve'}
          </Text>
          <Text style={styles.proofCaption}>Statut : A traiter</Text>
        </View>
      </View>
    </Pressable>

    <View style={styles.actions}>
      <Text style={styles.actionsTitle}>Actions directes</Text>
      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.btn, styles.btnOk]}
          onPress={onValidate}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Valider le paiement"
        >
          {busyAction === 'APPROVE' ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.btnOkText}>Valider</Text>
          )}
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnKo]}
          onPress={onReject}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Rejeter le paiement"
        >
          {busyAction === 'REJECT' ? (
            <ActivityIndicator color={RED} />
          ) : (
            <Text style={styles.btnKoText}>Rejeter</Text>
          )}
        </Pressable>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardWithProof: {
    borderWidth: 1,
    borderColor: '#C6E6D4',
  },
  cardWithoutProof: {
    borderWidth: 1,
    borderColor: '#F4C7C7',
  },
  cardBusy: {
    opacity: 0.92,
  },
  cardMain: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 6,
  },
  member: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  amount: {
    fontSize: 20,
    fontWeight: '800',
    color: GREEN,
  },
  meta: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  proofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  proofMeta: {
    flex: 1,
    gap: 2,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  thumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proofLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  proofLabelOk: {
    color: GREEN,
  },
  proofLabelKo: {
    color: RED,
  },
  proofCaption: {
    fontSize: 12,
    color: '#374151',
  },
  actions: {
    padding: 12,
    paddingTop: 0,
    gap: 10,
  },
  actionsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOk: {
    backgroundColor: GREEN,
  },
  btnOkText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 15,
  },
  btnKo: {
    borderWidth: 1,
    borderColor: RED,
    backgroundColor: '#FFF',
  },
  btnKoText: {
    color: RED,
    fontWeight: '800',
    fontSize: 15,
  },
});
