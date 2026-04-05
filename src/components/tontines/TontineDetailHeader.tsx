/**
 * En-tête fixe détail tontine — fond vert, KPI strip, onglets.
 */
import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTontineDetails } from '@/hooks/useTontineDetails';
import { KelembaBadge } from '@/components/common/KelembaBadge';
import { COLORS } from '@/theme/colors';
import type { RootStackParamList } from '@/navigation/types';
import type { TontineStatus } from '@/types/tontine';

const STATUS_KEYS: Record<TontineStatus, string> = {
  DRAFT: 'tontineDetails.statusDraft',
  ACTIVE: 'tontineDetails.statusActive',
  BETWEEN_ROUNDS: 'tontineDetails.statusBetweenRounds',
  PAUSED: 'tontineDetails.statusPaused',
  COMPLETED: 'tontineDetails.statusCompleted',
  CANCELLED: 'tontineDetails.statusCancelled',
};

export type TontineDetailTabId =
  | 'dashboard'
  | 'rotation'
  | 'payments'
  | 'members';

export interface TontineDetailHeaderProps {
  uid: string;
  isCreator: boolean;
  activeTab: TontineDetailTabId;
  onTabChange: (tab: TontineDetailTabId) => void;
  kpiCells: { label: string; value: string }[];
  navigation: NativeStackNavigationProp<RootStackParamList, 'TontineDetails'>;
  t: (key: string, fallback?: string) => string;
}

const TABS: { id: TontineDetailTabId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'rotation', label: 'Rotation' },
  { id: 'payments', label: 'Paiements' },
  { id: 'members', label: 'Membres' },
];

export const TontineDetailHeader: React.FC<TontineDetailHeaderProps> = ({
  uid,
  isCreator,
  activeTab,
  onTabChange,
  kpiCells,
  navigation,
  t,
}) => {
  const { tontine } = useTontineDetails(uid);

  const statusLabel = tontine
    ? t(STATUS_KEYS[tontine.status])
    : '—';

  const openMenu = useCallback(() => {
    if (isCreator) {
      Alert.alert('Actions', undefined, [
        {
          text: 'Modifier',
          onPress: () =>
            Alert.alert('Bientôt disponible', 'La modification sera proposée prochainement.'),
        },
        {
          text: 'Inviter un membre',
          onPress: () => {
            if (tontine?.name) {
              navigation.navigate('InviteMembers', {
                tontineUid: uid,
                tontineName: tontine.name,
              });
            }
          },
        },
        {
          text: 'Partager le lien',
          onPress: () => {
            void Share.share({
              message: `Rejoignez la tontine « ${tontine?.name ?? ''} » sur Kelemba.`,
            });
          },
        },
        {
          text: 'Annuler la tontine',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Annuler la tontine',
              'Cette action est irréversible. Contactez le support si besoin.'
            ),
        },
        { text: 'Fermer', style: 'cancel' },
      ]);
    } else {
      Alert.alert('Actions', undefined, [
        {
          text: 'Partager le lien',
          onPress: () => {
            void Share.share({
              message: `Tontine « ${tontine?.name ?? ''} » — Kelemba`,
            });
          },
        },
        {
          text: 'Demander un échange de tour',
          onPress: () => navigation.navigate('SwapRequestScreen', { tontineUid: uid }),
        },
        {
          text: 'Quitter',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Quitter la tontine',
              'Pour confirmer, utilisez les options prévues dans les paramètres du groupe.'
            ),
        },
        { text: 'Fermer', style: 'cancel' },
      ]);
    }
  }, [isCreator, navigation, tontine?.name, uid]);

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.roundBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Retour')}
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.white} />
        </Pressable>
        <View style={styles.titleCenter}>
          <View style={styles.nameBadgeRow}>
            <Text style={styles.tontineName} numberOfLines={1}>
              {tontine?.name ?? '…'}
            </Text>
            {tontine?.status === 'COMPLETED' ? (
              <KelembaBadge variant="completed" label="Terminée" />
            ) : null}
          </View>
          <Text style={styles.statusHint} numberOfLines={1}>
            {statusLabel}
          </Text>
        </View>
        <Pressable
          onPress={openMenu}
          style={styles.roundBtn}
          accessibilityRole="button"
          accessibilityLabel="Menu"
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.white} />
        </Pressable>
      </View>

      <View style={styles.kpiStrip}>
        {kpiCells.slice(0, 4).map((cell, i) => (
          <View
            key={`${cell.label}-${i}`}
            style={[styles.kpiCell, i > 0 && styles.kpiCellSep]}
          >
            <Text style={styles.kpiLabel} numberOfLines={1}>
              {cell.label}
            </Text>
            <Text style={styles.kpiValue} numberOfLines={2}>
              {cell.value}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const sel = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => onTabChange(tab.id)}
              style={[styles.tabBtn, sel && styles.tabBtnSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected: sel }}
            >
              <Text style={[styles.tabText, sel && styles.tabTextSelected]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.primary,
    paddingBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 10,
  },
  roundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCenter: {
    flex: 1,
    minWidth: 0,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'nowrap',
  },
  tontineName: {
    flex: 1,
    minWidth: 0,
    fontSize: 17,
    fontWeight: '500',
    color: COLORS.white,
  },
  statusHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  kpiStrip: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    overflow: 'hidden',
  },
  kpiCell: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  kpiCellSep: {
    borderLeftWidth: 0.5,
    borderLeftColor: COLORS.gray200,
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '500',
    color: COLORS.gray500,
    textAlign: 'center',
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnSelected: {
    backgroundColor: COLORS.white,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  tabTextSelected: {
    color: COLORS.primary,
  },
});
