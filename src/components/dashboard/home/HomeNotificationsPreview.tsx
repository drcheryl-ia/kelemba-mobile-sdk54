/**
 * Aperçu des notifications (max 3) + lien Voir tout.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Notification } from '@/types/notification.types';

const MAX = 3;

function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = Date.now();
  const diff = Math.floor((now - d.getTime()) / 1000);
  if (diff < 60) return 'À l’instant';
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export interface HomeNotificationsPreviewProps {
  items: Notification[];
  isLoading: boolean;
  isError: boolean;
  onSeeAll: () => void;
  onOpen: (n: Notification) => void;
}

export const HomeNotificationsPreview: React.FC<HomeNotificationsPreviewProps> = ({
  items,
  isLoading,
  isError,
  onSeeAll,
  onOpen,
}) => {
  const preview = items.slice(0, MAX);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>NOTIFICATIONS</Text>
        <Pressable onPress={onSeeAll} hitSlop={8} accessibilityRole="button">
          <Text style={styles.seeAll}>Voir tout</Text>
        </Pressable>
      </View>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#1A6B3C" />
        </View>
      ) : isError ? (
        <Text style={styles.muted}>Impossible de charger les notifications.</Text>
      ) : preview.length === 0 ? (
        <Text style={styles.muted}>Aucune notification récente.</Text>
      ) : (
        <View style={styles.list}>
          {preview.map((n) => (
            <Pressable
              key={n.uid}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => onOpen(n)}
              accessibilityRole="button"
            >
              <View style={styles.dotWrap}>
                {n.readAt == null ? <View style={styles.unreadDot} /> : null}
                <Ionicons name="notifications-outline" size={18} color="#6B7280" />
              </View>
              <View style={styles.textCol}>
                <Text style={styles.msgTitle} numberOfLines={1}>
                  {n.title}
                </Text>
                <Text style={styles.msgBody} numberOfLines={2}>
                  {n.message}
                </Text>
                <Text style={styles.time}>{formatRelative(n.createdAt)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    marginTop: 8,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.8,
  },
  seeAll: {
    color: '#1A6B3C',
    fontWeight: '600',
    fontSize: 14,
  },
  center: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  muted: {
    fontSize: 14,
    color: '#9CA3AF',
    paddingVertical: 8,
  },
  list: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  rowPressed: {
    backgroundColor: '#F9FAFB',
  },
  dotWrap: {
    width: 28,
    alignItems: 'center',
    paddingTop: 2,
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D0021B',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  msgTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  msgBody: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 18,
  },
  time: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
});
