/**
 * Carte liste — tontine épargne (hors TontineCard rotatif).
 */
import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { SavingsListItem } from '@/types/savings.types';
import { formatFcfa, formatDateLong } from '@/utils/formatters';
import { frequencyLabel } from '@/utils/savings.utils';

const GREEN = '#1A6B3C';
const ORANGE = '#EA580C';
const GREY = '#9E9E9E';
const AMBER = '#F5A623';

export interface SavingsCardProps {
  item: SavingsListItem;
  onPress: () => void;
  /** Ex. `{ width: '100%' }` sur liste pleine largeur */
  containerStyle?: StyleProp<ViewStyle>;
}

function statusBadge(status: SavingsListItem['status']): { bg: string; label: string } {
  if (status === 'ACTIVE') return { bg: GREEN, label: 'ACTIVE' };
  if (status === 'DRAFT') return { bg: ORANGE, label: 'DRAFT' };
  if (status === 'COMPLETED') return { bg: GREY, label: 'COMPLETED' };
  return { bg: GREY, label: status };
}

export const SavingsCard: React.FC<SavingsCardProps> = ({
  item,
  onPress,
  containerStyle,
}) => {
  const st = statusBadge(item.status);
  const unlock = item.unlockDate.split('T')[0];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        containerStyle,
        pressed && styles.cardPressed,
      ]}
      accessibilityRole="button"
    >
      <Text style={styles.title} numberOfLines={2}>
        {item.name}
      </Text>
      <View style={styles.row}>
        <View style={[styles.badge, { backgroundColor: st.bg }]}>
          <Text style={styles.badgeText}>{st.label}</Text>
        </View>
        {item.isCreator ? (
          <View style={styles.creatorBadge}>
            <Text style={styles.creatorText}>Créatrice</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.line}>Mon solde : {formatFcfa(item.personalBalance)}</Text>
      <Text style={styles.lineMuted}>
        Déblocage : {formatDateLong(unlock)}
      </Text>
      <Text style={styles.lineMuted}>{frequencyLabel(item.frequency)}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 280,
    minHeight: 140,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardPressed: { opacity: 0.92 },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  creatorBadge: {
    backgroundColor: AMBER,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  creatorText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  line: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4 },
  lineMuted: { fontSize: 13, color: '#6B7280', marginBottom: 2 },
});
