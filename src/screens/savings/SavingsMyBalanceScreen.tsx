/**
 * Solde personnel, projection et aperçu de retrait.
 */
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import {
  useSavingsDetail,
  useSavingsMyBalance,
  useSavingsProjection,
  useSavingsWithdrawalPreview,
} from '@/hooks/useSavings';
import { formatFcfa } from '@/utils/formatters';
import { SavingsScreenHeader } from '@/components/savings';
import { SavingsInfoRow } from '@/components/savings/SavingsInfoRow';

type Route = RouteProp<RootStackParamList, 'SavingsMyBalanceScreen'>;

export const SavingsMyBalanceScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Route>();
  const { uid } = route.params;

  const { data: savingsDetail } = useSavingsDetail(uid);

  const {
    data: balance,
    isLoading: balLoading,
    isError: balError,
    refetch: refetchBal,
    isFetching: balFetching,
  } = useSavingsMyBalance(uid);
  const {
    data: projection,
    isLoading: projLoading,
    isError: projError,
    refetch: refetchProj,
    isFetching: projFetching,
  } = useSavingsProjection(uid);
  const {
    data: preview,
    isLoading: prevLoading,
    isError: prevError,
    refetch: refetchPrev,
    isFetching: prevFetching,
  } = useSavingsWithdrawalPreview(uid);

  const refetchAll = () => {
    void refetchBal();
    void refetchProj();
    void refetchPrev();
  };

  const loading =
    (balLoading && !balance) ||
    (projLoading && !projection) ||
    (prevLoading && !preview);
  const fetching = balFetching || projFetching || prevFetching;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <SavingsScreenHeader
          title="Mon solde"
          onBack={() => navigation.goBack()}
          backAccessibilityLabel="Retour"
        />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1A6B3C" />
        </View>
      </SafeAreaView>
    );
  }

  if (balError || !balance || projError || !projection || prevError || !preview) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <SavingsScreenHeader
          title="Mon solde"
          onBack={() => navigation.goBack()}
          backAccessibilityLabel="Retour"
        />
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Impossible de charger vos données.</Text>
          <Pressable style={styles.retryBtn} onPress={() => refetchAll()}>
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <SavingsScreenHeader
        title="Mon solde"
        onBack={() => navigation.goBack()}
        backAccessibilityLabel="Retour"
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={fetching}
            onRefresh={refetchAll}
            tintColor="#1A6B3C"
          />
        }
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mon capital</Text>
          <Text style={styles.capital}>{formatFcfa(balance.personalBalance)}</Text>
          <Text style={styles.meta}>Total versé : {formatFcfa(balance.totalContributed)}</Text>
          {balance.missedPeriodsCount > 0 ? (
            <View style={styles.badgeOrange}>
              <Text style={styles.badgeOrangeText}>
                {balance.missedPeriodsCount} période(s) manquée(s)
              </Text>
            </View>
          ) : null}
          <View
            style={[
              styles.badgeNeutral,
              balance.isBonusEligible ? styles.badgeOk : null,
            ]}
          >
            <Text
              style={[
                styles.badgeNeutralText,
                balance.isBonusEligible ? styles.badgeOkText : null,
              ]}
            >
              {balance.isBonusEligible ? 'Éligible au bonus' : 'Non éligible'}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ma projection</Text>
          <SavingsInfoRow
            label="Périodes restantes"
            value={String(projection.remainingPeriodsCount)}
          />
          <SavingsInfoRow
            label={"Capital estimé à l’échéance"}
            value={formatFcfa(projection.estimatedFinalCapital)}
          />
          <SavingsInfoRow
            label="Bonus estimé (quote-part)"
            value={formatFcfa(projection.estimatedBonus)}
          />
          <Text style={styles.highlightLabel}>Total estimé</Text>
          <Text style={styles.highlight}>{formatFcfa(projection.estimatedPayout)}</Text>
          <Text style={styles.disclosure}>{projection.projectionDisclosure}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Aperçu de retrait</Text>
          <SavingsInfoRow label="Capital" value={formatFcfa(preview.capitalAmount)} />
          <SavingsInfoRow
            label="Bonus estimé"
            value={formatFcfa(preview.estimatedBonusAmount)}
          />
          <SavingsInfoRow label="Pénalité" value={formatFcfa(preview.penaltyAmount)} />
          <SavingsInfoRow label="Total" value={formatFcfa(preview.totalAmount)} />
          {preview.isEarlyExitPossible ? (
            <Pressable
              style={styles.dangerBtn}
              onPress={() => {
                const memberUid = savingsDetail?.myMemberUid ?? '';
                if (!memberUid) return;
                navigation.navigate('SavingsWithdrawScreen', { uid, memberUid });
              }}
            >
              <Text style={styles.dangerBtnText}>Demander une sortie anticipée</Text>
            </Pressable>
          ) : null}
          {preview.canWithdraw ? (
            <Pressable
              style={styles.primaryBtn}
              onPress={() => {
                const memberUid = savingsDetail?.myMemberUid ?? '';
                if (!memberUid) return;
                navigation.navigate('SavingsWithdrawScreen', { uid, memberUid });
              }}
            >
              <Text style={styles.primaryBtnText}>Demander mon retrait</Text>
            </Pressable>
          ) : (
            <Text style={styles.blockedReason}>
              {preview.reasonIfBlocked ?? 'Retrait indisponible pour le moment.'}
            </Text>
          )}
          <Text style={styles.disclosure}>{preview.previewDisclosure}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E', marginBottom: 12 },
  capital: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1A6B3C',
    marginBottom: 8,
  },
  meta: { fontSize: 14, color: '#6B7280', marginBottom: 8 },
  badgeOrange: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
  },
  badgeOrangeText: { fontSize: 13, fontWeight: '600', color: '#B45309' },
  badgeNeutral: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeOk: { backgroundColor: '#DCFCE7' },
  badgeNeutralText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  badgeOkText: { color: '#166534' },
  highlightLabel: { fontSize: 14, color: '#6B7280', marginTop: 8 },
  highlight: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A6B3C',
    marginBottom: 8,
  },
  disclosure: { fontSize: 11, color: '#9CA3AF', marginTop: 8 },
  dangerBtn: {
    marginTop: 12,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#D0021B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  primaryBtn: {
    marginTop: 12,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1A6B3C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  blockedReason: { fontSize: 13, color: '#9CA3AF', marginTop: 8 },
  errorBox: { padding: 24 },
  errorText: { fontSize: 15, color: '#4B5563', marginBottom: 16 },
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#1A6B3C',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700' },
});