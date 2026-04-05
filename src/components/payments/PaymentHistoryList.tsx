import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/spacing';
import { PaymentHistoryItem } from '@/components/payments/PaymentHistoryItem';
import type { PaymentHistoryEntry } from '@/types/payments.types';

export interface PaymentHistoryListProps {
  entries: PaymentHistoryEntry[];
  onSeeAll: () => void;
  onItemPress: (entry: PaymentHistoryEntry) => void;
}

const DISPLAY_LIMIT = 5;

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sectionLabelForDay(dayStart: Date, today: Date, yesterday: Date): string {
  if (sameDay(dayStart, today)) return "Aujourd'hui";
  if (sameDay(dayStart, yesterday)) return 'Hier';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
  }).format(dayStart);
}

type Group = { key: string; label: string; items: PaymentHistoryEntry[] };

export const PaymentHistoryList: React.FC<PaymentHistoryListProps> = ({
  entries,
  onSeeAll,
  onItemPress,
}) => {
  const { groups, hiddenCount } = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      const ta = new Date(a.paidAt).getTime();
      const tb = new Date(b.paidAt).getTime();
      return tb - ta;
    });
    const visible = sorted.slice(0, DISPLAY_LIMIT);
    const rest = Math.max(0, sorted.length - DISPLAY_LIMIT);

    const now = new Date();
    const today = startOfLocalDay(now);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const map = new Map<string, PaymentHistoryEntry[]>();
    for (const e of visible) {
      const k = dayKey(e.paidAt);
      const list = map.get(k) ?? [];
      list.push(e);
      map.set(k, list);
    }

    const groupList: Group[] = [];
    for (const [k, items] of Array.from(map.entries())) {
      const first = items[0];
      const d = new Date(first.paidAt);
      const dayStart = Number.isNaN(d.getTime())
        ? today
        : startOfLocalDay(d);
      const label = sectionLabelForDay(dayStart, today, yesterday);
      items.sort(
        (a, b) =>
          new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
      );
      groupList.push({ key: k, label, items });
    }

    groupList.sort((a, b) => {
      const ta = new Date(a.items[0].paidAt).getTime();
      const tb = new Date(b.items[0].paidAt).getTime();
      return tb - ta;
    });

    return { groups: groupList, hiddenCount: rest };
  }, [entries]);

  if (entries.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      {groups.map((g) => (
        <View key={g.key}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{g.label}</Text>
          </View>
          <View style={styles.card}>
            {g.items.map((item, idx) => (
              <View key={item.uid}>
                {idx > 0 ? <View style={styles.itemSep} /> : null}
                <PaymentHistoryItem
                  entry={item}
                  onPress={() => {
                    onItemPress(item);
                  }}
                />
              </View>
            ))}
          </View>
        </View>
      ))}

      {hiddenCount > 0 ? (
        <Pressable
          onPress={onSeeAll}
          style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.seeAllText}>
            Voir les {hiddenCount} autre{hiddenCount > 1 ? 's' : ''} paiement
            {hiddenCount > 1 ? 's' : ''} →
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginBottom: SPACING.sm,
  },
  sectionHeader: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 12,
    paddingBottom: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.gray500,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  itemSep: {
    height: 0.5,
    backgroundColor: '#F1EFE8',
    marginHorizontal: 14,
  },
  seeAll: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  seeAllText: {
    fontSize: 12,
    color: COLORS.primary,
  },
  pressed: {
    opacity: 0.85,
  },
});
