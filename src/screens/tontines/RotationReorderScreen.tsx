/**
 * Écran — réordonnancement manuel de la rotation (drag-and-drop par slot).
 *
 * Chaque slot représente un tour de versement de la cagnotte.
 * Un membre avec N parts apparaît N fois dans la liste :
 *   - tour 1 → Marie (part 1/2)
 *   - tour 2 → Jean  (part 1/1)
 *   - tour 3 → Marie (part 2/2)
 *
 * L'envoi au backend utilise exclusivement orderedSlotMembershipUids
 * (tableau des membership UIDs dans l'ordre des tours, avec répétitions).
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, {
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useTontineMembers } from '@/hooks/useTontineMembers';
import { useReorderRotation } from '@/hooks/useTontineRotationActions';
import { parseApiError } from '@/api/errors/errorHandler';
import { getInitials, hashToColor } from '@/utils/avatarUtils';
import type { TontineMember } from '@/types/tontine';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Un slot = un tour de cagnotte.
 * Chaque membre génère autant de slots que de parts détenues.
 */
interface RotationSlot {
  /** Clé unique pour FlatList — membership uid + index de la part */
  key: string;
  /** UID du membership (répété pour les multi-parts) */
  membershipUid: string;
  /** Données du membre pour l'affichage */
  member: TontineMember;
  /** Numéro de cette part parmi toutes les parts du membre (1-based) */
  shareIndex: number;
  /** Nombre total de parts du membre */
  totalShares: number;
}

type Props = NativeStackScreenProps<RootStackParamList, 'RotationReorderScreen'>;

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Transforme la liste de membres en liste de slots draggables.
 * L'ordre initial respecte le rotationOrder du serveur.
 */
function membersToSlots(members: TontineMember[]): RotationSlot[] {
  const sorted = [...members].sort(
    (a, b) => (a.rotationOrder ?? 0) - (b.rotationOrder ?? 0)
  );

  const slots: RotationSlot[] = [];
  for (const member of sorted) {
    const count = Math.max(1, member.sharesCount ?? 1);
    for (let i = 0; i < count; i++) {
      slots.push({
        key: `${member.uid}-${i}`,
        membershipUid: member.uid,
        member,
        shareIndex: i + 1,
        totalShares: count,
      });
    }
  }
  return slots;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const RotationReorderScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const { tontineUid } = route.params;
  const { t } = useTranslation();

  const { members, isLoading } = useTontineMembers(tontineUid);
  const reorderMutation = useReorderRotation(tontineUid);

  // Membres actifs uniquement (pas les LEFT/EXPELLED)
  const activeMembers = useMemo(
    () =>
      members.filter(
        (m) =>
          m.membershipStatus !== 'LEFT' && m.membershipStatus !== 'EXPELLED'
      ),
    [members]
  );

  const [slots, setSlots] = useState<RotationSlot[]>([]);

  // Sync depuis le serveur (seulement si les UIDs changent)
  const memberKey = activeMembers.map((m) => m.uid).join(',');
  useEffect(() => {
    setSlots(membersToSlots(activeMembers));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberKey]);

  const handleDragEnd = useCallback(
    ({ data }: { data: RotationSlot[] }) => {
      setSlots(data);
    },
    []
  );

  const handleSave = useCallback(() => {
    if (slots.length < 2) {
      Alert.alert(
        t('common.error', 'Erreur'),
        t('rotationReorder.minMembers', 'Au moins 2 slots requis.')
      );
      return;
    }

    // orderedSlotMembershipUids = membership UID dans l'ordre des tours,
    // avec répétitions pour les membres multi-parts.
    const orderedSlotMembershipUids = slots.map((s) => s.membershipUid);

    reorderMutation.mutate(
      { orderedSlotMembershipUids },
      {
        onSuccess: () => {
          Alert.alert(
            t('rotationReorder.successTitle', 'Ordre mis à jour'),
            t(
              'rotationReorder.successMessage',
              "L'ordre de rotation a été enregistré."
            ),
            [{ text: t('common.ok', 'OK'), onPress: () => navigation.goBack() }]
          );
        },
        onError: (err: unknown) => {
          const apiErr = parseApiError(err);
          Alert.alert(
            t('common.error', 'Erreur'),
            apiErr.httpStatus === 400
              ? apiErr.message
              : t('register.errorNetwork', 'Vérifiez votre connexion et réessayez.')
          );
        },
      }
    );
  }, [slots, reorderMutation, navigation, t]);

  // ── Rendu d'un slot ─────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item, drag, isActive, getIndex }: RenderItemParams<RotationSlot>) => {
      const tourNumber = (getIndex?.() ?? 0) + 1;
      const isMultiPart = item.totalShares > 1;
      const isOrganizer = item.member.memberRole === 'CREATOR';

      return (
        <Pressable
          onLongPress={drag}
          disabled={reorderMutation.isPending}
          style={[styles.slotRow, isActive && styles.slotRowActive]}
        >
          {/* Numéro du tour */}
          <View style={styles.tourBadge}>
            <Text style={styles.tourNumber}>{tourNumber}</Text>
          </View>

          {/* Avatar */}
          <View
            style={[
              styles.avatar,
              { backgroundColor: hashToColor(item.member.fullName) },
            ]}
          >
            <Text style={styles.avatarText}>
              {getInitials(item.member.fullName)}
            </Text>
          </View>

          {/* Infos membre */}
          <View style={styles.memberInfo}>
            <Text style={styles.memberName} numberOfLines={1}>
              {item.member.fullName}
            </Text>
            <View style={styles.metaRow}>
              {isOrganizer && (
                <View style={[styles.pill, styles.pillOrganizer]}>
                  <Text style={styles.pillText}>Organisateur</Text>
                </View>
              )}
              {isMultiPart && (
                <View style={[styles.pill, styles.pillShare]}>
                  <Text style={styles.pillText}>
                    Part {item.shareIndex}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Handle drag */}
          <Ionicons name="reorder-three" size={26} color="#9CA3AF" />
        </Pressable>
      );
    },
    [reorderMutation.isPending]
  );

  // ── Chargement ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color="#1A6B3C" />
          </Pressable>
          <Text style={styles.headerTitle}>
            {t('rotationReorder.title', "Modifier l'ordre")}
          </Text>
        </View>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#1A6B3C" />
        </View>
      </SafeAreaView>
    );
  }

  // ── Rendu principal ───────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color="#1A6B3C" />
        </Pressable>
        <Text style={styles.headerTitle}>
          {t('rotationReorder.title', 'Ordre de rotation')}
        </Text>
      </View>

      {/* Explication */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle-outline" size={17} color="#92400E" />
        <Text style={styles.infoBannerText}>
          {t(
            'rotationReorder.hint',
            "Maintenez appuyé pour déplacer un tour. Un membre avec plusieurs parts apparaît autant de fois qu'il recevra la cagnotte."
          )}
        </Text>
      </View>

      {/* Compteur de tours */}
      <Text style={styles.slotsCount}>
        {slots.length} tour{slots.length > 1 ? 's' : ''} de versement
      </Text>

      {/* Liste draggable des slots */}
      <View style={styles.listWrapper}>
        <DraggableFlatList
          data={slots}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          onDragEnd={handleDragEnd}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={[
            styles.saveBtn,
            reorderMutation.isPending && styles.saveBtnDisabled,
          ]}
          onPress={handleSave}
          disabled={reorderMutation.isPending}
          accessibilityRole="button"
        >
          {reorderMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>
                {t('rotationReorder.save', "Enregistrer l'ordre")}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1C1C1E' },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF8E7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  infoBannerText: { flex: 1, fontSize: 13, color: '#78350F', lineHeight: 18 },
  slotsCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
  },
  listWrapper: {
    flex: 1,
  },
  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 120 },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  slotRowActive: {
    backgroundColor: '#E8F5EE',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 6,
  },
  tourBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A6B3C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tourNumber: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  memberInfo: { flex: 1, gap: 4 },
  memberName: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  pill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  pillOrganizer: { backgroundColor: '#1A6B3C' },
  pillShare: { backgroundColor: '#F5A623' },
  pillText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  footer: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexShrink: 0,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1A6B3C',
    paddingVertical: 16,
    borderRadius: 28,
    minHeight: 56,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
