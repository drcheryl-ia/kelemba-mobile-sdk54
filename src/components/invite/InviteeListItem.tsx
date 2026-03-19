/**
 * Élément de liste — invité en attente d'envoi.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { getInitials, hashToColor } from '@/utils/avatarUtils';
import { maskPhone } from '@/utils/formatters';
import type { PendingInvitee } from '@/types/invite';

export interface InviteeListItemProps {
  item: PendingInvitee;
  onRemove: () => void;
}

export const InviteeListItem: React.FC<InviteeListItemProps> = ({
  item,
  onRemove,
}) => {
  const { t } = useTranslation();
  const displayName = item.fullName ?? maskPhone(item.phone);

  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: hashToColor(item.phone) }]}>
        <Text style={styles.avatarText}>
          {item.fullName ? getInitials(item.fullName) : '?'}
        </Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.partsText}>
          {item.sharesCount} {t('inviteMembers.parts')}
          {item.kelembScore != null && ` · ${item.kelembScore}`}
        </Text>
      </View>
      <Pressable
        onPress={onRemove}
        style={styles.removeBtn}
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel')}
      >
        <Ionicons name="trash-outline" size={24} color="#D0021B" />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  partsText: {
    fontSize: 12,
    color: '#6B7280',
  },
  removeBtn: {
    padding: 8,
  },
});
