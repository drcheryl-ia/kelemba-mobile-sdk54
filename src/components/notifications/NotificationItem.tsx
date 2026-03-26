/**
 * Ligne notification — carte premium, swipes, sélection (mode édition).
 */
import React, { memo, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { Notification } from '@/types/notification.types';
import { logger } from '@/utils/logger';
import {
  getNotificationAccent,
  NOTIFICATION_ACCENT_STYLES,
} from '@/utils/notificationVisual';
import { NotificationIcon } from './NotificationIcon';

const GREEN = '#1A6B3C';
const RED = '#D0021B';

function formatRelativeNotificationTime(
  isoDate: string,
  t: (k: string, o?: Record<string, number>) => string
): string {
  const date = new Date(isoDate);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return t('notifications.time.now');
  if (diffMins < 60) return t('notifications.time.mins', { count: diffMins });
  if (diffHours < 24) return t('notifications.time.hours', { count: diffHours });
  if (diffDays < 7) return t('notifications.time.days', { count: diffDays });
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export interface NotificationItemProps {
  item: Notification;
  onOpen: (item: Notification) => void;
  onMarkAsRead: (uid: string) => void;
  onRequestLocalHide: (item: Notification) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (uid: string) => void;
  onLongPressToEdit?: (uid: string) => void;
  swipeEnabled?: boolean;
}

const NotificationItemInner: React.FC<NotificationItemProps> = ({
  item,
  onOpen,
  onMarkAsRead,
  onRequestLocalHide,
  selectionMode = false,
  selected = false,
  onToggleSelect,
  onLongPressToEdit,
  swipeEnabled = true,
}) => {
  const { t } = useTranslation();
  const swipeRef = useRef<Swipeable | null>(null);

  if (!item?.createdAt) {
    logger.error('NotificationItem: item invalide reçu', item);
    return null;
  }

  const isUnread = item.readAt === null;
  const accent = getNotificationAccent(item.type);
  const accentStyle = NOTIFICATION_ACCENT_STYLES[accent];
  const timeLabel = formatRelativeNotificationTime(item.createdAt, t);

  const closeSwipe = useCallback(() => {
    swipeRef.current?.close();
  }, []);

  const renderLeftActions = useCallback(() => {
    if (!isUnread) return null;
    return (
      <Pressable
        style={styles.swipeRead}
        onPress={() => {
          onMarkAsRead(item.uid);
          closeSwipe();
        }}
        accessibilityRole="button"
        accessibilityLabel={t('notifications.swipe.markRead')}
      >
        <Ionicons name="checkmark-done" size={22} color="#FFFFFF" />
        <Text style={styles.swipeReadLabel}>{t('notifications.swipe.markRead')}</Text>
      </Pressable>
    );
  }, [closeSwipe, isUnread, item.uid, onMarkAsRead, t]);

  const renderRightActions = useCallback(
    () => (
      <Pressable
        style={styles.swipeHide}
        onPress={() => {
          onRequestLocalHide(item);
          closeSwipe();
        }}
        accessibilityRole="button"
        accessibilityLabel={t('notifications.swipe.hideLocal')}
      >
        <Ionicons name="eye-off-outline" size={22} color="#FFFFFF" />
        <Text style={styles.swipeHideLabel}>{t('notifications.swipe.hideLocal')}</Text>
      </Pressable>
    ),
    [closeSwipe, item, onRequestLocalHide, t]
  );

  const cardBody = (
    <Pressable
      style={[
        styles.row,
        { borderLeftColor: accentStyle.border, backgroundColor: accentStyle.tintBg },
        isUnread && styles.rowUnreadBorder,
        selected && styles.rowSelected,
      ]}
      onPress={() => {
        if (selectionMode && onToggleSelect) {
          onToggleSelect(item.uid);
          return;
        }
        onOpen(item);
      }}
      onLongPress={() => {
        if (selectionMode) return;
        onLongPressToEdit?.(item.uid);
      }}
      delayLongPress={380}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      accessibilityState={{ selected: selectionMode && selected }}
    >
      {selectionMode ? (
        <View style={styles.checkSlot}>
          <Ionicons
            name={selected ? 'checkbox' : 'square-outline'}
            size={24}
            color={selected ? GREEN : '#9CA3AF'}
          />
        </View>
      ) : null}
      <NotificationIcon type={item.type} />
      <View style={styles.body}>
        <Text
          style={[styles.title, isUnread ? styles.titleUnread : styles.titleRead]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <Text style={styles.message} numberOfLines={2}>
          {item.message}
        </Text>
      </View>
      <View style={styles.right}>
        {isUnread ? <View style={styles.unreadDot} accessibilityLabel="Non lu" /> : <View style={styles.dotSpacer} />}
        <Text style={styles.timestamp}>{timeLabel}</Text>
      </View>
    </Pressable>
  );

  if (!swipeEnabled || selectionMode) {
    return <View style={styles.cardWrap}>{cardBody}</View>;
  }

  return (
    <View style={styles.cardWrap}>
      <Swipeable
        ref={swipeRef}
        renderLeftActions={isUnread ? renderLeftActions : undefined}
        renderRightActions={renderRightActions}
        friction={2}
        overshootLeft={false}
        overshootRight={false}
      >
        {cardBody}
      </Swipeable>
    </View>
  );
};

export const NotificationItem = memo(NotificationItemInner);

const styles = StyleSheet.create({
  cardWrap: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 88,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    borderLeftWidth: 4,
    borderRadius: 16,
  },
  rowUnreadBorder: {
    borderLeftWidth: 4,
  },
  rowSelected: {
    backgroundColor: '#DCFCE7',
  },
  checkSlot: {
    justifyContent: 'center',
    paddingRight: 2,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.2,
  },
  titleUnread: {
    color: '#111827',
  },
  titleRead: {
    fontWeight: '600',
    color: '#6B7280',
  },
  message: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    lineHeight: 18,
  },
  right: {
    alignItems: 'flex-end',
    gap: 6,
    minWidth: 56,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#0055A5',
  },
  dotSpacer: {
    width: 9,
    height: 9,
  },
  timestamp: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  swipeRead: {
    backgroundColor: GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
    minHeight: 88,
    paddingHorizontal: 8,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  swipeReadLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 4,
    textAlign: 'center',
  },
  swipeHide: {
    backgroundColor: RED,
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
    minHeight: 88,
    paddingHorizontal: 8,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  swipeHideLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 4,
    textAlign: 'center',
  },
});
