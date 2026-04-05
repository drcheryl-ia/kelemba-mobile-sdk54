/**
 * Étape 2 — ordre de rotation (↑↓) puis activation (réordonner + cycles).
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTontineDetails } from '@/hooks/useTontineDetails';
import { useTontineMembers } from '@/hooks/useTontineMembers';
import {
  useShuffleRotation,
  useReorderRotation,
} from '@/hooks/useTontineRotationActions';
import { getTontineMembers, getTontineRotation, initializeCycles } from '@/api/tontinesApi';
import { parseApiError } from '@/api/errors/errorHandler';
import { logger } from '@/utils/logger';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';
import { formatFcfa } from '@/utils/formatters';
import type { TontineMember } from '@/types/tontine';
import type { RootStackParamList } from '@/navigation/types';
import { FormWarnBanner } from '@/components/create-tontine/FormInfoBanner';

export interface OrderStepProps {
  tontineUid: string;
  onPrev: () => void;
}

function sortMembersByRotation(members: TontineMember[]): TontineMember[] {
  return [...members].sort(
    (a, b) => (a.rotationOrder ?? 0) - (b.rotationOrder ?? 0)
  );
}

function slotRangeLabel(
  startSlot: number,
  shares: number
): string {
  if (shares <= 1) {
    return `Tour ${startSlot}`;
  }
  const end = startSlot + shares - 1;
  return `Tours ${startSlot}–${end}`;
}

export const OrderStep: React.FC<OrderStepProps> = ({ tontineUid, onPrev }) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const { tontine } = useTontineDetails(tontineUid);
  const { members, isLoading } = useTontineMembers(tontineUid);

  const shuffleMutation = useShuffleRotation(tontineUid);
  const reorderMutation = useReorderRotation(tontineUid);

  useQuery({
    queryKey: ['tontineRotation', tontineUid],
    queryFn: () => getTontineRotation(tontineUid),
    enabled: tontineUid.length > 0,
    staleTime: 60_000,
  });

  const [memberOrder, setMemberOrder] = useState<TontineMember[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeMembers = useMemo(
    () => members.filter((m) => m.membershipStatus === 'ACTIVE'),
    [members]
  );

  const memberIds = useMemo(
    () => [...activeMembers.map((m) => m.uid)].sort().join(','),
    [activeMembers]
  );

  useEffect(() => {
    if (activeMembers.length === 0 || memberIds.length === 0) return;
    setMemberOrder(sortMembersByRotation(activeMembers));
    // Intentionnel : ne pas dépendre de `activeMembers` pour préserver l'ordre local (↑↓).
  }, [memberIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalSlots = useMemo(
    () =>
      memberOrder.reduce(
        (s, m) => s + Math.max(1, m.sharesCount ?? 1),
        0
      ),
    [memberOrder]
  );

  const amountPerShare = tontine?.amountPerShare ?? 0;
  const memberCount = memberOrder.length;

  const moveUp = useCallback((index: number) => {
    if (index <= 0) return;
    setMemberOrder((prev) => {
      const next = [...prev];
      const t = next[index - 1];
      next[index - 1] = next[index]!;
      next[index] = t!;
      return next;
    });
  }, []);

  const moveDown = useCallback((index: number) => {
    setMemberOrder((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      const t = next[index + 1];
      next[index + 1] = next[index]!;
      next[index] = t!;
      return next;
    });
  }, []);

  const handleShuffle = useCallback(async () => {
    try {
      await shuffleMutation.mutateAsync();
      const fresh = await queryClient.fetchQuery({
        queryKey: ['members', tontineUid],
        queryFn: () => getTontineMembers(tontineUid),
      });
      const act = fresh.filter(
        (m: TontineMember) => m.membershipStatus === 'ACTIVE'
      );
      setMemberOrder(sortMembersByRotation(act));
    } catch (err: unknown) {
      logger.error('[OrderStep] shuffle', err);
      const apiErr = parseApiError(err);
      Alert.alert('Erreur', apiErr.message ?? 'Tirage impossible. Réessayez.');
    }
  }, [shuffleMutation, queryClient, tontineUid]);

  const handleActivate = useCallback(async () => {
    if (memberOrder.length < 2) {
      Alert.alert(
        'Erreur',
        'Au moins 2 membres actifs sont requis pour activer la tontine.'
      );
      return;
    }
    setIsSubmitting(true);
    try {
      const orderedSlotMembershipUids = memberOrder.flatMap((m) =>
        Array(Math.max(1, m.sharesCount ?? 1)).fill(m.uid)
      );
      await reorderMutation.mutateAsync({ orderedSlotMembershipUids });
      await initializeCycles(tontineUid);

      await queryClient.invalidateQueries({ queryKey: ['tontines'] });
      await queryClient.invalidateQueries({ queryKey: ['nextPayment'] });
      await queryClient.invalidateQueries({ queryKey: ['tontines', 'active'] });
      await queryClient.invalidateQueries({ queryKey: ['payments', 'pending'] });
      await queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
      await queryClient.invalidateQueries({ queryKey: ['score', 'me'] });
      await queryClient.invalidateQueries({ queryKey: ['tontine', tontineUid] });
      await queryClient.invalidateQueries({ queryKey: ['members', tontineUid] });
      await queryClient.invalidateQueries({
        queryKey: ['cycle', 'current', tontineUid],
      });
      await queryClient.invalidateQueries({
        queryKey: ['report', tontineUid],
      });
      await queryClient.invalidateQueries({
        queryKey: ['tontineRotation', tontineUid],
      });

      navigation.replace('TontineDetails', {
        tontineUid,
        isCreator: true,
        tab: 'dashboard',
      });
    } catch (err: unknown) {
      logger.error('[OrderStep] activation', err);
      Alert.alert(
        "Erreur d'activation",
        "L'activation a échoué. Vérifiez que tous les membres sont actifs et réessayez.",
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [memberOrder, navigation, queryClient, reorderMutation, tontineUid]);

  if (isLoading || !tontine) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.block}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Ordre des membres (↑ ↓)</Text>
          <Pressable
            onPress={() => void handleShuffle()}
            disabled={shuffleMutation.isPending || isSubmitting}
            style={styles.shuffleBtn}
            accessibilityRole="button"
            accessibilityLabel="Tirage aléatoire"
          >
            {shuffleMutation.isPending ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={styles.shuffleTxt}>Tirage aléatoire</Text>
            )}
          </Pressable>
        </View>

        {memberOrder.map((m, index) => {
          const shares = Math.max(1, m.sharesCount ?? 1);
          const startSlot =
            memberOrder
              .slice(0, index)
              .reduce((acc, x) => acc + Math.max(1, x.sharesCount ?? 1), 0) + 1;
          const slotLabel = slotRangeLabel(startSlot, shares);

          return (
            <View key={m.uid} style={styles.row}>
              <Text style={styles.handle} accessibilityElementsHidden>
                ⋮⋮
              </Text>
              <View style={styles.posBadge}>
                <Text style={styles.posTxt}>{startSlot}</Text>
              </View>
              <View style={styles.mid}>
                <Text style={styles.name} numberOfLines={1}>
                  {m.fullName}
                  {shares > 1 ? (
                    <Text style={styles.sharesHint}>
                      {' '}
                      (×{shares})
                    </Text>
                  ) : null}
                </Text>
                <Text style={styles.slotInfo}>{slotLabel}</Text>
              </View>
              <View style={styles.arrows}>
                <Pressable
                  onPress={() => moveUp(index)}
                  disabled={index === 0 || isSubmitting}
                  style={[
                    styles.arrowBtn,
                    index === 0 && styles.arrowBtnOff,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Monter"
                >
                  <Ionicons
                    name="chevron-up"
                    size={18}
                    color={index === 0 ? COLORS.gray500 : COLORS.primary}
                  />
                </Pressable>
                <Pressable
                  onPress={() => moveDown(index)}
                  disabled={index >= memberOrder.length - 1 || isSubmitting}
                  style={[
                    styles.arrowBtn,
                    index >= memberOrder.length - 1 && styles.arrowBtnOff,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Descendre"
                >
                  <Ionicons
                    name="chevron-down"
                    size={18}
                    color={
                      index >= memberOrder.length - 1
                        ? COLORS.gray500
                        : COLORS.primary
                    }
                  />
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

      <FormWarnBanner message="Rappel : ordre modifiable une seule fois après démarrage. Les membres multi-parts occupent des slots consécutifs." />

      <Pressable onPress={onPrev} style={styles.backLink} accessibilityRole="button">
        <Text style={styles.backLinkTxt}>← Retour aux parts</Text>
      </Pressable>

      <Pressable
        onPress={() => void handleActivate()}
        disabled={isSubmitting || memberOrder.length < 2}
        style={[
          styles.activateBtn,
          (isSubmitting || memberOrder.length < 2) && styles.activateBtnDisabled,
        ]}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#1A5C38" />
        ) : (
          <Text style={styles.activateTxt}>Activer la tontine</Text>
        )}
      </Pressable>

      <Text style={styles.footerHint}>
        {totalSlots} cycles · {formatFcfa(totalSlots * amountPerShare)} / cagnotte ·{' '}
        {memberCount} membres
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  block: { gap: 14 },
  centered: { padding: 24, alignItems: 'center' },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  shuffleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
  },
  shuffleTxt: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.gray100,
    gap: 6,
  },
  handle: {
    fontSize: 12,
    color: COLORS.gray200,
    width: 16,
    textAlign: 'center',
  },
  posBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posTxt: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },
  mid: { flex: 1, minWidth: 0 },
  name: { fontSize: 13, fontWeight: '500', color: COLORS.textPrimary },
  sharesHint: { fontSize: 10, color: COLORS.gray500, fontWeight: '400' },
  slotInfo: { fontSize: 11, color: COLORS.gray500, marginTop: 2 },
  arrows: { gap: 2 },
  arrowBtn: { padding: 2 },
  arrowBtnOff: { opacity: 0.35 },
  backLink: { alignSelf: 'flex-start', paddingVertical: 4 },
  backLinkTxt: { fontSize: 13, color: COLORS.primary, fontWeight: '500' },
  activateBtn: {
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  activateBtnDisabled: { opacity: 0.65 },
  activateTxt: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A5C38',
  },
  footerHint: {
    marginTop: 8,
    fontSize: 11,
    color: COLORS.gray500,
    textAlign: 'center',
  },
});
