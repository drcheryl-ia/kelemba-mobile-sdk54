/**
 * Ligne notification — carte groupée, swipe archiver, actions optionnelles.
 */
import React, { memo, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import type { Notification } from '@/types/notification.types';
import { COLORS } from '@/theme/colors';

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "à l'instant";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(diffMs / 3_600_000);
  if (hrs < 24) {
    const m = Math.floor((diffMs % 3_600_000) / 60_000);
    return m > 0 ? `${hrs}h${String(m).padStart(2, '0')}` : `${hrs}h`;
  }
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

type IconPack = {
  bg: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

function iconPackForType(type: string): IconPack {
  const t = String(type);
  if (t === 'PAYMENT_REMINDER' || t === 'PAYMENT_RECEIVED') {
    return {
      bg: COLORS.primaryLight,
      color: COLORS.primary,
      icon: 'card-outline',
    };
  }
  if (t === 'POT_AVAILABLE') {
    return {
      bg: COLORS.accentLight,
      color: COLORS.accentDark,
      icon: 'wallet-outline',
    };
  }
  if (t === 'POT_DELAYED' || t === 'PENALTY_APPLIED') {
    return {
      bg: COLORS.dangerLight,
      color: COLORS.dangerText,
      icon: 'time-outline',
    };
  }
  if (t === 'KYC_UPDATE') {
    return {
      bg: COLORS.gray100,
      color: COLORS.gray700,
      icon: 'id-card-outline',
    };
  }
  if (t === 'TONTINE_INVITATION') {
    return {
      bg: COLORS.accentLight,
      color: COLORS.accentDark,
      icon: 'people-outline',
    };
  }
  if (t === 'ROTATION_CHANGED' || t === 'ROTATION_SWAP_REQUESTED') {
    return {
      bg: COLORS.primaryLight,
      color: COLORS.primary,
      icon: 'sync-outline',
    };
  }
  if (t === 'SCORE_UPDATE') {
    return {
      bg: '#EEEDFE',
      color: '#534AB7',
      icon: 'star-outline',
    };
  }
  if (t === 'SYSTEM') {
    return {
      bg: COLORS.gray100,
      color: COLORS.gray500,
      icon: 'information-circle-outline',
    };
  }
  if (t === 'CASH_PENDING') {
    return {
      bg: COLORS.accentLight,
      color: COLORS.accentDark,
      icon: 'cash-outline',
    };
  }
  if (t.startsWith('SAVINGS_')) {
    return {
      bg: COLORS.accentLight,
      color: COLORS.accentDark,
      icon: 'hourglass-outline',
    };
  }
  return {
    bg: COLORS.gray100,
    color: COLORS.gray500,
    icon: 'notifications-outline',
  };
}

function typeBadge(
  n: Notification,
  scoreDelta?: number
): { label: string; bg: string; fg: string } | null {
  const t = String(n.type);
  if (t === 'PAYMENT_REMINDER' || t === 'POT_DELAYED') {
    return { label: 'Urgent', bg: COLORS.dangerLight, fg: COLORS.dangerText };
  }
  if (t === 'TONTINE_INVITATION') {
    return {
      label: 'Invitation',
      bg: COLORS.accentLight,
      fg: COLORS.accentDark,
    };
  }
  if (t === 'SCORE_UPDATE' && scoreDelta != null && Number.isFinite(scoreDelta)) {
    const sign = scoreDelta > 0 ? '+' : '';
    return {
      label: `${sign}${scoreDelta} pts`,
      bg: '#EEEDFE',
      fg: '#3C3489',
    };
  }
  if (t === 'PENALTY_APPLIED') {
    return { label: 'Pénalité', bg: COLORS.dangerLight, fg: COLORS.dangerText };
  }
  return null;
}

export interface NotificationRowProps {
  notification: Notification;
  onPress: () => void;
  onMarkRead: (uid: string) => void;
  onArchive: (uid: string) => void;
  isFirst: boolean;
  isLast: boolean;
  actionStrip?: React.ReactNode;
  swipeEnabled?: boolean;
  accessibilityActionHint: string;
  scoreDelta?: number;
}

const NotificationRowInner: React.FC<NotificationRowProps> = ({
  notification: n,
  onPress,
  onMarkRead,
  onArchive,
  isFirst,
  isLast,
  actionStrip,
  swipeEnabled = true,
  accessibilityActionHint,
  scoreDelta,
}) => {
  const swipeRef = useRef<Swipeable | null>(null);
  const unread = n.readAt == null;
  const ip = iconPackForType(String(n.type));
  const timeLabel = formatRelativeTime(n.createdAt);
  const badge = typeBadge(n, scoreDelta);

  const close = useCallback(() => swipeRef.current?.close(), []);

  const onLongPress = useCallback(() => {
    Alert.alert(n.title, undefined, [
      {
        text: 'Marquer comme lu',
        onPress: () => onMarkRead(n.uid),
      },
      {
        text: 'Archiver',
        style: 'destructive',
        onPress: () => onArchive(n.uid),
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  }, [n.title, n.uid, onArchive, onMarkRead]);

  const renderRight = useCallback(
    () => (
      <Pressable
        style={styles.swipeArchive}
        onPress={() => {
          onArchive(n.uid);
          close();
        }}
        accessibilityRole="button"
        accessibilityLabel="Archiver"
      >
        <Ionicons name="archive-outline" size={22} color={COLORS.white} />
        <Text style={styles.swipeArchiveTxt}>Archiver</Text>
      </Pressable>
    ),
    [close, n.uid, onArchive]
  );

  const a11yLabel = `${n.title} · ${n.message.slice(0, 80)} · ${timeLabel}${
    unread ? ', non lue' : ''
  }`;

  const rowOnly = (
    <Pressable
      style={[styles.row, unread ? styles.rowUnread : styles.rowRead]}
      onPress={() => onPress()}
      onLongPress={onLongPress}
      delayLongPress={400}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint={accessibilityActionHint}
    >
      <View style={[styles.iconBox, { backgroundColor: ip.bg }]}>
        <Ionicons name={ip.icon} size={22} color={ip.color} />
      </View>
      <View style={styles.mid}>
        <Text style={styles.title} numberOfLines={2}>
          {n.title}
        </Text>
        <Text style={styles.msg} numberOfLines={2} ellipsizeMode="tail">
          {n.message}
        </Text>
      </View>
      <View style={styles.right}>
        {unread ? <View style={styles.dot} /> : <View style={styles.dotPh} />}
        <Text style={styles.time}>{timeLabel}</Text>
        {badge ? (
          <View style={[styles.pill, { backgroundColor: badge.bg }]}>
            <Text style={[styles.pillTxt, { color: badge.fg }]}>{badge.label}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );

  const card = (
    <View
      style={[
        styles.cardOuter,
        isFirst && styles.cardFirst,
        isLast && styles.cardLast,
      ]}
    >
      {swipeEnabled ? (
        <Swipeable
          ref={swipeRef}
          renderRightActions={renderRight}
          overshootRight={false}
        >
          <View>
            {rowOnly}
            {!isLast ? <View style={styles.sep} /> : null}
          </View>
        </Swipeable>
      ) : (
        <View>
          {rowOnly}
          {!isLast ? <View style={styles.sep} /> : null}
        </View>
      )}
      {actionStrip}
    </View>
  );

  return <View style={styles.wrap}>{card}</View>;
};

export const NotificationItem = memo(NotificationRowInner);

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16 },
  cardOuter: {
    backgroundColor: COLORS.white,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    overflow: 'hidden',
  },
  cardFirst: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  cardLast: {
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  rowUnread: { backgroundColor: COLORS.primaryLight },
  rowRead: { backgroundColor: COLORS.white },
  sep: {
    height: 0.5,
    backgroundColor: COLORS.gray100,
    marginHorizontal: 14,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mid: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginBottom: 2,
    lineHeight: 17,
  },
  msg: {
    fontSize: 11,
    color: COLORS.gray500,
    lineHeight: 15,
  },
  right: {
    alignItems: 'flex-end',
    flexShrink: 0,
    maxWidth: '32%',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginBottom: 4,
  },
  dotPh: { width: 8, height: 8, marginBottom: 4 },
  time: { fontSize: 11, color: COLORS.gray500, textAlign: 'right' },
  pill: {
    marginTop: 4,
    borderRadius: 20,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  pillTxt: { fontSize: 9, fontWeight: '500' },
  swipeArchive: {
    backgroundColor: COLORS.danger,
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  swipeArchiveTxt: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
});
