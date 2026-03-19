import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import type { UserProfileResponseDto } from '@/types/user.types';
import type { UserStatus } from '@/api/types/api.types';

export interface ProfileHeaderProps {
  profile: UserProfileResponseDto | null;
  isLoading: boolean;
}

function getStatusBadge(status: UserStatus): {
  text: string;
  color: string;
} {
  switch (status) {
    case 'ACTIVE':
      return { text: 'Compte Actif', color: '#1A6B3C' };
    case 'SUSPENDED':
      return { text: 'Suspendu', color: '#D0021B' };
    case 'BANNED':
      return { text: 'Banni', color: '#D0021B' };
    default:
      return { text: 'En attente', color: '#F5A623' };
  }
}

function getInitials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}

function formatPhone(phone: string): string {
  return phone.replace(/(\+236)(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  profile,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <View style={styles.container}>
        <SkeletonBlock width={96} height={96} borderRadius={48} />
        <View style={styles.textBlock}>
          <SkeletonBlock width={180} height={24} borderRadius={4} />
          <SkeletonBlock width={120} height={16} borderRadius={4} style={{ marginTop: 8 }} />
        </View>
      </View>
    );
  }

  if (!profile) return null;

  const statusBadge = getStatusBadge(profile.status);
  const isKycVerified = profile.kycStatus === 'VERIFIED';

  return (
    <View style={styles.container}>
      <View style={styles.avatarWrapper}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(profile.fullName)}</Text>
        </View>
        {isKycVerified && (
          <View style={styles.kycBadge}>
            <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" />
          </View>
        )}
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.fullName}>{profile.fullName}</Text>
        <Text style={styles.phone}>{formatPhone(profile.phone)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: `${statusBadge.color}20`, borderColor: statusBadge.color }]}>
          <View style={[styles.statusDot, { backgroundColor: statusBadge.color }]} />
          <Text style={[styles.statusText, { color: statusBadge.color }]}>
            {statusBadge.text}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#1A6B3C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  kycBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0055A5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  textBlock: {
    alignItems: 'center',
    marginTop: 16,
  },
  fullName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  phone: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
