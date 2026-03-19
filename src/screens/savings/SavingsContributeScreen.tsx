/**
 * Formulaire de versement pour une période donnée.
 */
import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/navigation/types';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSavingsDashboard, useContributeSavings } from '@/hooks/useSavings';
import { formatFCFA } from '@/utils/savings.utils';
import { AmountInput } from '@/components/savings';
import { parseApiError } from '@/api/errors/errorHandler';

type Route = RouteProp<RootStackParamList, 'SavingsContributeScreen'>;

const contributeSchema = z.object({
  amount: z.number().int().min(500),
  method: z.enum(['ORANGE_MONEY', 'TELECEL_MONEY']),
});

type FormData = z.infer<typeof contributeSchema>;

export const SavingsContributeScreen: React.FC = () => {
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const { tontineUid, periodUid } = route.params;
  const idempotencyKeyRef = useRef<string | null>(null);

  const { data: dashboard, isLoading } = useSavingsDashboard(tontineUid);
  const contributeMutation = useContributeSavings(tontineUid);

  const config = dashboard?.savingsConfig;
  const currentPeriod = dashboard?.currentPeriod;
  const minAmount = config?.minimumContribution ?? 500;
  const bonusRate = config?.bonusRatePercent ?? 0;

  const getOrCreateIdempotencyKey = useCallback(() => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }
    return idempotencyKeyRef.current;
  }, []);

  const {
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(contributeSchema),
    defaultValues: {
      amount: minAmount,
      method: 'ORANGE_MONEY',
    },
  });

  const amount = watch('amount');
  const method = watch('method');
  const bonusDeducted = Math.round((amount ?? 0) * (bonusRate / 100));
  const netAmount = (amount ?? 0) - bonusDeducted;

  const onSubmit = async (data: FormData) => {
    const key = getOrCreateIdempotencyKey();
    try {
      await contributeMutation.mutateAsync({
        periodUid,
        amount: data.amount,
        method: data.method,
        idempotencyKey: key,
      });
      (navigation as { navigate: (a: string, b: object) => void }).navigate(
        'SavingsBalanceScreen',
        { tontineUid }
      );
      Alert.alert('Succès', 'Votre versement a été enregistré.');
    } catch (err: unknown) {
      const apiErr = parseApiError(err);
      if (apiErr.httpStatus === 409) {
        Alert.alert(
          'Déjà traité',
          'Ce versement a déjà été traité.',
          [
            {
              text: 'OK',
              onPress: () =>
                (navigation as { navigate: (a: string, b: object) => void }).navigate(
                  'SavingsBalanceScreen',
                  { tontineUid }
                ),
            },
          ]
        );
      } else if (apiErr.httpStatus === 400) {
        setError('amount', { message: apiErr.message });
      } else {
        setError('amount', { message: 'Erreur réseau. Réessayez.' });
      }
    }
  };

  if (isLoading || !dashboard) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1A6B3C" />
      </View>
    );
  }

  const periodNum = currentPeriod?.periodNumber ?? '?';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.contextCard}>
        <Text style={styles.contextTitle}>Période {periodNum}</Text>
        {currentPeriod && (
          <Text style={styles.contextText}>
            {new Date(currentPeriod.openDate).toLocaleDateString('fr-FR')} —{' '}
            {new Date(currentPeriod.closeDate).toLocaleDateString('fr-FR')}
          </Text>
        )}
        <Text style={styles.contextMin}>Minimum requis : {formatFCFA(minAmount)}</Text>
      </View>

      <Controller
        control={control}
        name="amount"
        render={({ field: { onChange, value } }) => (
          <AmountInput
            value={String(value)}
            onChange={(t) => onChange(parseInt(t.replace(/\D/g, ''), 10) || 0)}
            minimumAmount={minAmount}
            label="Montant (FCFA)"
          />
        )}
      />
      {errors.amount && <Text style={styles.error}>{errors.amount.message}</Text>}

      {bonusRate > 0 && amount >= minAmount && (
        <Text style={styles.bonusHint}>
          Dont {formatFCFA(bonusDeducted)} → fonds bonus commun | {formatFCFA(netAmount)} → votre
          épargne
        </Text>
      )}

      <Text style={styles.label}>Méthode de paiement</Text>
      <View style={styles.methodRow}>
        <Controller
          control={control}
          name="method"
          render={({ field: { onChange, value } }) => (
            <>
              <Pressable
                style={[styles.methodCard, value === 'ORANGE_MONEY' && styles.methodCardActive]}
                onPress={() => onChange('ORANGE_MONEY')}
              >
                <Text style={styles.methodText}>Orange Money</Text>
              </Pressable>
              <Pressable
                style={[styles.methodCard, value === 'TELECEL_MONEY' && styles.methodCardActive]}
                onPress={() => onChange('TELECEL_MONEY')}
              >
                <Text style={styles.methodText}>Telecel Money</Text>
              </Pressable>
            </>
          )}
        />
      </View>

      <Pressable
        style={[
          styles.cta,
          (amount < minAmount || !method) && styles.ctaDisabled,
        ]}
        onPress={handleSubmit(onSubmit)}
        disabled={amount < minAmount || !method || contributeMutation.isPending}
      >
        {contributeMutation.isPending ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.ctaText}>Verser {formatFCFA(amount)}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  contextCard: {
    backgroundColor: '#F7F8FA',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  contextTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E', marginBottom: 4 },
  contextText: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  contextMin: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 },
  error: { fontSize: 12, color: '#D0021B', marginTop: 4 },
  bonusHint: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
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
    backgroundColor: '#F5A623',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
