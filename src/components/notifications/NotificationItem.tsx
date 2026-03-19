import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import type { Notification } from '@/types/notification.types';
import { logger } from '@/utils/logger';
import { NotificationIcon } from './NotificationIcon';

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "À l'instant";
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export interface NotificationItemProps {
  item: Notification;
  onPress: (item: Notification) => void;
  onMarkAsRead: (uid: string) => void;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  item,
  onPress,
  onMarkAsRead,
}) => {
  if (!item?.createdAt) {
    logger.error('NotificationItem: item invalide reçu', item);
    return null;
  }

  const isUnread = item.readAt === null;
  const isHighPriority =
    item.priority === 'CRITICAL' || item.priority === 'HIGH';
  const isSystem = item.type === 'SYSTEM';

  const renderRightActions = () => (
    <Pressable
      style={styles.deleteAction}
      onPress={() => onMarkAsRead(item.uid)}
      accessibilityRole="button"
      accessibilityLabel="Supprimer"
    >
      <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
      <Text style={styles.deleteLabel}>SUPPR.</Text>
    </Pressable>
  );

  return (
    <Swipeable renderRightActions={renderRightActions}>
      <Pressable
        style={[styles.row, isUnread && styles.rowUnread]}
        onPress={() => onPress(item)}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        <NotificationIcon type={item.type} />
        <View style={styles.body}>
          <Text
            style={[
              styles.title,
              isUnread && styles.titleUnread,
              isHighPriority && styles.titleCritical,
              !isUnread && styles.titleRead,
            ]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {isSystem ? (
            <Text style={styles.systemLink} numberOfLines={1}>
              {item.message}
            </Text>
          ) : (
            <Text style={styles.message} numberOfLines={2}>
              {item.message}
            </Text>
          )}
        </View>
        <View style={styles.right}>
          {isUnread && <View style={styles.unreadDot} />}
          <Text style={styles.timestamp}>{formatRelativeTime(item.createdAt)}</Text>
        </View>
      </Pressable>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  rowUnread: {
    backgroundColor: '#FFF5F5',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  titleUnread: {
    fontWeight: '700',
    color: '#1A1A2E',
  },
  titleCritical: {
    color: '#D0021B',
  },
  titleRead: {
    fontWeight: '400',
    color: '#6B7280',
  },
  message: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  systemLink: {
    fontSize: 12,
    color: '#1A6B3C',
    textDecorationLine: 'underline',
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0055A5',
  },
  timestamp: {
    fontSize: 12,
    color: '#6B7280',
  },
  deleteAction: {
    backgroundColor: '#D0021B',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    minHeight: 72,
    paddingHorizontal: 12,
  },
  deleteLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 4,
  },
});
