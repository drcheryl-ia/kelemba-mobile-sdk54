/**
 * Liste compacte du statut de cotisation par membre (cycle courant).
 * Données alignées sur GET /tontines/:uid/members — currentCyclePaymentStatus.
 */
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '@/theme/colors';
import { getInitials, hashToColor } from '@/utils/avatarUtils';
import type { TontineMember } from '@/types/tontine';

export interface MemberPaymentStatusListProps {
  members: readonly TontineMember[];
  beneficiaryMembershipUid: string | null | undefined;
  /** Jours de retard affichés sur le badge OVERDUE (ex. depuis l’échéance du cycle). */
  overdueDaysHint?: number | null;
  onPressViewAll?: () => void;
}

function isPaidCycleStatus(raw: string | null | undefined): boolean {
  if (raw == null) return false;
  const s = String(raw).toUpperCase();
  return s === 'PAID' || s === 'COMPLETED';
}

type UiPayKind = 'PAID' | 'OVERDUE' | 'DUE' | 'PROCESSING';

function resolveUiKind(
  raw: string | null | undefined,
  overdueDaysHint: number | null | undefined
): { kind: UiPayKind; overdueDays: number | null } {
  if (raw == null) {
    return { kind: 'DUE', overdueDays: null };
  }
  const s = String(raw).toUpperCase();
  if (s === 'PAID' || s === 'COMPLETED') {
    return { kind: 'PAID', overdueDays: null };
  }
  if (s === 'OVERDUE' || s === 'PENALIZED') {
    const n =
      overdueDaysHint != null && overdueDaysHint > 0
        ? Math.round(overdueDaysHint)
        : 1;
    return { kind: 'OVERDUE', overdueDays: n };
  }
  if (s === 'PROCESSING') {
    return { kind: 'PROCESSING', overdueDays: null };
  }
  if (s === 'PENDING') {
    return { kind: 'DUE', overdueDays: null };
  }
  return { kind: 'DUE', overdueDays: null };
}

function PaymentBadge({
  kind,
  overdueDays,
}: {
  kind: UiPayKind;
  overdueDays: number | null;
}): React.ReactElement {
  if (kind === 'PAID') {
    return (
      <View style={[styles.badge, styles.badgePaid]}>
        <Text style={[styles.badgeText, styles.badgeTextPaid]}>Payé ✓</Text>
      </View>
    );
  }
  if (kind === 'OVERDUE') {
    const d = overdueDays ?? 1;
    return (
      <View style={[styles.badge, styles.badgeOverdue]}>
        <Text style={[styles.badgeText, styles.badgeTextOverdue]}>
          En retard {d}j
        </Text>
      </View>
    );
  }
  if (kind === 'PROCESSING') {
    return (
      <View style={[styles.badge, styles.badgeProcessing]}>
        <Text style={[styles.badgeText, styles.badgeTextProcessing]}>En cours</Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, styles.badgeDue]}>
      <Text style={[styles.badgeText, styles.badgeTextDue]}>En attente</Text>
    </View>
  );
}

export const MemberPaymentStatusList: React.FC<MemberPaymentStatusListProps> = ({
  members,
  beneficiaryMembershipUid,
  overdueDaysHint,
  onPressViewAll,
}) => {
  const activeMembers = useMemo(
    () => members.filter((m) => m.membershipStatus === 'ACTIVE'),
    [members]
  );

  const { paidCount, pendingCount, sorted, totalCount } = useMemo(() => {
    const total = activeMembers.length;
    let paid = 0;
    for (const m of activeMembers) {
      if (isPaidCycleStatus(m.currentCyclePaymentStatus as string | null)) {
        paid += 1;
      }
    }
    const pending = Math.max(0, total - paid);
    const sortedInner = [...activeMembers].sort((a, b) => {
      const ap = isPaidCycleStatus(a.currentCyclePaymentStatus as string | null);
      const bp = isPaidCycleStatus(b.currentCyclePaymentStatus as string | null);
      if (ap !== bp) return ap ? 1 : -1;
      return a.fullName.localeCompare(b.fullName, 'fr');
    });
    return {
      paidCount: paid,
      pendingCount: pending,
      sorted: sortedInner,
      totalCount: total,
    };
  }, [activeMembers]);

  const displayRows = sorted.slice(0, 3);
  const rest = Math.max(0, sorted.length - 3);

  const overdueHint =
    overdueDaysHint != null && overdueDaysHint > 0 ? overdueDaysHint : null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Statut des cotisations</Text>
        <Text style={styles.headerMeta}>
          {paidCount} / {totalCount} membres
        </Text>
      </View>

      <View style={styles.countsRow}>
        <View style={[styles.countCell, styles.countCellLeft]}>
          <Text style={styles.countNumPrimary}>{paidCount}</Text>
          <Text style={styles.countLbl}>Ont payé</Text>
        </View>
        <View style={styles.countCell}>
          <Text
            style={[
              styles.countNumSecondary,
              pendingCount > 0 ? styles.countNumDanger : styles.countNumMuted,
            ]}
          >
            {pendingCount}
          </Text>
          <Text style={styles.countLbl}>N&apos;ont pas payé</Text>
        </View>
      </View>

      {displayRows.map((m, index) => {
        const isLast = index === displayRows.length - 1;
        const isBen =
          beneficiaryMembershipUid != null &&
          beneficiaryMembershipUid !== '' &&
          m.uid === beneficiaryMembershipUid;
        const raw = m.currentCyclePaymentStatus as string | null | undefined;
        const { kind, overdueDays } = resolveUiKind(raw, overdueHint);
        const subtitle =
          m.memberRole === 'CREATOR'
            ? `Créatrice · ${m.sharesCount} part(s)${isBen ? ' · Bénéficiaire' : ''}`
            : `${m.sharesCount} part(s)${isBen ? ' · Bénéficiaire' : ''}`;
        return (
          <View
            key={m.uid}
            style={[styles.memberRow, isLast ? styles.memberRowLast : null]}
          >
            <View
              style={[
                styles.avatar,
                { backgroundColor: hashToColor(m.fullName) },
              ]}
            >
              <Text style={styles.avatarTxt}>{getInitials(m.fullName)}</Text>
            </View>
            <View style={styles.mid}>
              <Text style={styles.name} numberOfLines={1}>
                {m.fullName}
              </Text>
              <Text style={styles.sub} numberOfLines={2}>
                {subtitle}
              </Text>
            </View>
            <PaymentBadge kind={kind} overdueDays={overdueDays} />
          </View>
        );
      })}

      {rest > 0 && onPressViewAll ? (
        <Pressable
          onPress={onPressViewAll}
          style={styles.viewAll}
          accessibilityRole="button"
          accessibilityLabel={`Voir les ${rest} autres membres`}
        >
          <Text style={styles.viewAllText}>Voir les {rest} autres membres →</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    overflow: 'hidden',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.gray200,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  headerMeta: { fontSize: 11, color: COLORS.gray500 },
  countsRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.gray100,
  },
  countCell: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  countCellLeft: {
    borderRightWidth: 0.5,
    borderRightColor: COLORS.gray100,
  },
  countNumPrimary: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.primary,
    textAlign: 'center',
  },
  countNumSecondary: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  countNumDanger: { color: COLORS.dangerText },
  countNumMuted: { color: COLORS.gray500 },
  countLbl: {
    fontSize: 9,
    color: COLORS.gray500,
    marginTop: 2,
    textAlign: 'center',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.gray100,
  },
  memberRowLast: { borderBottomWidth: 0 },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { fontSize: 11, fontWeight: '600', color: COLORS.white },
  mid: { flex: 1, minWidth: 0 },
  name: { fontSize: 12, fontWeight: '500', color: COLORS.textPrimary },
  sub: { fontSize: 10, color: COLORS.gray500, marginTop: 2 },
  badge: {
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 8,
    maxWidth: '42%',
  },
  badgeText: { fontSize: 9, fontWeight: '500', textAlign: 'center' },
  badgePaid: { backgroundColor: COLORS.primaryLight },
  badgeTextPaid: { color: COLORS.primaryDark },
  badgeOverdue: { backgroundColor: COLORS.dangerLight },
  badgeTextOverdue: { color: COLORS.dangerText },
  badgeDue: { backgroundColor: COLORS.secondaryBg },
  badgeTextDue: { color: COLORS.secondaryText },
  badgeProcessing: { backgroundColor: COLORS.accentLight },
  badgeTextProcessing: { color: COLORS.accentDark },
  viewAll: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.gray100,
  },
  viewAllText: {
    fontSize: 11,
    color: COLORS.primary,
    textAlign: 'center',
    fontWeight: '500',
  },
});
