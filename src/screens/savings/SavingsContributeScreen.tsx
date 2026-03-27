/**
 * Formulaire de versement pour une période donnée.
 * Idempotency : UUID généré uniquement au premier appui sur « Confirmer », conservé en cas d’erreur.
 */
import React, { useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Resolver } from 'react-hook-form';
import { z } from 'zod';
import { useSavingsDetail, useSavingsPeriods, useContributeSavings } from '@/hooks/useSavings';
import { formatFcfa, formatDateLong } from '@/utils/formatters';
import { AmountInput, SavingsScreenHeader } from '@/components/savings';
import { parseApiError } from '@/api/errors/errorHandler';

type Route = RouteProp<RootStackParamList, 'SavingsContributeScreen'>;

type FormData = {
  amount: number;
  method: 'ORANGE_MONEY' | 'TELECEL_MONEY' | 'CASH';
};

export const SavingsContributeScreen: React.FC = () => {
  const route = useRoute<Route>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { uid, periodUid, minimumAmount } = route.params;

  const idempotencyKeyRef = useRef<string | null>(null);

  const { data: detail, isLoading: detailLoading } = useSavingsDetail(uid);
  const { data: periodsRaw, isLoading: periodsLoading } = useSavingsPeriods(uid);
  const periods = Array.isArray(periodsRaw) ? periodsRaw : [];
  const period = periods.find((p) => p.uid === periodUid) ?? null;

  const contributeMutation = useContributeSavings(uid);

  const contributeSchema = useMemo(
    () =>
      z.object({
        amount: z
          .number()
          .int()
          .min(
            minimumAmount,
            `Montant minimum : ${formatFcfa(minimumAmount)}`
          ),
        method: z.enum(['ORANGE_MONEY', 'TELECEL_MONEY', 'CASH']),
      }),
    [minimumAmount]
  );

  const resolver = useMemo<Resolver<FormData>>(
    () => zodResolver(contributeSchema),
    [contributeSchema]
  );

  const {
    control,
    handleSubmit,
    watch,
    reset,
    getValues,
    formState: { errors },
  } = useForm<FormData>({
    resolver,
    defaultValues: {
      amount: minimumAmount,
      method: 'ORANGE_MONEY',
    },
  });

  useEffect(() => {
    reset({ amount: minimumAmount, method: getValues('method') });
  }, [minimumAmount, reset, getValues]);

  const amount = watch('amount');
  const method = watch('method');

  const onSubmit = async (data: FormData) => {
    let key = idempotencyKeyRef.current;
    if (key == null) {
      key = crypto.randomUUID();
      idempotencyKeyRef.current = key;
    }
    try {
      await contributeMutation.mutateAsync({
        periodUid,
        amount: data.amount,
        method: data.method,
        idempotencyKey: key,
      });
      Alert.alert('Versement enregistré !', '', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: unknown) {
      const apiErr = parseApiError(err);
      Alert.alert('Erreur', apiErr.message ?? 'Une erreur est survenue. Réessayez.');
    }
  };

  const loadingMeta = detailLoading || periodsLoading;

  if (loadingMeta && !detail && !period) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <SavingsScreenHeader
          title="Versement"
          onBack={() => navigation.goBack()}
          titleNumberOfLines={1}
        />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1A6B3C" />
        </View>
      </SafeAreaView>
    );
  }

  const title = detail?.name ?? 'Versement';
  const openD = period?.openDate.split('T')[0] ?? '';
  const closeD = period?.closeDate.split('T')[0] ?? '';
  const periodLine =
    period != null
      ? `Période ${period.periodNumber} — du ${formatDateLong(openD)} au ${formatDateLong(closeD)}`
      : 'Période — dates en cours de chargement';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <SavingsScreenHeader
        title={title}
        subtitle="Cotisation"
        onBack={() => navigation.goBack()}
        titleNumberOfLines={2}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.contextCard}>
            <Text style={styles.contextTitle}>{periodLine}</Text>
            <Text style={styles.contextMin}>
              Montant minimum : {formatFcfa(minimumAmount)}
            </Text>
          </View>

          <Controller
            control={control}
            name="amount"
            render={({ field: { onChange, value } }) => (
              <AmountInput
                value={String(value)}
                onChange={(t) => onChange(parseInt(t.replace(/\D/g, ''), 10) || 0)}
                minimumAmount={minimumAmount}
                label={`Montant à verser (min. ${formatFcfa(minimumAmount)})`}
              />
            )}
          />
          {errors.amount ? (
            <Text style={styles.error}>{errors.amount.message}</Text>
          ) : null}

          <Text style={styles.label}>Mode de paiement</Text>
          <View style={styles.methodRow}>
            <Controller
              control={control}
              name="method"
              render={({ field: { onChange, value } }) => (
                <>
                  <Pressable
                    style={[
                      styles.methodCard,
                      value === 'ORANGE_MONEY' && styles.methodCardActive,
                    ]}
                    onPress={() => onChange('ORANGE_MONEY')}
                  >
                    <Text style={styles.methodText}>Orange Money</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.methodCard,
                      value === 'TELECEL_MONEY' && styles.methodCardActive,
                    ]}
                    onPress={() => onChange('TELECEL_MONEY')}
                  >
                    <Text style={styles.methodText}>Telecel Money</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.methodCard,
                      value === 'CASH' && styles.methodCardActive,
                    ]}
                    onPress={() => onChange('CASH')}
                  >
                    <Text style={styles.methodText}>Espèces</Text>
                  </Pressable>
                </>
              )}
            />
          </View>

          <Pressable
            style={[
              styles.cta,
              (amount < minimumAmount || !method) && styles.ctaDisabled,
            ]}
            onPress={handleSubmit(onSubmit)}
            disabled={
              amount < minimumAmount || !method || contributeMutation.isPending
            }
          >
            {contributeMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaText}>Confirmer le versement</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  contextCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  contextTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', marginBottom: 8 },
  contextMin: { fontSize: 14, fontWeight: '600', color: '#374151' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 },
  error: { fontSize: 12, color: '#D0021B', marginTop: 4, marginBottom: 8 },
  methodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  methodCard: {
    flexGrow: 1,
    flexBasis: '28%',
    minWidth: 96,
    minHeight: 48,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
  },
  methodCardActive: { borderColor: '#1A6B3C', backgroundColor: '#E8F5EE' },
  methodText: { fontSize: 13, fontWeight: '600', color: '#1C1C1E', textAlign: 'center' },
  cta: {
    minHeight: 48,
    backgroundColor: '#1A6B3C',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
