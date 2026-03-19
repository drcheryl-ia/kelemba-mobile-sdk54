/**
 * Écran de statut du paiement — polling temps réel.
 * GET /api/v1/payments/:id/status toutes les 3s, max 2 min.
 */
import React, { useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Linking,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { usePaymentPolling } from '@/hooks/usePaymentPolling';
import { formatFcfa } from '@/utils/formatters';
import type { PaymentMethod } from '@/types/payment';

const MAX_POLL_ATTEMPTS = 40;
const POLL_INTERVAL_MS = 3_000;

const METHOD_LABELS: Record<PaymentMethod, string> = {
  ORANGE_MONEY: 'Orange Money',
  TELECEL_MONEY: 'Telecel Money',
};

const SUPPORT_WHATSAPP = 'https://wa.me/23670000000';
const ORANGE_HELP_URL = 'https://www.orange.cf';
const TELECEL_HELP_URL = 'https://www.telecel.cf';

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentStatusScreen'>;

export const PaymentStatusScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { paymentUid, tontineUid, tontineName, amount, method } = route.params;

  const { status, data, isTimeout, attempts, maxAttempts } =
    usePaymentPolling(paymentUid);

  const rotation = useSharedValue(0);
  const successScale = useSharedValue(0);
  const failedScale = useSharedValue(0);
  const timeoutPulse = useSharedValue(1);

  const isPending = status === 'PENDING' || status === 'PROCESSING';
  const isCompleted = status === 'COMPLETED';
  const isFailed = status === 'FAILED';

  useEffect(() => {
    if (isPending) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 1000, easing: Easing.linear }),
        -1,
        false
      );
    }
  }, [isPending, rotation]);

  useEffect(() => {
    if (isCompleted) {
      successScale.value = withSpring(1, { damping: 12, stiffness: 180 });
    }
  }, [isCompleted, successScale]);

  useEffect(() => {
    if (isFailed) {
      failedScale.value = withSpring(1, { damping: 12, stiffness: 180 });
    }
  }, [isFailed, failedScale]);

  useEffect(() => {
    if (isTimeout) {
      timeoutPulse.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ),
        -1,
        false
      );
    }
  }, [isTimeout, timeoutPulse]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const successStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScale.value }],
  }));

  const failedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: failedScale.value }],
  }));

  const timeoutStyle = useAnimatedStyle(() => ({
    transform: [{ scale: timeoutPulse.value }],
  }));

  const progressRatio = Math.min(1, attempts / maxAttempts);
  const remainingSeconds = Math.max(
    0,
    Math.ceil(((maxAttempts - attempts) * POLL_INTERVAL_MS) / 1000)
  );

  const handleViewReceipt = () => {
    queryClient.invalidateQueries({ queryKey: ['cycle', 'current', tontineUid] });
    queryClient.invalidateQueries({ queryKey: ['members', tontineUid] });
    queryClient.invalidateQueries({ queryKey: ['payments', 'history'] });
    navigation.pop(2);
  };

  const handleBackToTontine = () => {
    queryClient.invalidateQueries({ queryKey: ['cycle', 'current', tontineUid] });
    queryClient.invalidateQueries({ queryKey: ['members', tontineUid] });
    navigation.pop(2);
  };

  const handleRetry = () => {
    navigation.goBack();
  };

  const handleSupport = () => {
    Linking.openURL(SUPPORT_WHATSAPP).catch(() => {});
  };

  const handleOperatorHelp = () => {
    const url = method === 'ORANGE_MONEY' ? ORANGE_HELP_URL : TELECEL_HELP_URL;
    Linking.openURL(url).catch(() => {});
  };

  const methodLabel = METHOD_LABELS[method];
  const totalPaid = data ? data.amount + (data.penalty ?? 0) : amount;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* PENDING / PROCESSING */}
        {isPending && (
          <View style={styles.content}>
            <Animated.View style={[styles.iconWrapper, spinStyle]}>
              <View style={styles.spinnerCircle}>
                <Ionicons
                  name="sync"
                  size={48}
                  color="#0055A5"
                />
              </View>
            </Animated.View>
            <Text style={styles.title}>
              {t('payment.statusProcessing', 'Paiement en cours de traitement')}
            </Text>
            <Text style={styles.subtitle}>
              {t('payment.statusWait', 'Veuillez patienter…')}
            </Text>
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progressRatio * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressLabel}>
                {remainingSeconds}s {t('payment.statusRemaining', 'restant')}
              </Text>
            </View>
            <View style={styles.methodBlock}>
              <Text style={styles.methodText}>{methodLabel}</Text>
              <Text style={styles.amountText}>{formatFcfa(amount)}</Text>
            </View>
          </View>
        )}

        {/* COMPLETED */}
        {isCompleted && (
          <View style={styles.content}>
            <Animated.View style={[styles.iconWrapper, successStyle]}>
              <View style={[styles.statusCircle, styles.statusCircleSuccess]}>
                <Ionicons name="checkmark" size={56} color="#FFFFFF" />
              </View>
            </Animated.View>
            <Text style={styles.title}>
              {t('payment.statusSuccess', 'Paiement réussi !')}
            </Text>
            <Text style={[styles.amountLarge, styles.amountSuccess]}>
              {formatFcfa(totalPaid)}
            </Text>
            {data?.externalRef && (
              <Text style={styles.refLabel}>
                {t('payment.reference', 'Référence')} : {data.externalRef}
              </Text>
            )}
            {data?.paidAt && (
              <Text style={styles.dateLabel}>
                {formatDateTime(data.paidAt)}
              </Text>
            )}
            <Pressable
              style={styles.primaryBtn}
              onPress={handleViewReceipt}
              accessibilityRole="button"
              accessibilityLabel={t('payment.viewReceipt', 'Voir le reçu')}
            >
              <Text style={styles.primaryBtnText}>
                {t('payment.viewReceipt', 'Voir le reçu')}
              </Text>
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              onPress={handleBackToTontine}
              accessibilityRole="button"
              accessibilityLabel={t('payment.backToTontine', 'Retour à la tontine')}
            >
              <Text style={styles.secondaryBtnText}>
                {t('payment.backToTontine', 'Retour à la tontine')}
              </Text>
            </Pressable>
          </View>
        )}

        {/* FAILED */}
        {isFailed && (
          <View style={styles.content}>
            <Animated.View style={[styles.iconWrapper, failedStyle]}>
              <View style={[styles.statusCircle, styles.statusCircleFailed]}>
                <Ionicons name="close" size={56} color="#FFFFFF" />
              </View>
            </Animated.View>
            <Text style={styles.title}>
              {t('payment.statusFailed', 'Paiement échoué')}
            </Text>
            <Text style={styles.errorMessage}>
              {data?.externalRef
                ? t('payment.failedWithRef', 'Transaction refusée. Réf : {{ref}}', {
                    ref: data.externalRef,
                  })
                : t(
                    'payment.failedNoRef',
                    "Le paiement n'a pas pu être traité par l'opérateur."
                  )}
            </Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={handleRetry}
              accessibilityRole="button"
              accessibilityLabel={t('common.retry', 'Réessayer')}
            >
              <Text style={styles.primaryBtnText}>
                {t('common.retry', 'Réessayer')}
              </Text>
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              onPress={handleSupport}
              accessibilityRole="button"
              accessibilityLabel={t('payment.contactSupport', 'Contacter le support')}
            >
              <Text style={styles.secondaryBtnText}>
                {t('payment.contactSupport', 'Contacter le support')}
              </Text>
            </Pressable>
          </View>
        )}

        {/* TIMEOUT */}
        {isTimeout && (
          <View style={styles.content}>
            <Animated.View style={[styles.iconWrapper, timeoutStyle]}>
              <View style={[styles.statusCircle, styles.statusCircleTimeout]}>
                <Ionicons name="time-outline" size={56} color="#FFFFFF" />
              </View>
            </Animated.View>
            <Text style={styles.title}>
              {t('payment.statusTimeout', 'Délai dépassé')}
            </Text>
            <Text style={styles.timeoutMessage}>
              {t(
                'payment.timeoutMessage',
                "Nous n'avons pas reçu de confirmation de l'opérateur. Vérifiez votre solde {{method}} avant de réessayer. Réf interne : {{uid}}",
                { method: methodLabel, uid: paymentUid }
              )}
            </Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={handleRetry}
              accessibilityRole="button"
              accessibilityLabel={t('common.retry', 'Réessayer')}
            >
              <Text style={styles.primaryBtnText}>
                {t('common.retry', 'Réessayer')}
              </Text>
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              onPress={handleOperatorHelp}
              accessibilityRole="button"
              accessibilityLabel={t('payment.checkOperator', 'Vérifier auprès de {{method}}', {
                method: methodLabel,
              })}
            >
              <Text style={styles.secondaryBtnText}>
                {t('payment.checkOperator', 'Vérifier auprès de {{method}}', {
                  method: methodLabel,
                })}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 40,
  },
  content: {
    alignItems: 'center',
    paddingTop: 40,
  },
  iconWrapper: {
    marginBottom: 24,
  },
  spinnerCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F4FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCircleSuccess: {
    backgroundColor: '#1A6B3C',
  },
  statusCircleFailed: {
    backgroundColor: '#D0021B',
  },
  statusCircleTimeout: {
    backgroundColor: '#F5A623',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 32,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0055A5',
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  methodBlock: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    gap: 4,
  },
  methodText: {
    fontSize: 14,
    color: '#6B7280',
  },
  amountText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  amountLarge: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
  },
  amountSuccess: {
    color: '#1A6B3C',
  },
  refLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  dateLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 32,
  },
  errorMessage: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  timeoutMessage: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  primaryBtn: {
    backgroundColor: '#1A6B3C',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 56,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 56,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
  },
});
