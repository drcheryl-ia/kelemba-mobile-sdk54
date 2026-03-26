/**
 * Point d'entrée tontine Épargne — hub de navigation (données API + cache offline).
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
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '@/navigation/types';
import {
  useSavingsDashboard,
  useMyBalance,
  useJoinSavingsTontine,
  useSavingsPeriods,
} from '@/hooks/useSavings';
import {
  formatFCFA,
  isUnlockReached,
  isPeriodOpen,
  daysUntil,
  frequencyLabel,
} from '@/utils/savings.utils';
import { deriveSavingsDetailStatusKey } from '@/utils/savingsDetailUx';
import { formatDateLong } from '@/utils/formatters';
import { SavingsProgressBar, SavingsScreenHeader, type SavingsStatusChip } from '@/components/savings';
import { useSelector } from 'react-redux';
import { selectUserUid } from '@/store/authSlice';
import type { SavingsPeriodStatus } from '@/types/savings.types';

type Route = RouteProp<RootStackParamList, 'SavingsDetailScreen'>;

function periodStatusLabel(
  s: SavingsPeriodStatus,
  t: (k: string, f: string) => string
): string {
  if (s === 'OPEN') return t('savingsDetail.periodStatusOpen', 'Ouverte');
  if (s === 'CLOSED') return t('savingsDetail.periodStatusClosed', 'Clôturée');
  return t('savingsDetail.periodStatusPending', 'À venir');
}

function shortDate(iso: string): string {
  const d = new Date(`${iso.split('T')[0]}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export const SavingsDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { t } = useTranslation();
  const { tontineUid } = route.params;
  const userUid = useSelector(selectUserUid);

  const {
    data: dashboard,
    isLoading: dashLoading,
    isError: dashError,
    refetch: refetchDash,
    isFetching,
  } = useSavingsDashboard(tontineUid);
  const { data: balance, refetch: refetchBalance } = useMyBalance(tontineUid);
  const { data: periodsRaw, isLoading: periodsLoading } = useSavingsPeriods(tontineUid);
  const periods = Array.isArray(periodsRaw) ? periodsRaw : [];
  const joinMutation = useJoinSavingsTontine(tontineUid);

  const refetchAll = () => {
    void refetchDash();
    void refetchBalance();
  };

  const isMember = dashboard?.members.some((m) => m.userUid === userUid);
  const myMember = dashboard?.members.find((m) => m.userUid === userUid);
  const config = dashboard?.savingsConfig;
  const currentPeriod = dashboard?.currentPeriod ?? balance?.currentPeriod;
  const periodOpen = isPeriodOpen(currentPeriod ?? null);
  const unlockReached = config ? isUnlockReached(config.unlockDate) : false;
  const contributedThisPeriod = myMember?.hasContributedThisPeriod === true;

  const uxStatus = deriveSavingsDetailStatusKey({
    memberStatus: myMember?.status,
    periodOpen,
    contributedThisPeriod,
    unlockReached,
  });

  const statusChipLabel =
    uxStatus === 'SUSPENDED'
      ? t('savingsDetail.statusSuspended', 'Suspendu')
      : uxStatus === 'LATE'
        ? t('savingsDetail.statusLate', 'En retard')
        : uxStatus === 'WITHDRAW_AVAILABLE'
          ? t('savingsDetail.statusWithdrawReady', 'Retrait disponible')
          : t('savingsDetail.statusUpToDate', 'À jour');

  if (dashLoading && !dashboard) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1A6B3C" />
      </View>
    );
  }

  if (dashError || !dashboard) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <SavingsScreenHeader
          title={t('savingsDetail.loadErrorTitle', 'Impossible de charger cette épargne')}
          onBack={() => navigation.goBack()}
          backAccessibilityLabel={t('savingsDetail.backA11y', 'Retour')}
          titleNumberOfLines={2}
        />
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {t('savingsDetail.loadErrorHint', 'Vérifiez la connexion ou réessayez.')}
          </Text>
          <Pressable style={styles.retryBtn} onPress={() => refetchAll()}>
            <Text style={styles.retryBtnText}>{t('savingsDetail.retry', 'Réessayer')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor =
    uxStatus === 'LATE'
      ? '#B45309'
      : uxStatus === 'SUSPENDED'
        ? '#991B1B'
        : uxStatus === 'WITHDRAW_AVAILABLE'
          ? '#1A6B3C'
          : STATUS_COLORS[dashboard.tontine.status] ?? '#9E9E9E';

  const statusChips: SavingsStatusChip[] = [
    { key: 'member', label: statusChipLabel, backgroundColor: statusColor },
    {
      key: 'tontine',
      label: dashboard.tontine.status,
      backgroundColor: '#E5E7EB',
      textColor: '#374151',
    },
  ];

  const personalBalance = balance?.personalBalance ?? 0;
  const targetPerMember = config?.targetAmountPerMember ?? null;

  const nav = navigation as { navigate: (a: string, b: object) => void };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <SavingsScreenHeader
        title={dashboard.tontine.name}
        onBack={() => navigation.goBack()}
        backAccessibilityLabel={t('savingsDetail.backA11y', 'Retour')}
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
        {myMember?.status === 'WITHDRAWN' || myMember?.status === 'EXCLUDED' ? (
          <View style={styles.bannerMuted}>
            <Text style={styles.bannerText}>
              {t('tontineList.savingsInsightLeft', 'Vous ne participez plus à cette épargne.')}
            </Text>
          </View>
        ) : null}

        {dashboard.tontine.status === 'DRAFT' && !isMember && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              {t('savingsDetail.bannerJoin', 'Vous n’avez pas encore rejoint cette tontine')}
            </Text>
            <Pressable
              style={styles.joinBtn}
              onPress={() => joinMutation.mutate()}
              disabled={joinMutation.isPending}
            >
              <Text style={styles.joinBtnText}>{t('savingsDetail.joinCta', 'Rejoindre')}</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('savingsDetail.sectionProgressTitle', 'Aperçu')}</Text>
          <Text style={styles.metaMuted}>{t('savingsDetail.balanceHint', 'Mon épargne actuelle')}</Text>
          <Text style={styles.balanceBig}>{formatFCFA(personalBalance)}</Text>
          <Text style={styles.meta}>{frequencyLabel(dashboard.tontine.frequency)}</Text>
          {targetPerMember != null && targetPerMember > 0 && (
            <SavingsProgressBar
              current={personalBalance}
              target={targetPerMember}
              showLabel
            />
          )}
          {periodOpen && currentPeriod?.closeDate ? (
            <Text style={styles.periodHint}>
              {t('savingsDetail.periodOpenHint', '{{days}} jour(s) restant(s) pour verser dans cette période', {
                days: daysUntil(currentPeriod.closeDate),
              })}
            </Text>
          ) : null}
          <View style={styles.cardActions}>
            {periodOpen && currentPeriod ? (
              <Pressable
                style={styles.ctaOrange}
                onPress={() => {
                  nav.navigate('SavingsContributeScreen', {
                    tontineUid,
                    periodUid: currentPeriod.uid,
                  });
                }}
              >
                <Text style={styles.ctaText}>{t('savingsDetail.ctaContribute', 'Verser maintenant')}</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.ctaSecondary}
              onPress={() => nav.navigate('SavingsBalanceScreen', { tontineUid })}
            >
              <Text style={styles.ctaSecondaryText}>
                {t('savingsDetail.ctaBalance', 'Mon solde et mes versements')}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('savingsDetail.sectionGroupTitle', 'Le groupe')}</Text>
          <Text style={styles.meta}>
            {t('savingsDetail.membersCount', '{{count}} membre(s) actif(s)', {
              count: dashboard.members.length,
            })}
          </Text>
          {config?.targetAmountGlobal != null && dashboard.globalProgressPercent != null && (
            <SavingsProgressBar
              current={(dashboard.globalProgressPercent / 100) * config.targetAmountGlobal}
              target={config.targetAmountGlobal}
              showLabel
            />
          )}
          <Text style={styles.meta}>
            {t('savingsDetail.bonusPool', 'Fonds bonus : {{amount}}', {
              amount: formatFCFA(dashboard.bonusPoolBalance),
            })}
          </Text>
          <Pressable
            style={styles.ctaSecondary}
            onPress={() => nav.navigate('SavingsDashboardScreen', { tontineUid })}
          >
            <Text style={styles.ctaSecondaryText}>
              {t('savingsDetail.ctaDashboard', 'Tableau de bord')}
            </Text>
          </Pressable>
        </View>

        {config != null ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('savingsDetail.sectionRulesTitle', 'Règles')}</Text>
            <Text style={styles.meta}>
              {t('savingsDetail.ruleMin', 'Versement minimum : {{amount}}', {
                amount: formatFCFA(config.minimumContribution),
              })}
            </Text>
            <Text style={styles.meta}>
              {t('savingsDetail.ruleBonus', 'Bonus (%) : {{n}}', { n: config.bonusRatePercent })}
            </Text>
            <Text style={styles.meta}>
              {t('savingsDetail.ruleUnlock', 'Déblocage du capital : {{date}}', {
                date: formatDateLong(config.unlockDate.split('T')[0]),
              })}
            </Text>
            <Text style={styles.meta}>
              {t('savingsDetail.ruleEarlyExit', 'Pénalité sortie anticipée : {{n}} %', {
                n: config.earlyExitPenaltyPercent,
              })}
            </Text>
            <Text style={styles.meta}>
              {config.isPrivate
                ? t('savingsDetail.rulePrivacyOn', 'Soldes individuels masqués pour les autres membres.')
                : t('savingsDetail.rulePrivacyOff', 'Les soldes individuels sont visibles selon les règles du groupe.')}
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('savingsDetail.sectionPeriodsTitle', 'Périodes')}</Text>
          {periodsLoading ? (
            <ActivityIndicator color="#1A6B3C" />
          ) : periods.length === 0 ? (
            <Text style={styles.meta}>{t('savingsDetail.emptyPeriods', 'Aucune période listée pour l’instant.')}</Text>
          ) : (
            periods.map((p) => (
              <Text key={p.uid} style={styles.periodLine}>
                {t('savingsDetail.periodLine', 'P. {{n}} · {{status}} · {{open}} → {{close}}', {
                  n: p.periodNumber,
                  status: periodStatusLabel(p.status, t),
                  open: shortDate(p.openDate),
                  close: shortDate(p.closeDate),
                })}
              </Text>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('savingsDetail.sectionWithdrawTitle', 'Retrait')}</Text>
          <Text style={styles.meta}>{t('savingsDetail.withdrawHint', 'Retrait ou sortie anticipée selon votre situation.')}</Text>
          <Pressable
            style={styles.ctaSecondary}
            onPress={() => nav.navigate('SavingsWithdrawScreen', { tontineUid })}
          >
            <Text style={styles.ctaSecondaryText}>
              {t('savingsDetail.ctaWithdrawShort', 'Voir retrait')}
            </Text>
          </Pressable>
        </View>

        {unlockReached ? (
          <View style={styles.unlockBanner}>
            <Text style={styles.unlockText}>
              {t('savingsDetail.unlockAvailable', 'Votre épargne est disponible !')}
            </Text>
            <Pressable
              style={styles.unlockBtn}
              onPress={() => nav.navigate('SavingsWithdrawScreen', { tontineUid })}
            >
              <Text style={styles.unlockBtnText}>{t('savingsDetail.ctaWithdraw', 'Retirer mes fonds')}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#9E9E9E',
  ACTIVE: '#1A6B3C',
  COMPLETED: '#0055A5',
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
  metaMuted: { fontSize: 12, color: '#9CA3AF', marginBottom: 4 },
  periodLine: { fontSize: 13, color: '#374151', marginBottom: 6 },
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
