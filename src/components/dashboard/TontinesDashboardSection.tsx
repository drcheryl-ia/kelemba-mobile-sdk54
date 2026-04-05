import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TontineListItem } from '@/types/tontine';
import { isMembershipPending } from '@/utils/tontineMerge';
import { TontineCompactCard } from '@/components/dashboard/TontineCompactCard';
import { SkeletonPulse } from '@/components/common/SkeletonPulse';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';

export interface TontinesDashboardSectionProps {
  tontines: TontineListItem[];
  isLoading: boolean;
  onCardPress: (uid: string, isCreator: boolean) => void;
  onCreateTontinePress: () => void;
}

type ChipKey = 'active' | 'draft' | 'pending';

function isRotative(t: TontineListItem): boolean {
  if (t.type === 'EPARGNE') return false;
  if (t.status === 'CANCELLED' || t.status === 'COMPLETED') return false;
  return true;
}

function bucket(t: TontineListItem): ChipKey | null {
  if (!isRotative(t)) return null;
  if (isMembershipPending(t)) return 'pending';
  if (t.status === 'DRAFT') return 'draft';
  if (t.status === 'ACTIVE' || t.status === 'BETWEEN_ROUNDS') return 'active';
  return null;
}

function TontineCardSkeleton(): React.ReactElement {
  return (
    <View style={skStyles.card} accessibilityElementsHidden>
      <View style={skStyles.rowTop}>
        <SkeletonPulse width={100} height={13} borderRadius={4} />
        <SkeletonPulse width={44} height={16} borderRadius={RADIUS.pill} />
      </View>
      <SkeletonPulse width={80} height={18} borderRadius={4} />
      <SkeletonPulse width="100%" height={10} borderRadius={4} />
      <SkeletonPulse width="100%" height={3} borderRadius={2} />
      <View style={skStyles.rowBot}>
        <SkeletonPulse width={60} height={10} borderRadius={4} />
        <SkeletonPulse width={40} height={10} borderRadius={4} />
      </View>
    </View>
  );
}

function EmptyTontinesState(props: { onCreateTontinePress: () => void }): React.ReactElement {
  return (
    <View style={emptyStyles.wrap}>
      <View style={emptyStyles.illus}>
        <Ionicons
          name="people-outline"
          size={28}
          color={COLORS.primaryDark}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>
      <Text style={emptyStyles.title}>Aucune tontine active</Text>
      <Text style={emptyStyles.sub}>
        Créez votre première tontine ou acceptez une invitation.
      </Text>
      <Pressable
        onPress={props.onCreateTontinePress}
        style={({ pressed }) => [
          emptyStyles.btn,
          pressed && { opacity: 0.92 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Créer une tontine"
      >
        <Text style={emptyStyles.btnText}>Créer une tontine</Text>
      </Pressable>
    </View>
  );
}

const SKELETON_KEYS = ['sk-1', 'sk-2'];

export const TontinesDashboardSection: React.FC<
  TontinesDashboardSectionProps
> = ({ tontines, isLoading, onCardPress, onCreateTontinePress }) => {
  const rotative = useMemo(() => {
    return tontines.filter((t) => {
      if (!isRotative(t)) return false;
      return bucket(t) != null;
    });
  }, [tontines]);

  const counts = useMemo(() => {
    let a = 0;
    let d = 0;
    let p = 0;
    for (const t of rotative) {
      const b = bucket(t);
      if (b === 'active') a += 1;
      else if (b === 'draft') d += 1;
      else if (b === 'pending') p += 1;
    }
    return { active: a, draft: d, pending: p };
  }, [rotative]);

  const [chip, setChip] = useState<ChipKey>('active');

  const filtered = useMemo(() => {
    return rotative.filter((t) => bucket(t) === chip);
  }, [rotative, chip]);

  const chips: { key: ChipKey; label: string }[] = [];
  if (counts.active > 0) {
    chips.push({ key: 'active', label: `Actives (${counts.active})` });
  }
  if (counts.draft > 0) {
    chips.push({ key: 'draft', label: `Brouillons (${counts.draft})` });
  }
  if (counts.pending > 0) {
    chips.push({
      key: 'pending',
      label: `En attente (${counts.pending})`,
    });
  }

  if (isLoading) {
    return (
      <FlatList
        horizontal
        data={SKELETON_KEYS}
        keyExtractor={(k) => k}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.hList}
        renderItem={() => <TontineCardSkeleton />}
      />
    );
  }

  if (tontines.length === 0) {
    return <EmptyTontinesState onCreateTontinePress={onCreateTontinePress} />;
  }

  return (
    <View>
      {chips.length > 0 ? (
        <View style={{ height: 32 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {chips.map((c) => {
              const selected = chip === c.key;
              return (
                <Pressable
                  key={c.key}
                  onPress={() => setChip(c.key)}
                  style={[
                    styles.chip,
                    selected ? styles.chipOn : styles.chipOff,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Filtrer : ${c.label}`}
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selected ? styles.chipTextOn : styles.chipTextOff,
                    ]}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <FlatList
        horizontal
        data={filtered}
        keyExtractor={(it) => it.uid}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.hList}
        ListEmptyComponent={
          <Text style={styles.empty}>Aucune tontine</Text>
        }
        renderItem={({ item }) => (
          <TontineCompactCard
            item={item}
            onPress={() =>
              onCardPress(
                item.uid,
                item.isCreator === true || item.membershipRole === 'CREATOR'
              )
            }
          />
        )}
      />
    </View>
  );
};

const skStyles = StyleSheet.create({
  card: {
    width: 180,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    padding: 14,
    gap: 10,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowBot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

const emptyStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  illus: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  sub: {
    fontSize: 12,
    color: COLORS.gray500,
    textAlign: 'center',
    lineHeight: 18,
  },
  btn: {
    width: '100%',
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    marginTop: 4,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

const styles = StyleSheet.create({
  chipsRow: {
    alignItems: 'center',
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  chipOn: {
    backgroundColor: COLORS.primary,
  },
  chipOff: {
    backgroundColor: COLORS.white,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  chipTextOn: {
    color: COLORS.white,
    fontWeight: '700',
  },
  chipTextOff: {
    color: COLORS.gray700,
  },
  hList: {
    paddingHorizontal: 16,
    gap: 10,
    paddingTop: 8,
  },
  empty: {
    fontSize: 13,
    color: COLORS.gray500,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
});
