/**
 * Écran Paiements (onglet) — cotisations + validations espèces (créatrices).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  Platform,
  StatusBar,
  StyleSheet,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { useTontines } from '@/hooks/useTontines';
import { useOrganizerCashPendingBadgeCount } from '@/hooks/useOrganizerCashPending';
import { COLORS } from '@/theme/colors';
import type { MainTabParamList } from '@/navigation/types';
import type { FilterPeriod } from '@/hooks/useContributionHistory';
import { CotisationsTab, type CotisationsMetrics } from '@/screens/payments/CotisationsTab';
import { ValidationsTab, type ValidationsMetrics } from '@/screens/payments/ValidationsTab';
import { PaymentSummaryStrip } from '@/components/payments/PaymentSummaryStrip';
import { CashSummaryStrip } from '@/components/payments/CashSummaryStrip';

type Props = BottomTabScreenProps<MainTabParamList, 'Payments'>;

type TabKey = 'cotisations' | 'validations';

function FunnelIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export const ContributionHistoryScreen: React.FC<Props> = ({
  route,
  navigation,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('cotisations');
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('current_month');
  const [cotMetrics, setCotMetrics] = useState<CotisationsMetrics>({
    paidThisMonth: 0,
    pendingTotal: 0,
    penaltiesThisMonth: 0,
  });
  const [valMetrics, setValMetrics] = useState<ValidationsMetrics>({
    pendingCount: 0,
    approvedThisMonth: 0,
    rejectedThisMonth: 0,
  });

  const { tontines } = useTontines({ includeInvitations: false });
  const cashPendingBadge = useOrganizerCashPendingBadgeCount();

  const isCreator = useMemo(
    () =>
      tontines.some((t) => t.isCreator === true && t.status === 'ACTIVE'),
    [tontines]
  );

  useEffect(() => {
    if (!isCreator && activeTab === 'validations') {
      setActiveTab('cotisations');
    }
  }, [isCreator, activeTab]);

  useFocusEffect(
    useCallback(() => {
      const seg = route.params?.initialSegment;
      if (seg === 'cashValidations' && isCreator) {
        setActiveTab('validations');
        navigation.setParams({ initialSegment: undefined });
      }
    }, [route.params?.initialSegment, isCreator, navigation])
  );

  const openFilterModal = useCallback(() => {
    Alert.alert('Filtrer par période', undefined, [
      { text: 'Ce mois', onPress: () => setFilterPeriod('current_month') },
      {
        text: '3 derniers mois',
        onPress: () => setFilterPeriod('last_3_months'),
      },
      { text: "Tout l'historique", onPress: () => setFilterPeriod('all') },
      { text: 'Annuler', style: 'cancel' },
    ]);
  }, []);

  /** Android : StatusBar + marge · iOS : valeur maquette (notch géré par marge fixe). */
  const padTop =
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 52;

  const onCotMetrics = useCallback((m: CotisationsMetrics) => {
    setCotMetrics(m);
  }, []);

  const onValMetrics = useCallback((m: ValidationsMetrics) => {
    setValMetrics(m);
  }, []);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: padTop }]}>
        <View style={styles.titleRow}>
          <Text style={styles.screenTitle}>Paiements</Text>
          <Pressable
            onPress={openFilterModal}
            style={({ pressed }) => [
              styles.filterBtn,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Filtrer par période"
          >
            <FunnelIcon />
          </Pressable>
        </View>

        {activeTab === 'cotisations' ? (
          <PaymentSummaryStrip
            paidThisMonth={cotMetrics.paidThisMonth}
            pendingTotal={cotMetrics.pendingTotal}
            penaltiesThisMonth={cotMetrics.penaltiesThisMonth}
          />
        ) : (
          <CashSummaryStrip
            pendingCount={valMetrics.pendingCount}
            approvedThisMonth={valMetrics.approvedThisMonth}
            rejectedThisMonth={valMetrics.rejectedThisMonth}
          />
        )}

        {isCreator ? (
          <View style={styles.tabsWrap}>
            <View style={styles.tabsRow}>
              <Pressable
                onPress={() => setActiveTab('cotisations')}
                style={({ pressed }) => [
                  styles.tab,
                  activeTab === 'cotisations' && styles.tabActive,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'cotisations' }}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'cotisations' && styles.tabTextActive,
                  ]}
                >
                  Mes cotisations
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setActiveTab('validations')}
                style={({ pressed }) => [
                  styles.tab,
                  styles.tabValidations,
                  activeTab === 'validations' && styles.tabActive,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'validations' }}
              >
                {cashPendingBadge > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {cashPendingBadge > 99 ? '99+' : cashPendingBadge}
                    </Text>
                  </View>
                ) : null}
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'validations' && styles.tabTextActive,
                  ]}
                >
                  Validations espèces
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.body}>
        {activeTab === 'cotisations' ? (
          <CotisationsTab
            filterPeriod={filterPeriod}
            onMetricsChange={onCotMetrics}
          />
        ) : null}
        {activeTab === 'validations' && isCreator ? (
          <ValidationsTab onMetricsChange={onValMetrics} />
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.gray100 },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: COLORS.white,
  },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsWrap: {
    marginHorizontal: 16,
    marginBottom: 0,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 10,
    padding: 3,
  },
  tab: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  tabValidations: {
    position: 'relative',
  },
  tabActive: {
    backgroundColor: COLORS.white,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    color: 'rgba(255,255,255,0.7)',
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: '#D0021B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '500',
    color: COLORS.white,
  },
  headerSpacer: {
    height: 14,
    backgroundColor: COLORS.primary,
  },
  body: {
    flex: 1,
    backgroundColor: COLORS.gray100,
  },
  pressed: { opacity: 0.9 },
});
