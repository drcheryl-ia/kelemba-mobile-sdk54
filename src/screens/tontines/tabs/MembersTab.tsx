/**
 * Onglet Membres — recherche locale, groupement retard / à jour.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  Pressable,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTontineDetails } from '@/hooks/useTontineDetails';
import { useTontineMembers } from '@/hooks/useTontineMembers';
import { KelembaBadge } from '@/components/common/KelembaBadge';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';
import { hashToColor } from '@/utils/avatarUtils';
import type { RootStackParamList } from '@/navigation/types';
import type { TontineMember } from '@/types/tontine';
export interface MembersTabProps {
  uid: string;
  isCreator: boolean;
}

function memberPaymentBadge(m: TontineMember): {
  variant: 'danger' | 'draft' | 'active';
  label: string;
} {
  const s = String(m.currentCyclePaymentStatus ?? '').toUpperCase();
  if (s === 'COMPLETED' || s === 'PAID') {
    return { variant: 'active', label: 'À jour' };
  }
  if (s === 'OVERDUE' || s === 'PENALIZED') {
    return { variant: 'danger', label: 'Retard' };
  }
  return { variant: 'draft', label: 'Dû' };
}

function roleLabel(m: TontineMember): string {
  return m.memberRole === 'CREATOR' ? 'Organisateur' : 'Membre';
}

export const MembersTab: React.FC<MembersTabProps> = ({ uid, isCreator }) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [q, setQ] = useState('');
  const { tontine, currentCycle, refetch: refetchTontine } = useTontineDetails(uid);
  const { members, refetch: refetchMembers, isLoading } = useTontineMembers(uid);

  const isTontineStarted = currentCycle != null;
  const canInviteLocal =
    isCreator &&
    !isTontineStarted &&
    tontine != null &&
    tontine.status !== 'COMPLETED' &&
    tontine.status !== 'CANCELLED';
  const canInviteEffective =
    canInviteLocal && (tontine?.canInvite !== false);
  const sorted = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? members.filter((m) => m.fullName.toLowerCase().includes(needle))
      : members;
    const overdue: TontineMember[] = [];
    const rest: TontineMember[] = [];
    for (const m of filtered) {
      const st = m.currentCyclePaymentStatus;
      if (st === 'OVERDUE' || st === 'PENALIZED') {
        overdue.push(m);
      } else {
        rest.push(m);
      }
    }
    return [...overdue, ...rest];
  }, [members, q]);

  const totalParts = useMemo(
    () =>
      members.reduce((s, m) => s + (m.membershipStatus === 'ACTIVE' ? m.sharesCount : 0), 0),
    [members]
  );
  const activeCount = useMemo(
    () => members.filter((m) => m.membershipStatus === 'ACTIVE').length,
    [members]
  );
  const lateCount = useMemo(
    () =>
      members.filter(
        (m) =>
          m.currentCyclePaymentStatus === 'OVERDUE' ||
          m.currentCyclePaymentStatus === 'PENALIZED'
      ).length,
    [members]
  );

  const onMemberMenu = useCallback(
    (m: TontineMember) => {
      if (!isCreator) return;
      Alert.alert(m.fullName, undefined, [
        {
          text: 'Valider paiement espèces',
          onPress: () =>
            navigation.navigate('MainTabs', {
              screen: 'Payments',
              params: { initialSegment: 'cashValidations' },
            }),
        },
        {
          text: 'Envoyer rappel',
          onPress: () => Alert.alert('Rappel', 'Fonctionnalité à venir.'),
        },
        {
          text: 'Exclure',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Exclusion', 'Action réservée au flux métier prévu.'),
        },
        { text: 'Annuler', style: 'cancel' },
      ]);
    },
    [isCreator, navigation]
  );

  const renderItem = useCallback(
    ({ item }: { item: TontineMember }) => {
      const initials = item.fullName
        .split(/\s+/)
        .filter(Boolean)
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
      const badge = memberPaymentBadge(item);
      return (
        <Pressable
          style={styles.row}
          onLongPress={() => onMemberMenu(item)}
          delayLongPress={400}
        >
          <View style={[styles.av, { backgroundColor: hashToColor(item.fullName) }]}>
            <Text style={styles.avTxt}>{initials || '?'}</Text>
          </View>
          <View style={styles.mid}>
            <Text style={styles.name}>{item.fullName}</Text>
            <Text style={styles.meta}>
              {roleLabel(item)} · {item.sharesCount} part(s) · Score {item.kelembScore}
            </Text>
          </View>
          <KelembaBadge variant={badge.variant} label={badge.label} size="sm" />
        </Pressable>
      );
    },
    [onMemberMenu]
  );

  return (
    <View style={styles.flex}>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Rechercher un membre…"
        placeholderTextColor={COLORS.gray500}
        style={styles.search}
      />
      <FlatList
        data={sorted}
        keyExtractor={(m) => m.uid}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && members.length === 0}
            onRefresh={() => {
              void refetchTontine();
              void refetchMembers();
            }}
            tintColor={COLORS.primary}
          />
        }
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.hint}>
            {activeCount} actifs · {totalParts} parts · {lateCount} en retard
          </Text>
        }
      />
      {isCreator &&
      tontine &&
      (tontine.status === 'ACTIVE' || tontine.status === 'DRAFT') ? (
        <Pressable
          style={[
            styles.inviteBtn,
            !canInviteEffective ? styles.inviteBtnLocked : null,
          ]}
          onPress={() => {
            if (!canInviteEffective) {
              Alert.alert(
                'Invitations fermées',
                'Les invitations sont possibles uniquement avant le démarrage des cycles. La tontine est déjà en cours.',
                [{ text: 'Compris' }]
              );
              return;
            }
            navigation.navigate('InviteMembers', {
              tontineUid: uid,
              tontineName: tontine.name,
            });
          }}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canInviteEffective }}
        >
          <View style={styles.inviteRow}>
            {!canInviteEffective ? (
              <Ionicons
                name="lock-closed"
                size={18}
                color={COLORS.gray500}
                style={styles.inviteLock}
              />
            ) : null}
            <Text
              style={[
                styles.inviteTxt,
                !canInviteEffective ? styles.inviteTxtLocked : null,
              ]}
            >
              {!canInviteEffective
                ? 'Inviter (tontine démarrée)'
                : 'Inviter un membre'}
            </Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    height: 36,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    paddingHorizontal: 12,
    backgroundColor: COLORS.white,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  hint: {
    fontSize: 11,
    color: COLORS.gray500,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
  },
  av: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avTxt: { fontSize: 11, fontWeight: '600', color: COLORS.white },
  mid: { flex: 1, minWidth: 0 },
  name: { fontSize: 12, fontWeight: '600', color: COLORS.textPrimary },
  meta: { fontSize: 10, color: COLORS.gray500, marginTop: 2 },
  inviteBtn: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: COLORS.primary,
  },
  inviteBtnLocked: {
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray200,
    opacity: 0.6,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  inviteLock: { marginRight: 0 },
  inviteTxt: { color: COLORS.white, fontWeight: '600', fontSize: 15 },
  inviteTxtLocked: { color: COLORS.gray500 },
});
