/**
 * Formulaire de versement pour une période donnée.
 */
import React, { useRef, useCallback, useMemo, useEffect } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '@/navigation/types';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Resolver } from 'react-hook-form';
import { z } from 'zod';
import { useSavingsDashboard, useContributeSavings } from '@/hooks/useSavings';
import { formatFCFA } from '@/utils/savings.utils';
import { AmountInput, SavingsScreenHeader } from '@/components/savings';
import { parseApiError } from '@/api/errors/errorHandler';

type Route = RouteProp<RootStackParamList, 'SavingsContributeScreen'>;

type FormData = {
  amount: number;
  method: 'ORANGE_MONEY' | 'TELECEL_MONEY';
};

export const SavingsContributeScreen: React.FC = () => {
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { tontineUid, periodUid } = route.params;
  const idempotencyKeyRef = useRef<string | null>(null);

  const { data: dashboard, isLoading } = useSavingsDashboard(tontineUid);
  const contributeMutation = useContributeSavings(tontineUid);

  const config = dashboard?.savingsConfig;
  const currentPeriod = dashboard?.currentPeriod;
  const minAmount = config?.minimumContribution ?? 500;
  const bonusRate = config?.bonusRatePercent ?? 0;

  const contributeSchema = useMemo(
    () =>
      z.object({
        amount: z
          .number()
          .int()
          .min(
            minAmount,
            t('savingsContribute.minError', { amount: formatFCFA(minAmount) })
          ),
        method: z.enum(['ORANGE_MONEY', 'TELECEL_MONEY']),
      }),
    [minAmount, t]
  );

  const resolver = useMemo<Resolver<FormData>>(
    () => zodResolver(contributeSchema),
    [contributeSchema]
  );

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
    reset,
    getValues,
    formState: { errors },
  } = useForm<FormData>({
    resolver,
    defaultValues: {
      amount: minAmount,
      method: 'ORANGE_MONEY',
    },
  });

  useEffect(() => {
    reset({ amount: minAmount, method: getValues('method') });
  }, [minAmount, reset, getValues]);

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
      Alert.alert(t('savingsContribute.successTitle'), t('savingsContribute.successMessage'));
    } catch (err: unknown) {
      const apiErr = parseApiError(err);
      if (apiErr.httpStatus === 409) {
        Alert.alert(
          t('savingsContribute.errorDuplicateTitle'),
          t('savingsContribute.errorDuplicateMessage'),
          [
            {
              text: t('savingsContribute.ok'),
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
        setError('amount', { message: t('savingsContribute.errorNetwork') });
      }
    }
  };

  if (isLoading || !dashboard) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <SavingsScreenHeader
          title={t('savingsContribute.loadingTitle')}
          onBack={() => navigation.goBack()}
          titleNumberOfLines={1}
        />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1A6B3C" />
        </View>
      </SafeAreaView>
    );
  }

  const periodNum = currentPeriod?.periodNumber ?? '?';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <SavingsScreenHeader
        title={dashboard.tontine.name}
        subtitle={t('savingsContribute.subtitle')}
        onBack={() => navigation.goBack()}
        titleNumberOfLines={2}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
      <View style={styles.contextCard}>
        <Text style={styles.contextTitle}>
          {t('savingsContribute.contextTitle', { n: String(periodNum) })}
        </Text>
        {currentPeriod && (
          <Text style={styles.contextText}>
            {new Date(currentPeriod.openDate).toLocaleDateString('fr-FR')} —{' '}
            {new Date(currentPeriod.closeDate).toLocaleDateString('fr-FR')}
          </Text>
        )}
        <Text style={styles.contextMin}>
          {t('savingsContribute.minimumLabel', { amount: formatFCFA(minAmount) })}
        </Text>
      </View>

      <Controller
        control={control}
        name="amount"
        render={({ field: { onChange, value } }) => (
          <AmountInput
            value={String(value)}
            onChange={(t) => onChange(parseInt(t.replace(/\D/g, ''), 10) || 0)}
            minimumAmount={minAmount}
            label={t('savingsContribute.amountLabel')}
          />
        )}
      />
      {errors.amount && <Text style={styles.error}>{errors.amount.message}</Text>}

      {bonusRate > 0 && amount >= minAmount && (
        <Text style={styles.bonusHint}>
          {t('savingsContribute.bonusSplitHint', {
            bonus: formatFCFA(bonusDeducted),
            net: formatFCFA(netAmount),
          })}
        </Text>
      )}

      <Text style={styles.label}>{t('savingsContribute.paymentMethod')}</Text>
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
          <Text style={styles.ctaText}>
            {t('savingsContribute.cta', { amount: formatFCFA(amount) })}
          </Text>
        )}
      </Pressable>
    </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },
  scroll: { flex: 1 },
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
