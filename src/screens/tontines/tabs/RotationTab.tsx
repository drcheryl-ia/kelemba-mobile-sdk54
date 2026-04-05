/**
 * Onglet Rotation — timeline cycles (displayStatus = source API via hook).
 */
import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTontineDetails } from '@/hooks/useTontineDetails';
import { useTontineRotation } from '@/hooks/useTontineRotation';
import type { CycleDisplayStatus, RotationCycle } from '@/types/rotation';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';
import { formatFcfaAmount } from '@/utils/formatters';
import type { RootStackParamList } from '@/navigation/types';

export interface RotationTabProps {
  uid: string;
  isCreator: boolean;
}

const BADGE: Record<
  CycleDisplayStatus,
  { bg: string; fg: string; label: string }
> = {
  VERSÉ: {
    bg: COLORS.primaryLight,
    fg: COLORS.primaryDark,
    label: 'Versé',
  },
  EN_COURS: {
    bg: COLORS.danger,
    fg: COLORS.white,
    label: 'En cours',
  },
  RETARDÉ: {
    bg: COLORS.dangerLight,
    fg: COLORS.dangerText,
    label: 'Retardé',
  },
  PROCHAIN: {
    bg: COLORS.accentLight,
    fg: COLORS.accentDark,
    label: 'Prochain',
  },
  À_VENIR: {
    bg: COLORS.gray100,
    fg: COLORS.gray500,
    label: 'À venir',
  },
};

function circleStyle(ds: CycleDisplayStatus): { bg: string; fg: string } {
  switch (ds) {
    case 'VERSÉ':
      return { bg: COLORS.primaryLight, fg: COLORS.primaryDark };
    case 'EN_COURS':
    case 'RETARDÉ':
      return { bg: COLORS.danger, fg: COLORS.white };
    case 'PROCHAIN':
      return { bg: COLORS.accent, fg: COLORS.white };
    case 'À_VENIR':
    default:
      return { bg: COLORS.gray200, fg: COLORS.gray700 };
  }
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
  }).format(d);
}

export const RotationTab: React.FC<RotationTabProps> = ({ uid, isCreator }) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { tontine, refetch: refetchTontine } = useTontineDetails(uid);
  const rotationEnabled = Boolean(tontine && tontine.status !== 'DRAFT');
  const {
    rotationList,
    totalAmount: rotationTotalAmount,
    isLoading,
    isError,
    refetch: refetchRotation,
  } = useTontineRotation(uid, { enabled: rotationEnabled });

  const onRefresh = useCallback(() => {
    void refetchTontine();
    if (rotationEnabled) void refetchRotation();
  }, [refetchTontine, refetchRotation, rotationEnabled]);

  const completedCount = useMemo(
    () => rotationList.filter((c) => c.displayStatus === 'VERSÉ').length,
    [rotationList]
  );

  if (!tontine) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.inner}
      refreshControl={
        <RefreshControl
          refreshing={isLoading && rotationList.length === 0}
          onRefresh={onRefresh}
          tintColor={COLORS.primary}
        />
      }
    >
      {isCreator && tontine.status === 'BETWEEN_ROUNDS' ? (
        <Pressable
          style={styles.launchBtn}
          onPress={() =>
            navigation.navigate('RotationReorderScreen', { tontineUid: uid })
          }
        >
          <Text style={styles.launchBtnText}>Lancer la prochaine rotation</Text>
        </Pressable>
      ) : null}

      {isError ? (
        <Text style={styles.err}>Impossible de charger la rotation.</Text>
      ) : null}

      {!rotationEnabled ? (
        <Text style={styles.muted}>
          La rotation sera disponible après le démarrage de la tontine.
        </Text>
      ) : isLoading && rotationList.length === 0 ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} />
      ) : (
        rotationList.map((item, index) => (
          <TimelineRow
            key={item.uid}
            item={item}
            index={index}
            total={rotationList.length}
          />
        ))
      )}

      {rotationList.length > 0 ? (
        <View style={styles.summary}>
          <Text style={styles.muted}>
            Cagnotte indicative : {formatFcfaAmount(Math.round(rotationTotalAmount))}{' '}
            FCFA · {completedCount} cycle(s) complété(s) sur {rotationList.length}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
};

function TimelineRow(props: {
  item: RotationCycle;
  index: number;
  total: number;
}): React.ReactElement {
  const { item, index, total } = props;
  const ds = item.displayStatus;
  const cc = circleStyle(ds);
  const badge = BADGE[ds] ?? BADGE.À_VENIR;
  const showLine = index < total - 1;

  const isEnCours = ds === 'EN_COURS';
  const beneficiaryHighlight = item.isCurrentUserBeneficiary;

  return (
    <View style={styles.rowWrap}>
      <View style={styles.rowInner}>
        <View style={styles.leftCol}>
          {showLine ? <View style={styles.vline} /> : null}
          <View style={[styles.circle, { backgroundColor: cc.bg }]}>
            <Text style={[styles.circleNum, { color: cc.fg }]}>
              {item.cycleNumber}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.content,
            isEnCours && styles.boxDanger,
            beneficiaryHighlight && !isEnCours && styles.boxAccent,
          ]}
        >
          <View style={styles.contentTop}>
            <View style={styles.flex1}>
              <Text style={styles.benName}>
                {item.beneficiaryName}
                {item.isCurrentUserBeneficiary ? (
                  <Text style={styles.youSuffix}> ← Vous</Text>
                ) : null}
              </Text>
              <Text style={styles.dateTxt}>
                {formatShortDate(item.expectedDate)}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.badgeTxt, { color: badge.fg }]}>
                {badge.label}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  inner: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  launchBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  launchBtnText: { color: COLORS.white, fontWeight: '600', fontSize: 15 },
  err: { color: COLORS.danger, marginBottom: 8 },
  muted: { fontSize: 13, color: COLORS.gray500, lineHeight: 18 },
  summary: { marginTop: 16 },
  rowWrap: { marginBottom: 0 },
  rowInner: {
    flexDirection: 'row',
    position: 'relative',
    paddingVertical: 7,
  },
  leftCol: {
    width: 44,
    alignItems: 'center',
  },
  vline: {
    position: 'absolute',
    left: 14,
    top: 32,
    bottom: -7,
    width: 1,
    backgroundColor: COLORS.gray200,
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  circleNum: { fontSize: 11, fontWeight: '700' },
  content: {
    flex: 1,
    marginLeft: 10,
    marginRight: 0,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  boxDanger: {
    backgroundColor: COLORS.dangerLight,
    borderColor: COLORS.danger,
    marginHorizontal: -2,
    paddingVertical: 7,
    paddingHorizontal: 6,
  },
  boxAccent: {
    backgroundColor: COLORS.accentLight,
    borderColor: COLORS.accent,
  },
  contentTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  flex1: { flex: 1, minWidth: 0 },
  benName: { fontSize: 12, fontWeight: '500', color: COLORS.textPrimary },
  youSuffix: { color: COLORS.accent, fontWeight: '600' },
  dateTxt: { fontSize: 11, color: COLORS.gray500, marginTop: 2 },
  badge: {
    borderRadius: 20,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  badgeTxt: { fontSize: 9, fontWeight: '500' },
});
