/**
 * Ligne membre — avatar initiale, nom, badge versement, solde.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type {
  SavingsMemberSummary,
  SavingsPeriodStatus,
} from '@/types/savings.types';
import { formatFCFA } from '@/utils/savings.utils';

export interface SavingsMemberRowProps {
  member: SavingsMemberSummary;
  isPrivate: boolean;
  currentUserUid: string;
  periodStatus?: SavingsPeriodStatus;
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return fullName.slice(0, 2).toUpperCase();
}

function getAvatarColor(uid: string): string {
  const colors = ['#1A6B3C', '#0055A5', '#F5A623', '#D0021B', '#6B7280'];
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function displayBalance(
  member: SavingsMemberSummary,
  isPrivate: boolean,
  currentUserUid: string
): string {
  if (isPrivate && member.userUid !== currentUserUid) return '— FCFA';
  return member.personalBalance !== null
    ? formatFCFA(member.personalBalance)
    : '— FCFA';
}

export const SavingsMemberRow: React.FC<SavingsMemberRowProps> = ({
  member,
  isPrivate,
  currentUserUid,
  periodStatus = 'OPEN',
}) => {
  const initials = getInitials(member.fullName);
  const avatarColor = getAvatarColor(member.uid);
  const balance = displayBalance(member, isPrivate, currentUserUid);

  const contributionBadge = () => {
    if (member.hasContributedThisPeriod) {
      return (
        <View style={[styles.badge, styles.badgeContributed]}>
          <Text style={styles.badgeText}>✓ A versé</Text>
        </View>
      );
    }
    if (periodStatus === 'CLOSED') {
      return (
        <View style={[styles.badge, styles.badgeLate]}>
          <Text style={styles.badgeText}>❌ Retard</Text>
        </View>
      );
    }
    return (
      <View style={[styles.badge, styles.badgePending]}>
        <Text style={styles.badgeText}>⏳ En attente</Text>
      </View>
    );
  };

  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>
          {member.fullName}
        </Text>
        <View style={styles.badges}>
          {contributionBadge()}
          {member.isBonusEligible && (
            <View style={styles.bonusBadge}>
              <Text style={styles.bonusText}>🏆</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={styles.balance}>{balance}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  badgeContributed: {
    backgroundColor: '#DCFCE7',
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
  },
  badgeLate: {
    backgroundColor: '#FEE2E2',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  bonusBadge: {
    paddingHorizontal: 4,
  },
  bonusText: {
    fontSize: 14,
  },
  balance: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
  },
});
