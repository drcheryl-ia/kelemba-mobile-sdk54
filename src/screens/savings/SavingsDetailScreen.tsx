/**
 * Détail tontine épargne — useSavingsDetail + useSavingsBonusPool.
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
import { useSavingsDetail, useSavingsBonusPool, useJoinSavingsTontine } from '@/hooks/useSavings';
import { formatFcfa } from '@/utils/formatters';
import { SavingsProgressBar, SavingsScreenHeader } from '@/components/savings';
import { SavingsInfoRow } from '@/components/savings/SavingsInfoRow';
import {
  frequencyLabel,
  daysUntil,
  isUnlockReached,
  progressPercent,
} from '@/utils/savings.utils';

type Route = RouteProp<RootStackParamList, 'SavingsDetailScreen'>;

const STATUS_BADGE: Record<string, { bg: string; label: string }> = {
  ACTIVE: { bg: '#1A6B3C', label: 'ACTIVE' },
  COMPLETED: { bg: '#9E9E9E', label: 'COMPLETED' },
  DRAFT: { bg: '#EA580C', label: 'DRAFT' },
  CANCELLED: { bg: '#9E9E9E', label: 'CANCELLED' },
};

function resolveUnlockLabel(unlockDate: string): string {
  if (isUnlockReached(unlockDate)) return 'Déblocage disponible';
  const d = daysUntil(unlockDate);
  if (d <= 0) return 'Déblocage disponible';
  return `Déblocage dans ${d} jour${d > 1 ? 's' : ''}`;
}

export const SavingsDetailScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Route>();
  const { tontineUid, uid: uidParam, isCreator } = route.params;
  const uid = uidParam ?? tontineUid;

  const {
    data: detail,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useSavingsDetail(uid);
  const { data: bonusPool, refetch: refetchBonus } = useSavingsBonusPool(uid);
  const joinMutation = useJoinSavingsTontine(uid);

  const refetchAll = () => {
    void refetch();
    void refetchBonus();
  };

  if (!uid) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Identifiant épargne manquant.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading && !detail) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1A6B3C" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !detail) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <SavingsScreenHeader
          title="Épargne"
          onBack={() => navigation.goBack()}
          backAccessibilityLabel="Retour"
          titleNumberOfLines={2}
        />
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Impossible de charger cette épargne.</Text>
          <Pressable style={styles.retryBtn} onPress={() => refetchAll()}>
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const cfg = detail.config;
  const maxM = cfg?.maxMembers ?? 0;
  const targetGlobal = cfg?.targetAmountGlobal;
  const unlockDateForHeader = cfg?.unlockDate ?? detail.unlockDate;
  const minimumContribution =
    cfg?.minimumContribution ?? detail.minimumContribution;
  const collectedGlobal =
    (detail as { totalCollectedGlobal?: number }).totalCollectedGlobal ??
    detail.totalContributed;
  const pct =
    targetGlobal != null && targetGlobal > 0
      ? progressPercent(collectedGlobal, targetGlobal)
      : 0;

  const badge = STATUS_BADGE[detail.status] ?? { bg: '#9E9E9E', label: detail.status };
  const statusChips = [
    {
      key: 's',
      label: badge.label,
      backgroundColor: badge.bg,
      textColor: '#FFFFFF',
    },
  ];

  const showJoinBanner = detail.status === 'DRAFT' && !detail.myStatus;
  const leftMember =
    detail.myStatus === 'WITHDRAWN' || detail.myStatus === 'EXCLUDED';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <SavingsScreenHeader
        title={detail.name}
        subtitle={resolveUnlockLabel(unlockDateForHeader)}
        onBack={() => navigation.goBack()}
        backAccessibilityLabel="Retour"
        statusChips={statusChips}
        titleNumberOfLines={2}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetchAll}
            tintColor="#1A6B3C"
          />
        }
      >
        {leftMember ? (
          <View style={styles.bannerMuted}>
            <Text style={styles.bannerText}>
              Vous ne participez plus à cette épargne.
            </Text>
          </View>
        ) : null}

        {showJoinBanner ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              Vous n&apos;avez pas encore rejoint cette tontine
            </Text>
            <Pressable
              style={styles.joinBtn}
              onPress={() => joinMutation.mutate()}
              disabled={joinMutation.isPending}
            >
              <Text style={styles.joinBtnText}>Rejoindre</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Progression collective</Text>
          <SavingsInfoRow
            label="Membres actifs / max"
            value={`${detail.memberCount}${maxM > 0 ? ` / ${maxM}` : ''}`}
          />
          {targetGlobal != null && targetGlobal > 0 ? (
            <>
              <Text style={styles.metaMuted}>Collectif vs objectif</Text>
              <SavingsProgressBar
                current={collectedGlobal}
                target={targetGlobal}
                showLabel
              />
              <Text style={styles.metaSmall}>
                {formatFcfa(collectedGlobal)} / {formatFcfa(targetGlobal)} ({pct}%)
              </Text>
            </>
          ) : null}
          <SavingsInfoRow
            label="Fréquence des versements"
            value={frequencyLabel(detail.frequency)}
          />
          <SavingsInfoRow
            label="Montant minimum par période"
            value={formatFcfa(minimumContribution)}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mon solde</Text>
          <Text style={styles.balanceBig}>{formatFcfa(detail.personalBalance)}</Text>
          <Pressable
            style={styles.chipRow}
            onPress={() => navigation.navigate('SavingsMyBalanceScreen', { uid })}
          >
            <Text style={styles.chipText}>Voir ma projection →</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fonds bonus commun</Text>
          <Text style={styles.balanceMid}>{formatFcfa(bonusPool?.currentBalance ?? 0)}</Text>
          <Text style={styles.metaMuted}>Bonus accumulé (redistribution interne)</Text>
          <Text style={styles.disclaimer}>Indicatif — non garanti</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Actions</Text>
          <Pressable
            style={styles.ctaPrimary}
            onPress={() => navigation.navigate('SavingsPeriodsScreen', { uid })}
          >
            <Text style={styles.ctaPrimaryText}>Verser ma cotisation</Text>
          </Pressable>
          <Pressable
            style={styles.ctaSecondary}
            onPress={() => navigation.navigate('SavingsMyBalanceScreen', { uid })}
          >
            <Text style={styles.ctaSecondaryText}>Voir ma projection</Text>
          </Pressable>
          {isCreator === true && detail.status === 'ACTIVE' ? (
            <Pressable style={styles.ctaPlaceholder} disabled>
              <Text style={styles.ctaPlaceholderText}>Gérer les membres (bientôt)</Text>
            </Pressable>
          ) : null}
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
  banner: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  bannerMuted: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  bannerText: { fontSize: 14, color: '#1C1C1E', marginBottom: 12 },
  joinBtn: {
    height: 48,
    backgroundColor: '#1A6B3C',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
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
  balanceBig: { fontSize: 28, fontWeight: '700', color: '#1A6B3C', marginBottom: 8 },
  balanceMid: { fontSize: 20, fontWeight: '700', color: '#1C1C1E', marginBottom: 4 },
  chipRow: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
  },
  chipText: { fontSize: 14, fontWeight: '600', color: '#1A6B3C' },
  metaMuted: { fontSize: 12, color: '#9CA3AF', marginBottom: 4 },
  metaSmall: { fontSize: 14, color: '#1C1C1E', marginBottom: 8 },
  disclaimer: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },
  ctaPrimary: {
    height: 52,
    backgroundColor: '#F5A623',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  ctaPrimaryText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  ctaSecondary: {
    height: 48,
    borderWidth: 1,
    borderColor: '#1A6B3C',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  ctaSecondaryText: { fontSize: 14, fontWeight: '600', color: '#1A6B3C' },
  ctaPlaceholder: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
  },
  ctaPlaceholderText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
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