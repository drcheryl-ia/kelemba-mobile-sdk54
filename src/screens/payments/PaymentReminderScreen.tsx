/**
 * PaymentReminderScreen — récapitulatif avant paiement.
 * Point d'entrée depuis tap notification FCM ou bannière dashboard.
 * Affiche le détail du versement dû et redirige vers PaymentScreen.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';
import { selectUserUid } from '@/store/authSlice';
import { useTontineMembers } from '@/hooks/useTontineMembers';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { getCurrentCycle } from '@/api/tontinesApi';
import { formatFcfa } from '@/utils/formatters';
import { logger } from '@/utils/logger';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentReminderScreen'>;

// ── Helpers ────────────────────────────────────────────────────────
function formatDateFr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getUrgencyConfig(dueDate: string): {
  color: string;
  bg: string;
  label: string;
  icon: 'alarm' | 'time' | 'calendar-outline';
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate.split('T')[0]}T00:00:00`);
  const diff = Math.round(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diff < 0)
    return {
      color: '#C0392B',
      bg: '#FFF0EE',
      label: `En retard de ${Math.abs(diff)} jour${Math.abs(diff) > 1 ? 's' : ''}`,
      icon: 'alarm',
    };
  if (diff === 0)
    return {
      color: '#D0021B',
      bg: '#FFF3EC',
      label: "Échéance aujourd'hui",
      icon: 'alarm',
    };
  if (diff === 1)
    return {
      color: '#7C2D12',
      bg: '#FFF3EC',
      label: 'Échéance demain',
      icon: 'time',
    };
  return {
    color: '#F5A623',
    bg: '#FFFBEB',
    label: `Échéance dans ${diff} jours`,
    icon: 'calendar-outline',
  };
}

// ── Composant ──────────────────────────────────────────────────────
export const PaymentReminderScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const {
    tontineUid,
    tontineName,
    cycleUid,
    amountDue,
    penaltyAmount,
    dueDate,
    cycleNumber,
  } = route.params;

  const { t } = useTranslation();

  // Vérifier si la cotisation est déjà réglée pour ce cycle
  const { members } = useTontineMembers(tontineUid);
  const userUid = useSelector((state: RootState) => selectUserUid(state));
  const myMember = React.useMemo(
    () => (userUid ? members.find((m) => m.userUid === userUid) : null),
    [members, userUid]
  );
  const isPaid = myMember?.currentCyclePaymentStatus === 'COMPLETED';

  const queryClient = useQueryClient();

  const totalDue = amountDue + (penaltyAmount ?? 0);
  const urgency = getUrgencyConfig(dueDate);

  // Animation d'entrée
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 340,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();

    logger.info('[PaymentReminderScreen] Affiché', {
      tontineUid,
      cycleUid,
      dueDate,
      totalDue,
    });
  }, [fadeAnim, slideAnim, tontineUid, cycleUid, dueDate, totalDue]);

  const handlePay = () => {
    void queryClient.prefetchQuery({
      queryKey: ['cycle', 'current', tontineUid],
      queryFn: () => getCurrentCycle(tontineUid),
    });
    navigation.replace('PaymentScreen', {
      cycleUid,
      tontineUid,
      tontineName,
      baseAmount: amountDue,
      penaltyAmount: penaltyAmount ?? 0,
      cycleNumber,
    });
  };

  const handleViewTontine = () => {
    navigation.navigate('TontineDetails', {
      tontineUid,
      isCreator: false,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={12}
        >
          <Ionicons name="close" size={22} color="#1A1A2E" />
        </Pressable>
        <Text style={styles.headerTitle}>Rappel de cotisation</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.inner,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Badge statut */}
          {isPaid ? (
            <View style={[styles.urgencyBadge, styles.paidBadge]}>
              <Ionicons name="checkmark-circle" size={18} color="#1A6B3C" />
              <Text style={[styles.urgencyText, styles.paidBadgeText]}>
                Cotisation déjà réglée
              </Text>
            </View>
          ) : (
            <View style={[styles.urgencyBadge, { backgroundColor: urgency.bg }]}>
              <Ionicons name={urgency.icon} size={18} color={urgency.color} />
              <Text style={[styles.urgencyText, { color: urgency.color }]}>
                {urgency.label}
              </Text>
            </View>
          )}

          {/* Nom tontine */}
          <Text style={styles.tontineName}>{tontineName}</Text>
          <Text style={styles.cycleLabel}>Cycle {cycleNumber}</Text>

          {/* Carte montant */}
          <View style={styles.amountCard}>
            <View style={styles.amountRow}>
              <Text style={styles.amountRowLabel}>Cotisation</Text>
              <Text style={styles.amountRowValue}>{formatFcfa(amountDue)}</Text>
            </View>
            {penaltyAmount > 0 && (
              <View style={styles.amountRow}>
                <Text style={[styles.amountRowLabel, styles.penaltyLabel]}>
                  Pénalité de retard
                </Text>
                <Text style={[styles.amountRowValue, styles.penaltyValue]}>
                  + {formatFcfa(penaltyAmount)}
                </Text>
              </View>
            )}
            <View style={styles.divider} />
            <View style={styles.amountRow}>
              <Text style={styles.totalLabel}>Total à payer</Text>
              <Text style={styles.totalValue}>{formatFcfa(totalDue)}</Text>
            </View>
          </View>

          {/* Date échéance */}
          <View style={styles.dueDateRow}>
            <Ionicons name="calendar-outline" size={16} color="#6B7280" />
            <Text style={styles.dueDateText}>
              Échéance : {formatDateFr(dueDate)}
            </Text>
          </View>

          {/* Info paiement */}
          <View style={styles.infoBlock}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color="#0055A5"
            />
            <Text style={styles.infoText}>
              Paiement via Orange Money ou Telecel Money. Votre Score Kelemba
              sera mis à jour après confirmation.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Actions bas de page */}
      <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
        <Pressable
          style={styles.secondaryBtn}
          onPress={handleViewTontine}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryBtnText}>Voir la tontine</Text>
        </Pressable>
        <Pressable
          style={[
            styles.primaryBtn,
            (totalDue < 500 || isPaid) && styles.primaryBtnDisabled,
            isPaid && styles.primaryBtnPaid,
          ]}
          onPress={isPaid ? undefined : handlePay}
          disabled={totalDue < 500 || isPaid}
          accessibilityRole="button"
          accessibilityLabel={
            isPaid ? 'Cotisation déjà réglée' : `Payer ${formatFcfa(totalDue)}`
          }
        >
          <Ionicons
            name={isPaid ? 'checkmark-circle-outline' : 'card-outline'}
            size={20}
            color="#FFFFFF"
          />
          <Text style={styles.primaryBtnText}>
            {isPaid ? 'Déjà réglée ✓' : `Cotiser — ${formatFcfa(totalDue)}`}
          </Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
};

// ── Styles ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  headerRight: { width: 40 },
  content: { padding: 20, paddingBottom: 40 },
  inner: { gap: 16 },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  urgencyText: { fontSize: 14, fontWeight: '700' },
  tontineName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A2E',
    marginTop: 4,
  },
  cycleLabel: { fontSize: 14, color: '#6B7280', marginTop: -8 },
  amountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountRowLabel: { fontSize: 15, color: '#6B7280' },
  amountRowValue: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  penaltyLabel: { color: '#D0021B' },
  penaltyValue: { color: '#D0021B' },
  divider: { height: 1, backgroundColor: '#F0F0F0' },
  totalLabel: { fontSize: 17, fontWeight: '700', color: '#1A1A2E' },
  totalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A6B3C',
  },
  dueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dueDateText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  infoBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 14,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  secondaryBtn: {
    flex: 0,
    paddingHorizontal: 18,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#1A6B3C',
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnPaid: {
    backgroundColor: '#1A6B3C',
    opacity: 0.75,
  },
  paidBadge: {
    backgroundColor: '#DCFCE7',
  },
  paidBadgeText: {
    color: '#15803D',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
