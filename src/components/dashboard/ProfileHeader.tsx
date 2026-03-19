import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';

export interface ProfileHeaderProps {
  fullName: string; // "Marie Nzinga" — champ exact du backend
  isOnline: boolean;
  unreadCount: number;
  isLoading: boolean;
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

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  fullName,
  isOnline,
  unreadCount,
  isLoading,
  onNotificationsPress,
}) => {
  const initials = getInitials(fullName);
  const firstName = getFirstName(fullName);

  return (
    <View style={styles.container}>
      <View style={styles.avatarSection}>
        {isLoading ? (
          <SkeletonBlock width={48} height={48} borderRadius={24} />
        ) : (
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials || '?'}</Text>
            {isOnline && <View style={styles.onlineDot} />}
          </View>
        )}
        <View style={styles.greetingSection}>
          {isLoading ? (
            <SkeletonBlock width={120} height={16} borderRadius={4} />
          ) : (
            <>
              <Text style={styles.greeting}>
                Bonjour, {firstName} 👋
              </Text>
              {isOnline && (
                <Text style={styles.statusText}>● EN LIGNE</Text>
              )}
            </>
          )}
        </View>
      </View>
      <Pressable
        onPress={onNotificationsPress}
        style={styles.notifButton}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Notifications"
      >
        <Ionicons name="notifications-outline" size={24} color="#1C1C1E" />
        {unreadCount > 0 && (
          <View style={styles.notifBadge}>
            <Text style={styles.notifBadgeText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
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
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarCircle: {
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
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  greetingSection: {
    flex: 1,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  statusText: {
    fontSize: 12,
    color: '#22C55E',
    fontWeight: '600',
    marginTop: 2,
  },
  notifButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#D0021B',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
