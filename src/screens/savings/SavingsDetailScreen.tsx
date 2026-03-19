/**
 * Point d'entrée tontine Épargne — hub de navigation.
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
import type { RootStackParamList } from '@/navigation/types';
import { useSavingsDashboard, useMyBalance, useJoinSavingsTontine } from '@/hooks/useSavings';
import { formatFCFA, isUnlockReached, isPeriodOpen, daysUntil } from '@/utils/savings.utils';
import { SavingsProgressBar } from '@/components/savings';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';
import { selectUserUid } from '@/store/authSlice';

type Route = RouteProp<RootStackParamList, 'SavingsDetailScreen'>;

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#9E9E9E',
  ACTIVE: '#1A6B3C',
  COMPLETED: '#0055A5',
};

export const SavingsDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { tontineUid } = route.params;
  const userUid = useSelector(selectUserUid);

  const { data: dashboard, isLoading, refetch, isFetching } = useSavingsDashboard(tontineUid);
  const { data: balance } = useMyBalance(tontineUid);
  const joinMutation = useJoinSavingsTontine(tontineUid);

  const isMember = dashboard?.members.some((m) => m.userUid === userUid);
  const config = dashboard?.savingsConfig;
  const currentPeriod = dashboard?.currentPeriod ?? balance?.currentPeriod;
  const periodOpen = isPeriodOpen(currentPeriod ?? null);
  const unlockReached = config ? isUnlockReached(config.unlockDate) : false;

  if (isLoading || !dashboard) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1A6B3C" />
      </View>
    );
  }

  const statusColor = STATUS_COLORS[dashboard.tontine.status] ?? '#9E9E9E';
  const personalBalance = balance?.personalBalance ?? 0;
  const targetPerMember = config?.targetAmountPerMember ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <View style={styles.headerTitle}>
          <Text style={styles.title} numberOfLines={1}>
            {dashboard.tontine.name}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{dashboard.tontine.status}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor="#1A6B3C" />
        }
      >
        {dashboard.tontine.status === 'DRAFT' && !isMember && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>Vous n'avez pas encore rejoint cette tontine</Text>
            <Pressable
              style={styles.joinBtn}
              onPress={() => joinMutation.mutate()}
              disabled={joinMutation.isPending}
            >
              <Text style={styles.joinBtnText}>Rejoindre</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ma progression</Text>
          <Text style={styles.balanceBig}>{formatFCFA(personalBalance)}</Text>
          {targetPerMember != null && targetPerMember > 0 && (
            <SavingsProgressBar
              current={personalBalance}
              target={targetPerMember}
              showLabel
            />
          )}
          {periodOpen && (
            <Text style={styles.periodHint}>
              Versement en cours — {daysUntil(currentPeriod?.closeDate ?? '')} jours restants
            </Text>
          )}
          <View style={styles.cardActions}>
            {periodOpen && (
              <Pressable
                style={styles.ctaOrange}
                onPress={() => {
                  const period = balance?.currentPeriod;
                  if (period) {
                    (navigation as { navigate: (a: string, b: object) => void }).navigate(
                      'SavingsContributeScreen',
                      { tontineUid, periodUid: period.uid }
                    );
                  }
                }}
              >
                <Text style={styles.ctaText}>Verser maintenant</Text>
              </Pressable>
            )}
            <Pressable
              style={styles.ctaSecondary}
              onPress={() =>
                (navigation as { navigate: (a: string, b: object) => void }).navigate(
                  'SavingsBalanceScreen',
                  { tontineUid }
                )
              }
            >
              <Text style={styles.ctaSecondaryText}>Voir mon épargne</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Le groupe</Text>
          <Text style={styles.meta}>
            {dashboard.members.length} membre(s) actifs
          </Text>
          {config?.targetAmountGlobal != null && dashboard.globalProgressPercent != null && (
            <SavingsProgressBar
              current={(dashboard.globalProgressPercent / 100) * config.targetAmountGlobal}
              target={config.targetAmountGlobal}
              showLabel
            />
          )}
          <Text style={styles.meta}>Fonds bonus : {formatFCFA(dashboard.bonusPoolBalance)}</Text>
          <Pressable
            style={styles.ctaSecondary}
            onPress={() =>
              (navigation as { navigate: (a: string, b: object) => void }).navigate(
                'SavingsDashboardScreen',
                { tontineUid }
              )
            }
          >
            <Text style={styles.ctaSecondaryText}>Tableau de bord</Text>
          </Pressable>
        </View>

        {unlockReached && (
          <View style={styles.unlockBanner}>
            <Text style={styles.unlockText}>Votre épargne est disponible !</Text>
            <Pressable
              style={styles.unlockBtn}
              onPress={() =>
                (navigation as { navigate: (a: string, b: object) => void }).navigate(
                  'SavingsWithdrawScreen',
                  { tontineUid }
                )
              }
            >
              <Text style={styles.unlockBtnText}>Retirer mes fonds</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  back: { fontSize: 24, color: '#1A6B3C', marginRight: 12 },
  headerTitle: { flex: 1 },
  title: { fontSize: 18, fontWeight: '700', color: '#1C1C1E' },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  statusText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  banner: {
    backgroundColor: '#FEF3C7',
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
  periodHint: { fontSize: 13, color: '#6B7280', marginBottom: 12 },
  cardActions: { gap: 12, marginTop: 12 },
  ctaOrange: {
    height: 52,
    backgroundColor: '#F5A623',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  ctaSecondary: {
    height: 48,
    borderWidth: 1,
    borderColor: '#1A6B3C',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaSecondaryText: { fontSize: 14, fontWeight: '600', color: '#1A6B3C' },
  meta: { fontSize: 14, color: '#6B7280', marginBottom: 8 },
  unlockBanner: {
    backgroundColor: '#DCFCE7',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  unlockText: { fontSize: 14, fontWeight: '600', color: '#1A6B3C', marginBottom: 12 },
  unlockBtn: {
    height: 48,
    backgroundColor: '#1A6B3C',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
