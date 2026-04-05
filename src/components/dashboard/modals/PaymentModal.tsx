/**
 * Modal paiement cotisation — bottom sheet (Modal RN + Animated, sans lib tierce).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Animated,
  Alert,
  ScrollView,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { initiatePayment } from '@/api/paymentApi';
import { navigationRef } from '@/navigation/navigationRef';
import { COLORS } from '@/theme/colors';
import { formatFcfa, formatFcfaAmount } from '@/utils/formatters';
import { logger } from '@/utils/logger';
import { selectUserUid } from '@/store/authSlice';
import type { RootState } from '@/store/store';
import type { MobileMoneyMethod } from '@/types/payment';

const PANEL_OFF = Math.round(Dimensions.get('window').height * 0.55);

export type PaymentModalUrgency = 'OVERDUE' | 'DUE';

export interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  tontineName: string;
  cycleLabel: string;
  totalAmountDue: number;
  penaltyAmount: number;
  cycleUid: string;
  tontineUid: string;
  cycleNumber: number;
  /** Montant de base (hors pénalité) — navigation PaymentScreen mode espèces */
  paymentBaseAmount: number;
  urgency: PaymentModalUrgency;
  onPaymentSuccess: () => void;
}

type MethodSel = 'ORANGE_MONEY' | 'TELECEL_MONEY' | 'CASH';

const METHODS: { id: MethodSel; label: string; icon: keyof typeof Ionicons.glyphMap }[] =
  [
    { id: 'ORANGE_MONEY', label: 'Orange Money', icon: 'phone-portrait-outline' },
    { id: 'TELECEL_MONEY', label: 'Telecel Money', icon: 'phone-portrait-outline' },
    { id: 'CASH', label: 'Espèces', icon: 'cash-outline' },
  ];

export const PaymentModal: React.FC<PaymentModalProps> = ({
  visible,
  onClose,
  tontineName,
  cycleLabel,
  totalAmountDue,
  penaltyAmount,
  cycleUid,
  tontineUid,
  cycleNumber,
  paymentBaseAmount,
  urgency,
  onPaymentSuccess,
}) => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const userUid = useSelector((s: RootState) => selectUserUid(s));
  const [selectedMethod, setSelectedMethod] = useState<MethodSel>('ORANGE_MONEY');
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(PANEL_OFF)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 0.45,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: PANEL_OFF,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, overlayOpacity, slideAnim]);

  const mutation = useMutation({
    mutationFn: (vars: {
      cycleUid: string;
      amount: number;
      method: MobileMoneyMethod;
      idempotencyKey: string;
    }) => initiatePayment(vars),
  });

  const handleInitiatePayment = useCallback(() => {
    if (selectedMethod !== 'ORANGE_MONEY' && selectedMethod !== 'TELECEL_MONEY') {
      return;
    }
    const method: MobileMoneyMethod = selectedMethod;
    const idempotencyKey = globalThis.crypto.randomUUID();
    mutation.mutate(
      {
        cycleUid,
        amount: totalAmountDue,
        method,
        idempotencyKey,
      },
      {
        onSuccess: () => {
          if (userUid != null) {
            void queryClient.invalidateQueries({
              queryKey: ['nextPayment', userUid],
            });
            void queryClient.invalidateQueries({
              queryKey: ['tontines', userUid],
            });
          } else {
            void queryClient.invalidateQueries({ queryKey: ['nextPayment'] });
            void queryClient.invalidateQueries({ queryKey: ['tontines'] });
          }
          onPaymentSuccess();
          onClose();
        },
        onError: (err: unknown) => {
          logger.error('PaymentModal initiate error', err);
          Alert.alert(
            'Erreur',
            "Le paiement n'a pas pu être initié. Réessayez."
          );
        },
      }
    );
  }, [
    cycleUid,
    mutation,
    onClose,
    onPaymentSuccess,
    queryClient,
    selectedMethod,
    totalAmountDue,
    userUid,
  ]);

  const handleConfirmCash = useCallback(() => {
    if (!navigationRef.isReady()) return;
    onClose();
    navigationRef.navigate('PaymentScreen', {
      cycleUid,
      tontineUid,
      tontineName,
      baseAmount: paymentBaseAmount,
      penaltyAmount,
      cycleNumber,
    });
  }, [
    cycleNumber,
    cycleUid,
    onClose,
    paymentBaseAmount,
    penaltyAmount,
    tontineName,
    tontineUid,
  ]);

  const handlePrimaryCta = useCallback(() => {
    if (selectedMethod === 'CASH') {
      handleConfirmCash();
      return;
    }
    handleInitiatePayment();
  }, [handleConfirmCash, handleInitiatePayment, selectedMethod]);

  const ctaBg =
    urgency === 'OVERDUE' ? COLORS.danger : COLORS.primary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <View style={styles.root}>
        <Animated.View
          pointerEvents="none"
          style={[styles.overlay, { opacity: overlayOpacity }]}
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer" />
        <Animated.View
          style={[
            styles.panel,
            {
              transform: [{ translateY: slideAnim }],
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={styles.handle} accessibilityRole="none" />
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Payer ma cotisation</Text>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
            >
              <Ionicons name="close" size={20} color={COLORS.gray700} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.context}>
              {tontineName} · {cycleLabel}
            </Text>
            <View style={styles.amountBox}>
              <Text style={styles.amountKicker}>Montant à payer</Text>
              <Text style={styles.amountBig}>
                {formatFcfaAmount(totalAmountDue)} FCFA
              </Text>
              {penaltyAmount > 0 ? (
                <Text style={styles.penaltyHint}>
                  dont {formatFcfa(penaltyAmount)} de pénalité
                </Text>
              ) : null}
            </View>

            <Text style={styles.methodsTitle}>MOYEN DE PAIEMENT</Text>
            {METHODS.map((m) => {
              const sel = selectedMethod === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setSelectedMethod(m.id)}
                  style={[
                    styles.methodRow,
                    sel && styles.methodRowSelected,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: sel }}
                >
                  <View
                    style={[
                      styles.methodIcon,
                      sel && { backgroundColor: COLORS.primaryLight },
                    ]}
                  >
                    <Ionicons
                      name={m.icon}
                      size={20}
                      color={sel ? COLORS.primaryDark : COLORS.gray700}
                    />
                  </View>
                  <Text
                    style={[
                      styles.methodLabel,
                      sel && { color: COLORS.primaryDark, fontWeight: '600' },
                    ]}
                  >
                    {m.label}
                  </Text>
                  <Ionicons
                    name={sel ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={sel ? COLORS.primary : COLORS.gray200}
                  />
                </Pressable>
              );
            })}

            <Pressable
              onPress={handlePrimaryCta}
              disabled={mutation.isPending}
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: ctaBg },
                pressed && opacityPressed,
                mutation.isPending && styles.ctaDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Confirmer ${formatFcfa(totalAmountDue)}`}
            >
              {mutation.isPending ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.ctaText}>
                  Confirmer — {formatFcfa(totalAmountDue)}
                </Text>
              )}
            </Pressable>
            {selectedMethod !== 'CASH' ? (
              <Text style={styles.pinHint}>
                Votre PIN sera demandé pour confirmer
              </Text>
            ) : (
              <Text style={styles.pinHint}>
                Vous serez redirigé vers le flux espèces (preuve photo).
              </Text>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const opacityPressed = { opacity: 0.92 };

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  panel: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '88%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.gray200,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray100,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  context: {
    fontSize: 12,
    color: COLORS.gray500,
    marginTop: 12,
    marginHorizontal: 20,
  },
  amountBox: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  amountKicker: {
    fontSize: 12,
    color: COLORS.primaryDark,
    marginBottom: 4,
  },
  amountBig: {
    fontSize: 32,
    fontWeight: '500',
    color: COLORS.primary,
  },
  penaltyHint: {
    fontSize: 11,
    color: COLORS.secondaryText,
    marginTop: 4,
  },
  methodsTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.gray500,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginHorizontal: 20,
    marginBottom: 8,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    gap: 10,
  },
  methodRowSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  methodIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray100,
  },
  methodLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  cta: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.white,
  },
  pinHint: {
    fontSize: 11,
    color: COLORS.gray500,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
});
