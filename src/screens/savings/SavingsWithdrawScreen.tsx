/**
 * Récapitulatif de retrait + confirmation (idempotence côté client).
 */
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
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
import {
  useSavingsDetail,
  useSavingsWithdrawalPreview,
  useWithdrawSavings,
} from '@/hooks/useSavings';
import { formatFcfa } from '@/utils/formatters';
import { parseApiError } from '@/api/errors/errorHandler';
import { SavingsScreenHeader } from '@/components/savings';

type Route = RouteProp<RootStackParamList, 'SavingsWithdrawScreen'>;

export const SavingsWithdrawScreen: React.FC = () => {
  const route = useRoute<Route>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { uid, memberUid } = route.params;

  const idempotencyKeyRef = useRef<string | null>(null);
  const [method, setMethod] = useState<'ORANGE_MONEY' | 'TELECEL_MONEY' | 'CASH'>(
    'ORANGE_MONEY'
  );
  const [earlyExitAccepted, setEarlyExitAccepted] = useState(false);

  const { data: detail, isLoading: detailLoading } = useSavingsDetail(uid);
  const {
    data: preview,
    isLoading: previewLoading,
    isError: previewError,
    refetch,
  } = useSavingsWithdrawalPreview(uid);

  const withdrawMutation = useWithdrawSavings(uid);

  const loading = (detailLoading && !detail) || (previewLoading && !preview);

  if (!memberUid) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <SavingsScreenHeader
          title="Retrait"
          onBack={() => navigation.goBack()}
          titleNumberOfLines={1}
        />
        <View style={styles.blockedWrap}>
          <Text style={styles.blockedTitle}>
            Référence membre manquante. Revenez en arrière et réessayez.
          </Text>
          <Pressable style={styles.ctaOutline} onPress={() => navigation.goBack()}>
            <Text style={styles.ctaOutlineText}>Retour</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const handleConfirm = async () => {
    if (!preview?.canWithdraw) return;
    if (preview.isEarlyExitPossible && !earlyExitAccepted) return;

    let key = idempotencyKeyRef.current;
    if (key == null) {
      key = crypto.randomUUID();
      idempotencyKeyRef.current = key;
    }

    try {
      await withdrawMutation.mutateAsync({ method, idempotencyKey: key });
      Alert.alert(
        'Demande de retrait enregistrée. Traitement en cours.',
        undefined,
        [
          {
            text: 'OK',
            onPress: () =>
              navigation.navigate('SavingsDetailScreen', {
                tontineUid: uid,
                isCreator: false,
              }),
          },
        ]
      );
    } catch (err: unknown) {
      const apiErr = parseApiError(err);
      Alert.alert('Erreur', apiErr.message ?? 'Une erreur est survenue. Réessayez.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <SavingsScreenHeader
          title="Retrait"
          onBack={() => navigation.goBack()}
          titleNumberOfLines={1}
        />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1A6B3C" />
        </View>
      </SafeAreaView>
    );
  }

  if (previewError || !preview) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <SavingsScreenHeader
          title="Retrait"
          onBack={() => navigation.goBack()}
          titleNumberOfLines={1}
        />
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Impossible de charger l&apos;aperçu.</Text>
          <Pressable style={styles.retryBtn} onPress={() => void refetch()}>
            <Text style={styles.retryText}>Réessayer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const title = detail?.name ?? 'Retrait';

  if (!preview.canWithdraw) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <SavingsScreenHeader
          title={title}
          subtitle="Retrait"
          onBack={() => navigation.goBack()}
          titleNumberOfLines={2}
        />
        <View style={styles.blockedWrap}>
          <Text style={styles.blockedTitle}>
            Retrait non disponible :{' '}
            {preview.reasonIfBlocked ?? 'conditions non remplies.'}
          </Text>
          <Pressable style={styles.ctaOutline} onPress={() => navigation.goBack()}>
            <Text style={styles.ctaOutlineText}>Retour</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const confirmDisabled =
    withdrawMutation.isPending ||
    (preview.isEarlyExitPossible && !earlyExitAccepted);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <SavingsScreenHeader
        title={title}
        subtitle="Retrait"
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
          <View style={styles.previewCard}>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Capital</Text>
              <Text style={styles.previewValue}>{formatFcfa(preview.capitalAmount)}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Bonus estimé</Text>
              <Text style={styles.previewValue}>
                {formatFcfa(preview.estimatedBonusAmount)}
              </Text>
            </View>
            <View style={styles.previewRow}>
              <Text
                style={[
                  styles.previewLabel,
                  preview.penaltyAmount > 0 ? styles.penaltyText : null,
                ]}
              >
                Pénalité
              </Text>
              <Text
                style={[
                  styles.previewValue,
                  preview.penaltyAmount > 0 ? styles.penaltyText : null,
                ]}
              >
                {formatFcfa(preview.penaltyAmount)}
              </Text>
            </View>
            <View style={styles.previewDivider} />
            <View style={styles.previewRow}>
              <Text style={styles.totalLabel}>Total estimé</Text>
              <Text style={styles.totalValue}>{formatFcfa(preview.totalAmount)}</Text>
            </View>
          </View>

          <Text style={styles.disclosure}>{preview.previewDisclosure}</Text>

          {preview.isEarlyExitPossible ? (
            <View style={styles.bannerAmber}>
              <Text style={styles.bannerTitle}>
                ⚠ Sortie anticipée — une pénalité de {formatFcfa(preview.penaltyAmount)}{' '}
                sera appliquée.
              </Text>
              <Pressable
                style={styles.checkRow}
                onPress={() => setEarlyExitAccepted((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: earlyExitAccepted }}
              >
                <View
                  style={[styles.checkBox, earlyExitAccepted && styles.checkBoxOn]}
                >
                  {earlyExitAccepted ? <Text style={styles.checkMark}>✓</Text> : null}
                </View>
                <Text style={styles.checkLabel}>
                  Je confirme comprendre les conditions de sortie anticipée
                </Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={styles.label}>Mode de réception</Text>
          <View style={styles.methodRow}>
            <Pressable
              style={[
                styles.methodCard,
                method === 'ORANGE_MONEY' && styles.methodCardActive,
              ]}
              onPress={() => setMethod('ORANGE_MONEY')}
            >
              <Text style={styles.methodText}>Orange Money</Text>
            </Pressable>
            <Pressable
              style={[
                styles.methodCard,
                method === 'TELECEL_MONEY' && styles.methodCardActive,
              ]}
              onPress={() => setMethod('TELECEL_MONEY')}
            >
              <Text style={styles.methodText}>Telecel Money</Text>
            </Pressable>
            <Pressable
              style={[styles.methodCard, method === 'CASH' && styles.methodCardActive]}
              onPress={() => setMethod('CASH')}
            >
              <Text style={styles.methodText}>Espèces</Text>
            </Pressable>
          </View>

          <Pressable
            style={[styles.cta, confirmDisabled && styles.ctaDisabled]}
            onPress={() => void handleConfirm()}
            disabled={confirmDisabled}
          >
            {withdrawMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaText}>Confirmer le retrait</Text>
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
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  previewLabel: { fontSize: 14, color: '#6B7280' },
  previewValue: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  penaltyText: { color: '#D0021B' },
  previewDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  totalValue: { fontSize: 20, fontWeight: '700', color: '#1A6B3C' },
  disclosure: { fontSize: 11, color: '#9CA3AF', marginBottom: 16 },
  bannerAmber: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  bannerTitle: { fontSize: 14, fontWeight: '600', color: '#92400E', marginBottom: 12 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#92400E',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkBoxOn: { backgroundColor: '#1A6B3C', borderColor: '#1A6B3C' },
  checkMark: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  checkLabel: { flex: 1, fontSize: 14, color: '#1C1C1E', lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 },
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
  blockedWrap: { padding: 24, gap: 20 },
  blockedTitle: { fontSize: 15, color: '#4B5563', lineHeight: 22 },
  ctaOutline: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1A6B3C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaOutlineText: { fontSize: 16, fontWeight: '700', color: '#1A6B3C' },
  errorBox: { padding: 24 },
  errorText: { fontSize: 15, color: '#4B5563', marginBottom: 16 },
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#1A6B3C',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
});
