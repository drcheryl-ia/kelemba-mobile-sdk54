/**
 * Carte de récépissé numérique — paiement COMPLETED.
 * Affichage natif + partage et export PDF.
 */
import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { usePaymentReceipt } from '@/hooks/usePaymentReceipt';
import { formatFcfa, maskPhone } from '@/utils/formatters';
import type { PaymentReceiptData } from '@/types/payment';

export interface PaymentReceiptCardProps {
  receipt: PaymentReceiptData;
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const METHOD_LABELS: Record<PaymentReceiptData['method'], string> = {
  ORANGE_MONEY: 'Orange Money',
  TELECEL_MONEY: 'Telecel Money',
};

export const PaymentReceiptCard: React.FC<PaymentReceiptCardProps> = ({
  receipt,
}) => {
  const { t } = useTranslation();
  const {
    isGeneratingPdf,
    isSharingPdf,
    handleSharePdf,
    handleDownload,
  } = usePaymentReceipt(receipt);

  const methodLabel = METHOD_LABELS[receipt.method];
  const methodColor = receipt.method === 'ORANGE_MONEY' ? '#F5A623' : '#0055A5';

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>Kelemba Digital</Text>
        <View style={styles.badge}>
          <Ionicons name="checkmark-circle" size={16} color="#15803D" />
          <Text style={styles.badgeText}>
            {t('payment.receiptConfirmed', 'Paiement confirmé')}
          </Text>
        </View>
      </View>

      {/* Tontine & cycle */}
      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.label}>{t('payment.receiptTontine', 'Tontine')}</Text>
          <Text style={styles.value}>{receipt.tontineName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t('payment.receiptCycle', 'Cycle')}</Text>
          <Text style={styles.value}>
            {receipt.cycleNumber} / {receipt.totalCycles}
          </Text>
        </View>
        {receipt.beneficiaryName && (
          <View style={styles.row}>
            <Text style={styles.label}>
              {t('payment.receiptBeneficiary', 'Bénéficiaire')}
            </Text>
            <Text style={styles.value}>{receipt.beneficiaryName}</Text>
          </View>
        )}
      </View>

      {/* Montants */}
      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.label}>
            {t('payment.receiptBaseAmount', 'Montant de base')}
          </Text>
          <Text style={styles.value}>{formatFcfa(receipt.baseAmount)}</Text>
        </View>
        {receipt.penaltyAmount > 0 && (
          <View style={styles.row}>
            <Text style={[styles.label, styles.penaltyLabel]}>
              {t('payment.receiptPenalty', 'Pénalités retard')}
            </Text>
            <Text style={[styles.value, styles.penaltyValue]}>
              + {formatFcfa(receipt.penaltyAmount)}
            </Text>
          </View>
        )}
        <View style={[styles.row, styles.totalRow]}>
          <Text style={styles.totalLabel}>
            {t('payment.receiptTotal', 'TOTAL PAYÉ')}
          </Text>
          <Text style={styles.totalValue}>
            {formatFcfa(receipt.totalAmount)}
          </Text>
        </View>
      </View>

      {/* Méthode & ref */}
      <View style={styles.section}>
        <View style={styles.methodRow}>
          <View style={[styles.methodIcon, { backgroundColor: `${methodColor}20` }]}>
            <Ionicons
              name="phone-portrait-outline"
              size={20}
              color={methodColor}
            />
          </View>
          <Text style={[styles.methodText, { color: methodColor }]}>
            {methodLabel}
          </Text>
          <Text style={styles.phoneText}>
            {maskPhone(receipt.payerPhone)}
          </Text>
        </View>
        {receipt.externalRef && (
          <View style={styles.row}>
            <Text style={styles.label}>
              {t('payment.receiptOperatorRef', 'Réf. opérateur')}
            </Text>
            <Text style={[styles.value, styles.mono]}>{receipt.externalRef}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>{t('payment.receiptDate', 'Date')}</Text>
          <Text style={styles.value}>{formatDateTime(receipt.paidAt)}</Text>
        </View>
      </View>

      {/* Boutons */}
      <View style={styles.buttons}>
        <Pressable
          style={[styles.shareBtn, (isSharingPdf || isGeneratingPdf) && styles.btnDisabled]}
          onPress={handleSharePdf}
          disabled={isSharingPdf || isGeneratingPdf}
          accessibilityRole="button"
          accessibilityLabel={t('payment.receiptShare', 'Partager le reçu')}
        >
          {isSharingPdf ? (
            <ActivityIndicator size="small" color="#1A6B3C" />
          ) : (
            <Ionicons name="share-outline" size={20} color="#1A6B3C" />
          )}
          <Text style={styles.shareBtnText}>
            {t('payment.receiptShare', 'Partager le reçu')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.downloadBtn, (isSharingPdf || isGeneratingPdf) && styles.btnDisabled]}
          onPress={handleDownload}
          disabled={isSharingPdf || isGeneratingPdf}
          accessibilityRole="button"
          accessibilityLabel={t('payment.receiptDownload', 'Télécharger')}
        >
          {isGeneratingPdf ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="download-outline" size={20} color="#FFFFFF" />
          )}
          <Text style={styles.downloadBtnText}>
            {t('payment.receiptDownload', 'Télécharger')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  logo: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A6B3C',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D',
  },
  section: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  penaltyLabel: {
    color: '#D0021B',
  },
  penaltyValue: {
    color: '#D0021B',
  },
  totalRow: {
    borderBottomWidth: 0,
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A6B3C',
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodText: {
    fontSize: 16,
    fontWeight: '700',
  },
  phoneText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 'auto',
  },
  mono: {
    fontFamily: 'monospace',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E8F5EE',
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 48,
  },
  shareBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A6B3C',
  },
  downloadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1A6B3C',
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 48,
  },
  downloadBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
