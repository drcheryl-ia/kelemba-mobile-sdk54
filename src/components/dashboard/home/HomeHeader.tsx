/**
 * En-tête Accueil — salutation, sous-ligne contextuelle, notifications, réseau.
 */
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetInfo } from '@react-native-community/netinfo';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import type { KycStatus } from '@/api/types/api.types';

export interface HomeHeaderProps {
  fullName: string;
  isLoading: boolean;
  kycStatus: KycStatus | undefined;
  /** Organisateur : nombre de tontines où l’utilisateur est créateur. */
  managedTontinesCount: number;
  /** Actions organisateur en attente (validations cash + autres compteurs agrégés). */
  pendingActionsCount: number;
  isOrganizerContext: boolean;
  unreadCount: number;
  onNotificationsPress: () => void;
}

function getInitials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  fullName,
  isLoading,
  kycStatus,
  managedTontinesCount,
  pendingActionsCount,
  isOrganizerContext,
  unreadCount,
  onNotificationsPress,
}) => {
  const netInfo = useNetInfo();
  const networkHint = useMemo(() => {
    if (netInfo.isConnected === false) return 'Hors ligne';
    if (netInfo.isInternetReachable === false) return 'Réseau limité';
    return null;
  }, [netInfo.isConnected, netInfo.isInternetReachable]);

  const subtitle = useMemo(() => {
    if (isOrganizerContext) {
      const parts: string[] = [];
      if (managedTontinesCount > 0) {
        parts.push(
          `${managedTontinesCount} tontine${managedTontinesCount > 1 ? 's' : ''} gérée${managedTontinesCount > 1 ? 's' : ''}`
        );
      }
      if (pendingActionsCount > 0) {
        parts.push(`${pendingActionsCount} action${pendingActionsCount > 1 ? 's' : ''} en attente`);
      }
      if (parts.length > 0) return parts.join(' · ');
      return 'Espace organisateur';
    }
    if (kycStatus === 'VERIFIED') return 'Compte vérifié';
    if (kycStatus === 'SUBMITTED' || kycStatus === 'UNDER_REVIEW') {
      return 'KYC en cours de traitement';
    }
    if (kycStatus === 'REJECTED') return 'KYC à mettre à jour';
    return 'Finalisez votre vérification KYC';
  }, [isOrganizerContext, managedTontinesCount, pendingActionsCount, kycStatus]);

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {isLoading ? (
          <SkeletonBlock width={48} height={48} borderRadius={24} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(fullName) || '?'}</Text>
          </View>
        )}
        <View style={styles.textCol}>
          {isLoading ? (
            <SkeletonBlock width={160} height={18} borderRadius={4} />
          ) : (
            <Text style={styles.greeting} numberOfLines={1}>
              Bonjour, {getFirstName(fullName)} 👋
            </Text>
          )}
          {!isLoading ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : (
            <SkeletonBlock width={200} height={14} borderRadius={4} style={{ marginTop: 6 }} />
          )}
          {networkHint != null ? (
            <View style={styles.netRow}>
              <Ionicons name="cloud-offline-outline" size={12} color="#9CA3AF" />
              <Text style={styles.netText}>{networkHint}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Pressable
        onPress={onNotificationsPress}
        style={styles.notifBtn}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Notifications"
      >
        <Ionicons name="notifications-outline" size={24} color="#1C1C1E" />
        {unreadCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1A6B3C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    lineHeight: 18,
  },
  netRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  netText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  notifBtn: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#D0021B',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
