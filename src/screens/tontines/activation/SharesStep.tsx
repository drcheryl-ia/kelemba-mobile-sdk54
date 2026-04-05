/**
 * Étape 1 — ajustement des parts (persistées au passage à l'étape 2).
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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FormWarnBanner } from '@/components/create-tontine/FormInfoBanner';
import { useTontineDetails } from '@/hooks/useTontineDetails';
import { useTontineMembers } from '@/hooks/useTontineMembers';
import { updateMemberShares } from '@/api/tontinesApi';
import { parseApiError } from '@/api/errors/errorHandler';
import { logger } from '@/utils/logger';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';
import { formatFcfa } from '@/utils/formatters';
import { getInitials, hashToColor } from '@/utils/avatarUtils';
import type { TontineMember } from '@/types/tontine';

export interface SharesStepProps {
  tontineUid: string;
  onNext: () => void;
}

const SHARES_MIN = 1;
const SHARES_MAX = 5;

export const SharesStep: React.FC<SharesStepProps> = ({ tontineUid, onNext }) => {
  const queryClient = useQueryClient();
  const { tontine } = useTontineDetails(tontineUid);
  const { members, isLoading: membersLoading } = useTontineMembers(tontineUid);

  const activeMembers = useMemo(
    () => members.filter((m) => m.membershipStatus === 'ACTIVE'),
    [members]
  );

  const [sharesMap, setSharesMap] = useState<Record<string, number>>({});

  useEffect(() => {
    if (activeMembers.length === 0) return;
    setSharesMap((prev) => {
      const next: Record<string, number> = { ...prev };
      for (const m of activeMembers) {
        if (next[m.uid] == null) {
          next[m.uid] = Math.max(
            SHARES_MIN,
            Math.min(SHARES_MAX, m.sharesCount ?? 1)
          );
        }
      }
      return next;
    });
  }, [activeMembers]);

  const totalShares = useMemo(
    () =>
      activeMembers.reduce((s, m) => {
        const v = sharesMap[m.uid] ?? m.sharesCount ?? 1;
        return s + v;
      }, 0),
    [activeMembers, sharesMap]
  );

  const updateMutation = useMutation({
    mutationFn: async (vars: { memberUid: string; sharesCount: number }) => {
      await updateMemberShares(tontineUid, vars.memberUid, vars.sharesCount);
    },
  });

  const handleNext = useCallback(async () => {
    const changed = activeMembers.filter((m) => {
      const local = sharesMap[m.uid] ?? m.sharesCount ?? 1;
      return (m.sharesCount ?? 1) !== local;
    });
    try {
      for (const m of changed) {
        await updateMutation.mutateAsync({
          memberUid: m.uid,
          sharesCount: sharesMap[m.uid] ?? m.sharesCount ?? 1,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['members', tontineUid] });
      await queryClient.invalidateQueries({ queryKey: ['tontine', tontineUid] });
      onNext();
    } catch (err: unknown) {
      logger.error('[SharesStep] save shares', err);
      const apiErr = parseApiError(err);
      Alert.alert('Erreur', apiErr.message ?? 'Impossible de sauvegarder les parts.');
    }
  }, [
    activeMembers,
    sharesMap,
    tontineUid,
    updateMutation,
    queryClient,
    onNext,
  ]);

  const setShares = useCallback((m: TontineMember, v: number) => {
    const clamped = Math.max(SHARES_MIN, Math.min(SHARES_MAX, v));
    setSharesMap((prev) => ({ ...prev, [m.uid]: clamped }));
  }, []);

  if (membersLoading || !tontine) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  const amountPerShare = tontine.amountPerShare;
  const cagnotte = totalShares * amountPerShare;

  return (
    <View style={styles.block}>
      <FormWarnBanner message="Ajustez les parts avant activation. Modification impossible après démarrage." />

      <View style={styles.card}>
        <Text style={styles.cardHead}>
          {activeMembers.length} membres · {totalShares} parts au total
        </Text>
        <Text style={styles.cardSub}>{formatFcfa(amountPerShare)} / part</Text>

        {activeMembers.map((m) => {
          const shares = sharesMap[m.uid] ?? m.sharesCount ?? 1;
          const isCreator = m.memberRole === 'CREATOR';
          const minusDisabled =
            shares <= SHARES_MIN || updateMutation.isPending;
          const plusDisabled = shares >= SHARES_MAX || updateMutation.isPending;

          return (
            <View key={m.uid} style={styles.row}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: hashToColor(m.fullName) },
                ]}
              >
                <Text style={styles.avatarTxt}>{getInitials(m.fullName)}</Text>
              </View>
              <View style={styles.mid}>
                <Text style={styles.name}>{m.fullName}</Text>
                {isCreator ? (
                  <Text style={styles.creatorHint}>(Créatrice)</Text>
                ) : null}
              </View>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => setShares(m, shares - 1)}
                  disabled={minusDisabled}
                  style={[
                    styles.stepBtn,
                    minusDisabled && styles.stepBtnDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Moins une part"
                >
                  <Text style={styles.stepBtnTxt}>−</Text>
                </Pressable>
                <Text style={styles.sharesVal}>{shares}</Text>
                <Pressable
                  onPress={() => setShares(m, shares + 1)}
                  disabled={plusDisabled}
                  style={[
                    styles.stepBtn,
                    plusDisabled && styles.stepBtnDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Plus une part"
                >
                  <Text style={styles.stepBtnTxt}>+</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.recap}>
        <View style={styles.recapRow}>
          <Text style={styles.recapLbl}>Cagnotte par cycle</Text>
          <Text style={styles.recapVal}>{formatFcfa(cagnotte)}</Text>
        </View>
        <View style={styles.recapRow}>
          <Text style={styles.recapLbl}>Cycles totaux</Text>
          <Text style={styles.recapVal}>{String(totalShares)}</Text>
        </View>
      </View>

      <Pressable
        onPress={() => void handleNext()}
        disabled={updateMutation.isPending || activeMembers.length < 2}
        style={[
          styles.nextBtn,
          (updateMutation.isPending || activeMembers.length < 2) &&
            styles.nextBtnDisabled,
        ]}
      >
        {updateMutation.isPending ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <Text style={styles.nextTxt}>Suivant — Définir l'ordre →</Text>
        )}
      </Pressable>
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
  cardHead: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  cardSub: {
    fontSize: 12,
    color: COLORS.gray500,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.gray100,
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { fontSize: 11, fontWeight: '600', color: COLORS.white },
  mid: { flex: 1, minWidth: 0 },
  name: { fontSize: 13, fontWeight: '500', color: COLORS.textPrimary },
  creatorHint: { fontSize: 10, color: COLORS.gray500, marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.4 },
  stepBtnTxt: { fontSize: 16, fontWeight: '600', color: COLORS.primaryDark },
  sharesVal: {
    fontSize: 13,
    fontWeight: '500',
    minWidth: 16,
    textAlign: 'center',
    color: COLORS.textPrimary,
  },
  recap: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  recapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recapLbl: { fontSize: 13, color: COLORS.primaryDark },
  recapVal: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  nextBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextBtnDisabled: { opacity: 0.6 },
  nextTxt: { color: COLORS.white, fontSize: 15, fontWeight: '600' },
});
