/**
 * Récapitulatif de retrait + confirmation.
 */
import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/navigation/types';
import { useSavingsDashboard, useRequestWithdrawal, useRequestEarlyExit } from '@/hooks/useSavings';
import { savingsApi } from '@/api/savings.api';
import { formatFCFA, isUnlockReached } from '@/utils/savings.utils';
import { parseApiError } from '@/api/errors/errorHandler';
import { useState, useEffect } from 'react';

type Route = RouteProp<RootStackParamList, 'SavingsWithdrawScreen'>;

export const SavingsWithdrawScreen: React.FC = () => {
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const { tontineUid } = route.params;

  const { data: dashboard, isLoading } = useSavingsDashboard(tontineUid);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof savingsApi.getWithdrawalPreview>> | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [method, setMethod] = useState<'ORANGE_MONEY' | 'TELECEL_MONEY'>('ORANGE_MONEY');
  const idempotencyKeyRef = useRef<string | null>(null);

  const withdrawMutation = useRequestWithdrawal(tontineUid);
  const earlyExitMutation = useRequestEarlyExit(tontineUid);

  const config = dashboard?.savingsConfig;
  const isEarlyExit = config ? !isUnlockReached(config.unlockDate) : false;

  const getOrCreateIdempotencyKey = useCallback(() => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }
    return idempotencyKeyRef.current;
  }, []);

  useEffect(() => {
    let cancelled = false;
    savingsApi
      .getWithdrawalPreview(tontineUid)
      .then((p) => {
        if (!cancelled) setPreview(p);
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tontineUid]);

  const handleConfirm = async () => {
    if (!preview) return;
    const key = getOrCreateIdempotencyKey();
    const methodLabel = method === 'ORANGE_MONEY' ? 'Orange Money' : 'Telecel Money';

    Alert.alert(
      'Confirmer le retrait',
      `Vous allez recevoir ${formatFCFA(preview.totalAmount)} sur ${methodLabel}. Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              const payload = { method, idempotencyKey: key };
              if (isEarlyExit) {
                await earlyExitMutation.mutateAsync(payload);
              } else {
                await withdrawMutation.mutateAsync(payload);
              }
              (navigation as { navigate: (a: string) => void }).navigate('MainTabs');
            } catch (err: unknown) {
              const apiErr = parseApiError(err);
              Alert.alert('Erreur', apiErr.message ?? 'Une erreur est survenue.');
            }
          },
        },
      ]
    );
  };

  if (isLoading || !dashboard) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1A6B3C" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {isEarlyExit ? (
        <View style={styles.bannerOrange}>
          <Text style={styles.bannerText}>
            ⚠️ Sortie anticipée — une pénalité de {config?.earlyExitPenaltyPercent ?? 0} % sera
            appliquée.
          </Text>
        </View>
      ) : (
        <View style={styles.bannerGreen}>
          <Text style={styles.bannerText}>✅ Votre épargne est disponible !</Text>
        </View>
      )}

      {previewLoading ? (
        <ActivityIndicator color="#1A6B3C" style={styles.loader} />
      ) : preview ? (
        <View style={styles.previewCard}>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Capital personnel</Text>
            <Text style={styles.previewValue}>{formatFCFA(preview.capitalAmount)}</Text>
          </View>
          {preview.bonusAmount > 0 && (
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Bonus communautaire</Text>
              <Text style={styles.previewValue}>{formatFCFA(preview.bonusAmount)}</Text>
            </View>
          )}
          {preview.penaltyAmount > 0 && (
            <View style={styles.previewRow}>
              <Text style={[styles.previewLabel, styles.previewPenalty]}>
                Pénalité sortie anti.
              </Text>
              <Text style={[styles.previewValue, styles.previewPenalty]}>
                -{formatFCFA(preview.penaltyAmount)}
              </Text>
            </View>
          )}
          <View style={styles.previewDivider} />
          <View style={styles.previewRow}>
            <Text style={styles.previewTotalLabel}>TOTAL À RECEVOIR</Text>
            <Text style={styles.previewTotalValue}>{formatFCFA(preview.totalAmount)}</Text>
          </View>
        </View>
      ) : (
        <Text style={styles.errorText}>Impossible de charger l'aperçu du retrait.</Text>
      )}

      <Text style={styles.label}>Méthode de réception</Text>
      <View style={styles.methodRow}>
        <Pressable
          style={[styles.methodCard, method === 'ORANGE_MONEY' && styles.methodCardActive]}
          onPress={() => setMethod('ORANGE_MONEY')}
        >
          <Text style={styles.methodText}>Orange Money</Text>
        </Pressable>
        <Pressable
          style={[styles.methodCard, method === 'TELECEL_MONEY' && styles.methodCardActive]}
          onPress={() => setMethod('TELECEL_MONEY')}
        >
          <Text style={styles.methodText}>Telecel Money</Text>
        </Pressable>
      </View>

      {preview && (
        <Pressable
          style={styles.cta}
          onPress={handleConfirm}
          disabled={withdrawMutation.isPending || earlyExitMutation.isPending}
        >
          {withdrawMutation.isPending || earlyExitMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.ctaText}>Recevoir {formatFCFA(preview.totalAmount)}</Text>
          )}
        </Pressable>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bannerOrange: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  bannerGreen: {
    backgroundColor: '#DCFCE7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  bannerText: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  loader: { marginVertical: 24 },
  errorText: { fontSize: 14, color: '#D0021B', marginBottom: 20 },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  previewLabel: { fontSize: 14, color: '#6B7280' },
  previewValue: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  previewPenalty: { color: '#D0021B' },
  previewDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 8 },
  previewTotalLabel: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  previewTotalValue: { fontSize: 24, fontWeight: '700', color: '#1A6B3C' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 },
  methodRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  methodCard: {
    flex: 1,
    height: 80,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodCardActive: { borderColor: '#1A6B3C', backgroundColor: '#E8F5EE' },
  methodText: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  cta: {
    height: 52,
    backgroundColor: '#1A6B3C',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
