/**
 * Carte cotisation — montant dominant, statut explicite, actions contextuelles.
 */
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { formatFcfa } from '@/utils/formatters';
import {
  paymentHistoryPrimaryTotal,
  paymentHistoryShowAmountBreakdown,
} from '@/utils/paymentAmountDisplay';
import type { PaymentHistoryListItemVm } from '../paymentViewModels';

const GREEN = '#1A6B3C';

type StatusVisual = { label: string; bg: string; text: string; a11y: string };

function statusVisual(status: PaymentHistoryListItemVm['status']): StatusVisual {
  switch (status) {
    case 'PENDING':
      return {
        label: 'En attente',
        bg: '#F5A623',
        text: '#FFFFFF',
        a11y: 'Statut : en attente',
      };
    case 'PROCESSING':
      return {
        label: 'En traitement',
        bg: '#F5A623',
        text: '#FFFFFF',
        a11y: 'Statut : en traitement',
      };
    case 'COMPLETED':
      return {
        label: 'Validé',
        bg: '#1A6B3C',
        text: '#FFFFFF',
        a11y: 'Statut : validé',
      };
    case 'FAILED':
      return {
        label: 'Rejeté',
        bg: '#D0021B',
        text: '#FFFFFF',
        a11y: 'Statut : rejeté ou échoué',
      };
    case 'REFUNDED':
      return {
        label: 'Remboursé',
        bg: '#8E8E93',
        text: '#FFFFFF',
        a11y: 'Statut : remboursé',
      };
    default:
      return { label: status, bg: '#8E8E93', text: '#FFFFFF', a11y: `Statut : ${status}` };
  }
}

function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const datePart = dateStr.split('T')[0];
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return '—';
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

function methodLabel(method: PaymentHistoryListItemVm['method']): string {
  switch (method) {
    case 'ORANGE_MONEY':
      return 'Orange Money';
    case 'TELECEL_MONEY':
      return 'Telecel Money';
    case 'CASH':
      return 'Espèces';
    case 'SYSTEM':
      return 'Système';
    default:
      return method;
  }
}

type Props = {
  item: PaymentHistoryListItemVm;
  currentUserUid: string | null;
  onPressDetails: () => void;
  onPressReceiptSummary: () => void;
  primaryActionLabel?: string;
  onPressPrimaryAction?: () => void;
};

export const PaymentHistoryCard: React.FC<Props> = ({
  item,
  currentUserUid,
  onPressDetails,
  onPressReceiptSummary,
  primaryActionLabel,
  onPressPrimaryAction,
}) => {
  const { t } = useTranslation();
  const sv = useMemo(() => statusVisual(item.status), [item.status]);
  const dateLine = item.paidAt ?? item.createdAt ?? null;
  const cashHint = item.cashStateLabel;
  const selfPay =
    currentUserUid != null &&
    item.memberUserUid != null &&
    item.memberUserUid === currentUserUid;
  const showProofCta =
    item.method === 'CASH' &&
    (item.status === 'PENDING' || item.status === 'PROCESSING') &&
    !item.cashAutoValidated &&
    !selfPay;
  const àTemps =
    item.penalty === 0 &&
    item.status === 'COMPLETED' &&
    !(item.method === 'CASH' && (item.cashAutoValidated || selfPay));

  const primaryTotal = paymentHistoryPrimaryTotal(item);
  const showAmountBreakdown = paymentHistoryShowAmountBreakdown(item);

  return (
    <View style={[styles.card, item.isActionRequired && styles.cardPriority]}>
      <View style={styles.topRow}>
        <View style={styles.topRowMain}>
          <Text style={styles.tontine} numberOfLines={2}>
            {item.tontineName}
          </Text>
          {item.roleLabel ? (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{item.roleLabel}</Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.badge, { backgroundColor: sv.bg }]} accessibilityLabel={sv.a11y}>
          <Text style={[styles.badgeText, { color: sv.text }]}>{sv.label}</Text>
        </View>
      </View>

      <Text style={styles.amount} accessibilityRole="text">
        {formatFcfa(primaryTotal)}
      </Text>

      <Text style={styles.meta}>
        Cycle {item.cycleNumber}
        {' · '}
        {item.paidAt
          ? `Paye le ${formatDateShort(item.paidAt)}`
          : `Cree le ${formatDateShort(dateLine)}`}
      </Text>

      <View style={styles.methodRow}>
        {item.method === 'ORANGE_MONEY' && (
          <Ionicons name="phone-portrait" size={18} color="#F5A623" />
        )}
        {item.method === 'TELECEL_MONEY' && (
          <Ionicons name="phone-portrait" size={18} color="#0055A5" />
        )}
        {item.method === 'CASH' && <Ionicons name="cash-outline" size={18} color={GREEN} />}
        {item.method === 'SYSTEM' && <Ionicons name="server-outline" size={18} color="#6B7280" />}
        <Text style={styles.methodText}>{methodLabel(item.method)}</Text>
      </View>

      <Text style={styles.statusMessage}>{item.statusMessage}</Text>

      {showAmountBreakdown ? (
        <View style={styles.breakdownBlock}>
          <Text style={styles.detailLine}>
            {t('paymentsDisplay.partLine', { value: formatFcfa(item.amount) })}
          </Text>
          {item.penalty > 0 ? (
            <Text style={styles.detailPenalty}>
              {t('paymentsDisplay.penaltyLine', { value: formatFcfa(item.penalty) })}
            </Text>
          ) : null}
        </View>
      ) : àTemps ? (
        <Text style={styles.okLine}>A temps</Text>
      ) : null}

      {cashHint && cashHint !== item.statusMessage ? (
        <Text style={styles.hint}>{cashHint}</Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          style={styles.actionSecondary}
          onPress={onPressDetails}
          accessibilityRole="button"
          accessibilityLabel="Voir détails de la tontine"
        >
          <Text style={styles.actionSecondaryText}>Voir détails</Text>
        </Pressable>
        <Pressable
          style={styles.actionSecondary}
          onPress={onPressReceiptSummary}
          accessibilityRole="button"
          accessibilityLabel="Voir le résumé du paiement"
        >
          <Text style={styles.actionSecondaryText}>Voir recu</Text>
        </Pressable>
        {(showProofCta || onPressPrimaryAction) && primaryActionLabel && onPressPrimaryAction ? (
          <Pressable
            style={styles.actionPrimary}
            onPress={onPressPrimaryAction}
            accessibilityRole="button"
            accessibilityLabel={primaryActionLabel}
          >
            <Text style={styles.actionPrimaryText}>{primaryActionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardPriority: {
    borderWidth: 1,
    borderColor: '#F5A623',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  topRowMain: {
    flex: 1,
    gap: 8,
  },
  tontine: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#E8F5EE',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: GREEN,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    maxWidth: '42%',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  amount: {
    fontSize: 28,
    fontWeight: '800',
    color: GREEN,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  meta: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  methodText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  statusMessage: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 6,
  },
  breakdownBlock: {
    marginBottom: 4,
    gap: 2,
  },
  detailLine: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  detailPenalty: {
    fontSize: 13,
    color: '#D0021B',
    fontWeight: '600',
  },
  okLine: {
    fontSize: 13,
    color: GREEN,
    fontWeight: '600',
    marginBottom: 4,
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  actionSecondary: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
  },
  actionSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  actionPrimary: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: GREEN,
  },
  actionPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
