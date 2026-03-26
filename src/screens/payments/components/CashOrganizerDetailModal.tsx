/**
 * Modal - detail validation especes (apercu recu, coordonnees, actions).
 */
import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { OrganizerCashPendingAction } from '@/api/cashPaymentApi';
import { formatFcfa } from '@/utils/formatters';
import {
  organizerCashPrimaryTotal,
  organizerCashShareAmount,
  organizerCashShowAmountBreakdown,
} from '@/utils/paymentAmountDisplay';
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
  visible: boolean;
  onClose: () => void;
  row: OrganizerCashPendingAction | null;
  onValidate: () => void;
  onReject: () => void;
  busy: boolean;
  busyAction?: CashDecisionAction | null;
};

export const CashOrganizerDetailModal: React.FC<Props> = ({
  visible,
  onClose,
  row,
  onValidate,
  onReject,
  busy,
  busyAction,
}) => {
  const { t } = useTranslation();
  const primaryTotal = row ? organizerCashPrimaryTotal(row) : 0;
  const share = row ? organizerCashShareAmount(row) : 0;
  const pen = row?.penaltyAmount ?? 0;
  const showBreakdown = row ? organizerCashShowAmountBreakdown(row) : false;

  return (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <View style={styles.box}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Detail du paiement</Text>
          <Pressable onPress={onClose} accessibilityLabel="Fermer" disabled={busy}>
            <Ionicons name="close" size={26} color="#6B7280" />
          </Pressable>
        </View>
        {row ? (
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.amount}>{formatFcfa(primaryTotal)}</Text>
            {showBreakdown ? (
              <View style={styles.breakdownBlock}>
                <Text style={styles.breakdownText}>
                  {t('paymentsDisplay.partLine', { value: formatFcfa(share) })}
                </Text>
                {pen > 0 ? (
                  <Text style={styles.breakdownPenalty}>
                    {t('paymentsDisplay.penaltyLine', { value: formatFcfa(pen) })}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <Text style={styles.label}>Membre</Text>
            <Text style={styles.value}>{row.memberName}</Text>
            <Text style={styles.label}>Tontine</Text>
            <Text style={styles.value}>{row.tontineName}</Text>
            <Text style={styles.label}>Cycle</Text>
            <Text style={styles.value}>{row.cycleNumber}</Text>
            <Text style={styles.label}>Soumis le</Text>
            <Text style={styles.value}>{formatDateTime(row.submittedAt)}</Text>
            {row.receiverName ? (
              <>
                <Text style={styles.label}>Nom du depositaire</Text>
                <Text style={styles.value}>{row.receiverName}</Text>
              </>
            ) : null}
            {row.receiptPhotoUrl ? (
              <>
                <Text style={styles.label}>Recu</Text>
                <Image
                  source={{ uri: row.receiptPhotoUrl }}
                  style={styles.fullImage}
                  resizeMode="contain"
                />
              </>
            ) : (
              <View style={styles.noPhoto}>
                <Ionicons name="image-outline" size={48} color="#9CA3AF" />
                <Text style={styles.noPhotoText}>Aucune photo de recu</Text>
              </View>
            )}
          </ScrollView>
        ) : null}
        <View style={styles.footer}>
          <Pressable
            style={[styles.btn, styles.btnOk]}
            onPress={onValidate}
            disabled={busy || !row}
            accessibilityRole="button"
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
            disabled={busy || !row}
            accessibilityRole="button"
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
  </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  box: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '92%',
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
  amount: {
    fontSize: 28,
    fontWeight: '800',
    color: GREEN,
    marginBottom: 8,
  },
  breakdownBlock: {
    marginBottom: 12,
    gap: 4,
  },
  breakdownText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  breakdownPenalty: {
    fontSize: 14,
    color: RED,
    fontWeight: '600',
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    fontWeight: '600',
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  fullImage: {
    width: '100%',
    height: 220,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  noPhoto: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  noPhotoText: {
    marginTop: 8,
    color: '#6B7280',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  btn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOk: {
    backgroundColor: GREEN,
  },
  btnOkText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 16,
  },
  btnKo: {
    borderWidth: 1,
    borderColor: RED,
    backgroundColor: '#FFF',
  },
  btnKoText: {
    color: RED,
    fontWeight: '800',
    fontSize: 16,
  },
});
