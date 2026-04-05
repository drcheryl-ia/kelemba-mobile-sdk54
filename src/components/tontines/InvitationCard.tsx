import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { TontineListItem } from '@/types/tontine';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';
import { formatFcfa } from '@/utils/formatters';
import { frequencyReadable } from '@/utils/tontineFrequencyShort';

type ItemWithOptionalScore = TontineListItem & { minScoreRequired?: number };

export interface InvitationCardProps {
  item: TontineListItem;
  onAccept: () => void;
  onDecline: () => void;
}

export const InvitationCard: React.FC<InvitationCardProps> = ({
  item,
  onAccept,
  onDecline,
}) => {
  const organizer = item.organizerName?.trim();
  const headerLine =
    organizer != null && organizer.length > 0
      ? `Invitée par ${organizer}`
      : 'Invitation reçue';

  const memberCount = item.activeMemberCount ?? 0;
  const freq = frequencyReadable(item.frequency);
  const extra = item as ItemWithOptionalScore;
  const minScore = extra.minScoreRequired;

  const metaParts = [
    `${formatFcfa(item.amountPerShare)} / part`,
    freq,
    `${memberCount} membres`,
  ];
  if (minScore != null && Number.isFinite(minScore)) {
    metaParts.push(`Score min. ${Math.round(minScore)}`);
  }
  const metaLine = metaParts.join(' · ');

  return (
    <View style={styles.card} accessibilityRole="none">
      <Text style={styles.inviter}>{headerLine}</Text>
      <Text style={styles.title} numberOfLines={2}>
        {item.name}
      </Text>
      <Text style={styles.meta}>{metaLine}</Text>

      <View style={styles.sep} />

      <View style={styles.actions}>
        <Pressable
          onPress={onAccept}
          style={({ pressed }) => [
            styles.btnPrimary,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Voir et accepter l'invitation"
        >
          <Text style={styles.btnPrimaryLabel}>Voir et accepter</Text>
        </Pressable>
        <Pressable
          onPress={onDecline}
          style={({ pressed }) => [
            styles.btnGhost,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Refuser l'invitation"
        >
          <Text style={styles.btnGhostLabel}>Refuser</Text>
        </Pressable>
      </View>
    </View>
  );
};

const ORANGE_BORDER = '#D85A30';

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: ORANGE_BORDER,
    gap: 4,
  },
  inviter: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.secondaryText,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  meta: {
    fontSize: 11,
    color: COLORS.gray500,
  },
  sep: {
    height: 0.5,
    backgroundColor: COLORS.gray200,
    marginVertical: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  btnPrimaryLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.white,
  },
  btnGhost: {
    flex: 1,
    backgroundColor: COLORS.gray100,
    borderRadius: RADIUS.sm,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  btnGhostLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.gray700,
  },
  pressed: {
    opacity: 0.9,
  },
});
