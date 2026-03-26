/**
 * Accueil — planning de passage (versement cagnotte), sans mélange avec cotisations.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation, type TFunction } from 'react-i18next';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { isMembershipPending } from '@/utils/tontineMerge';
import type { TontineListItem } from '@/types/tontine';
import type { TontineRotationResponse } from '@/types/rotation';
import { deriveHomePayoutFromRotation } from '@/utils/homePayoutScheduleFromRotation';
import { deriveSavingsHomeRowVm, type SavingsHomeRowStatusKey } from '@/utils/homeSavingsRowViewModel';
import { formatFcfa } from '@/utils/formatters';

const KELEMBA = '#1A6B3C';
/** Aligné avec le dashboard : nombre de cartes + requêtes rotation associées */
export const HOME_PAYOUT_SCHEDULE_PREVIEW_LIMIT = 3;
const DISPLAY_LIMIT = HOME_PAYOUT_SCHEDULE_PREVIEW_LIMIT;

const POT_RECEIVED_GREEN = '#15803D';
const POT_RECEIVED_BADGE_BG = '#DCFCE7';
const POT_RECEIVED_BADGE_FG = '#166534';

function parseScheduleDayStartMs(iso: string | null | undefined): number | null {
  if (iso == null || iso === '') return null;
  const part = iso.split('T')[0];
  const parts = part.split('-').map(Number);
  if (parts.length < 3) return null;
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.getTime();
}

function formatPayoutScheduleDate(iso: string | null | undefined): string | null {
  if (iso == null || iso === '') return null;
  const safe = iso.includes('T') ? iso : `${iso}T12:00:00`;
  const d = new Date(safe);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function resolveTourNumber(item: TontineListItem): number | null {
  const payout = item.myPayoutCycleNumber;
  if (typeof payout === 'number' && Number.isFinite(payout)) return Math.round(payout);
  const rot = item.myRotationOrder;
  if (typeof rot === 'number' && Number.isFinite(rot)) return Math.round(rot);
  return null;
}

type MicroKind =
  | 'today'
  | 'in_progress'
  | 'upcoming'
  | 'unavailable'
  | 'pot_all_received';

function resolveMicroStatus(
  isMyTurnNow: boolean,
  dateDayMs: number | null
): MicroKind {
  if (isMyTurnNow) return 'in_progress';
  if (dateDayMs == null) return 'unavailable';
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (dateDayMs === t0) return 'today';
  if (dateDayMs < t0) return 'in_progress';
  return 'upcoming';
}

function microStyle(kind: MicroKind): { bg: string; fg: string } {
  switch (kind) {
    case 'today':
      return { bg: '#FFFBEB', fg: '#92400E' };
    case 'in_progress':
      return { bg: '#ECFDF5', fg: KELEMBA };
    case 'upcoming':
      return { bg: '#F3F4F6', fg: '#4B5563' };
    case 'pot_all_received':
      return { bg: POT_RECEIVED_BADGE_BG, fg: POT_RECEIVED_BADGE_FG };
    default:
      return { bg: '#F9FAFB', fg: '#6B7280' };
  }
}

export type HomePayoutRotationSlot = {
  data?: TontineRotationResponse;
  isLoading: boolean;
  isError: boolean;
};

function formatScheduleDate(iso: string | null | undefined): string | null {
  if (iso == null || iso === '') return null;
  const safe = iso.includes('T') ? iso : `${iso}T12:00:00`;
  const d = new Date(safe);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function savingsStatusMicro(
  key: SavingsHomeRowStatusKey
): { bg: string; fg: string } {
  switch (key) {
    case 'late':
      return { bg: '#FEE2E2', fg: '#991B1B' };
    case 'suspended':
      return { bg: '#FEF3C7', fg: '#92400E' };
    case 'unlocked':
      return { bg: '#DCFCE7', fg: '#166534' };
    default:
      return { bg: '#ECFDF5', fg: KELEMBA };
  }
}

function HomeSavingsActiveCard({
  item,
  pending,
  onPress,
  t,
}: {
  item: TontineListItem;
  pending: boolean;
  onPress: () => void;
  t: TFunction;
}) {
  const vm = deriveSavingsHomeRowVm(item);
  const nextLabel =
    formatScheduleDate(vm.nextDueIso) ??
    t('dashboard.homeScheduleDateUnavailable', 'Date indisponible');
  const unlockLabel =
    vm.unlockIso != null && vm.unlockIso !== ''
      ? formatScheduleDate(vm.unlockIso) ??
        t('dashboard.homeScheduleDateUnavailable', 'Date indisponible')
      : t('dashboard.homeSavingsUnlockUnknown', '—');
  const statusLabel =
    vm.statusKey === 'suspended'
      ? t('dashboard.homeSavingsStatusSuspended', 'Suspendu')
      : vm.statusKey === 'unlocked'
        ? t('dashboard.homeSavingsStatusUnlocked', 'Débloquée')
        : vm.statusKey === 'late'
          ? t('dashboard.homeSavingsStatusLate', 'En retard')
          : t('dashboard.homeSavingsStatusUpToDate', 'À jour');
  const mStyle = savingsStatusMicro(vm.statusKey);

  const a11y = `${item.name}. ${statusLabel}. ${nextLabel}`;

  return (
    <Pressable
      onPress={() => {
        if (pending) return;
        onPress();
      }}
      disabled={pending}
      style={({ pressed }) => [
        styles.card,
        styles.cardSavings,
        pending && styles.cardPending,
        pressed && !pending && styles.cardPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: pending }}
    >
      <View style={styles.cardHeaderRow}>
        <Text style={[styles.tontineName, pending && styles.textMuted]} numberOfLines={2}>
          {item.name}
        </Text>
        <View style={[styles.roleBadge, styles.roleSavings]}>
          <Text style={styles.roleBadgeText}>{t('dashboard.homeSavingsTypePill', 'Épargne')}</Text>
        </View>
      </View>

      <Text style={styles.savingsLineLabel}>
        {t('dashboard.homeSavingsNextDueLabel', 'Prochain versement')}
      </Text>
      <Text style={styles.dateValue}>{nextLabel}</Text>
      <Text style={styles.savingsMinHint}>
        {t('dashboard.homeSavingsMinHint', 'Minimum : {{amount}}', {
          amount: formatFcfa(vm.minAmount),
        })}
      </Text>

      <Text style={styles.savingsLineLabel}>
        {t('dashboard.homeSavingsUnlockLabel', 'Déblocage du capital')}
      </Text>
      <Text style={[styles.dateValue, styles.savingsUnlockValue]}>{unlockLabel}</Text>

      <View style={[styles.microBadge, { backgroundColor: mStyle.bg }]}>
        <Text style={[styles.microText, { color: mStyle.fg }]}>{statusLabel}</Text>
      </View>
    </Pressable>
  );
}

export interface HomePayoutScheduleSectionProps {
  tontines: TontineListItem[];
  isLoading: boolean;
  onPressTontine: (item: TontineListItem) => void;
  onSeeAllPress: () => void;
  /** Cache partagé `['tontineRotation', uid]` — uniquement pour les UIDs du preview */
  payoutRotationByUid?: Record<string, HomePayoutRotationSlot | undefined>;
}

export const HomePayoutScheduleSection: React.FC<HomePayoutScheduleSectionProps> = ({
  tontines,
  isLoading,
  onPressTontine,
  onSeeAllPress,
  payoutRotationByUid,
}) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('dashboard.homeActiveTontinesTitle', 'Mes tontines actives')}</Text>
        </View>
        <View style={styles.listVertical}>
          <SkeletonBlock width="100%" height={108} borderRadius={16} />
          <SkeletonBlock width="100%" height={108} borderRadius={16} />
          <SkeletonBlock width="100%" height={108} borderRadius={16} />
        </View>
      </View>
    );
  }

  const isEmpty = tontines.length === 0;
  const preview = tontines.slice(0, DISPLAY_LIMIT);

  return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('dashboard.homeActiveTontinesTitle', 'Mes tontines actives')}</Text>
        <Pressable onPress={onSeeAllPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('dashboard.homeScheduleSeeAll')}>
          <Text style={styles.seeAll}>{t('dashboard.homeScheduleSeeAll')}</Text>
        </Pressable>
      </View>
      <View style={styles.listVertical}>
        {isEmpty ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t('dashboard.homeScheduleEmpty')}</Text>
          </View>
        ) : (
          preview.map((item) => {
            const pending = isMembershipPending(item);
            if (item.type === 'EPARGNE') {
              return (
                <HomeSavingsActiveCard
                  key={item.uid}
                  item={item}
                  pending={pending}
                  onPress={() => onPressTontine(item)}
                  t={t}
                />
              );
            }
            const isOrg = item.membershipRole === 'CREATOR' || item.isCreator === true;
            const rotSlot = payoutRotationByUid?.[item.uid];
            const useRotationApi = item.type !== 'EPARGNE';
            const rotationDerived =
              useRotationApi &&
              rotSlot &&
              !rotSlot.isLoading &&
              !rotSlot.isError &&
              rotSlot.data != null
                ? deriveHomePayoutFromRotation(rotSlot.data)
                : null;

            let tour = resolveTourNumber(item);
            let payoutDateRaw = item.myScheduledPayoutDate ?? null;
            let dateDayMs = parseScheduleDayStartMs(payoutDateRaw);
            let dateLabel =
              payoutDateRaw != null && payoutDateRaw !== ''
                ? formatPayoutScheduleDate(payoutDateRaw)
                : null;
            let isMyTurnNow = item.isMyTurnNow === true;
            let micro: MicroKind;

            if (rotationDerived?.kind === 'all_beneficiary_turns_done') {
              micro = 'pot_all_received';
              dateLabel = t('dashboard.homeSchedulePotAlreadyReceived');
              payoutDateRaw = null;
              dateDayMs = null;
            } else if (rotationDerived?.kind === 'next_beneficiary_turn') {
              payoutDateRaw = rotationDerived.expectedDateIso;
              dateDayMs = parseScheduleDayStartMs(rotationDerived.expectedDateIso);
              dateLabel = formatPayoutScheduleDate(rotationDerived.expectedDateIso);
              isMyTurnNow = rotationDerived.isMyTurnNow;
              tour = rotationDerived.beneficiaryCycleNumber;
              micro = resolveMicroStatus(isMyTurnNow, dateDayMs);
            } else {
              micro = resolveMicroStatus(isMyTurnNow, dateDayMs);
            }

            const mStyle = microStyle(micro);
            const passageLine =
              tour != null
                ? t('dashboard.homeSchedulePassage', { tour })
                : t('dashboard.homeSchedulePassageUnknown');
            const microLabel =
              micro === 'pot_all_received'
                ? t('dashboard.homeSchedulePotAlreadyReceivedBadge')
                : micro === 'today'
                  ? t('dashboard.homeScheduleStatusToday')
                  : micro === 'in_progress'
                    ? t('dashboard.homeScheduleStatusInProgress')
                    : micro === 'upcoming'
                      ? t('dashboard.homeScheduleStatusUpcoming')
                      : t('dashboard.homeScheduleStatusNoDate');

            const a11y = `${item.name}. ${passageLine}. ${
              dateLabel ?? t('dashboard.homeScheduleDateUnavailable')
            }`;

            return (
              <Pressable
                key={item.uid}
                onPress={() => {
                  if (pending) return;
                  onPressTontine(item);
                }}
                disabled={pending}
                style={({ pressed }) => [
                  styles.card,
                  pending && styles.cardPending,
                  pressed && !pending && styles.cardPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={a11y}
                accessibilityState={{ disabled: pending }}
              >
                <View style={styles.cardHeaderRow}>
                  <Text style={[styles.tontineName, pending && styles.textMuted]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <View style={[styles.roleBadge, isOrg ? styles.roleOrg : styles.roleMem]}>
                    <Text style={styles.roleBadgeText}>
                      {isOrg
                        ? t('dashboard.homeScheduleRoleOrganizer')
                        : t('dashboard.homeScheduleRoleMember')}
                    </Text>
                  </View>
                </View>
                <View style={styles.tourRow}>
                  <View style={styles.tourPill}>
                    <Text style={styles.tourPillText}>{passageLine}</Text>
                  </View>
                </View>
                <Text style={styles.dateLabel}>{t('dashboard.homeSchedulePayoutDateLabel')}</Text>
                <Text
                  style={[
                    styles.dateValue,
                    micro === 'pot_all_received' && styles.dateValuePotReceived,
                  ]}
                >
                  {dateLabel ?? t('dashboard.homeScheduleDateUnavailable')}
                </Text>
                <View style={[styles.microBadge, { backgroundColor: mStyle.bg }]}>
                  <Text style={[styles.microText, { color: mStyle.fg }]}>{microLabel}</Text>
                </View>
              </Pressable>
            );
          })
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  seeAll: {
    color: KELEMBA,
    fontWeight: '600',
    fontSize: 14,
  },
  listVertical: {
    paddingHorizontal: 20,
    gap: 12,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  cardSavings: {
    backgroundColor: '#F8FAFC',
    borderColor: '#BFDBFE',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    minHeight: 48,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardPressed: {
    opacity: 0.96,
    transform: [{ scale: 0.995 }],
  },
  cardPending: {
    opacity: 0.55,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  tontineName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.2,
  },
  textMuted: {
    color: '#9CA3AF',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleOrg: {
    backgroundColor: '#DCFCE7',
  },
  roleMem: {
    backgroundColor: '#EEF2FF',
  },
  roleSavings: {
    backgroundColor: '#DBEAFE',
  },
  savingsLineLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  savingsMinHint: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 12,
  },
  savingsUnlockValue: {
    fontSize: 18,
    marginBottom: 10,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  tourRow: {
    marginBottom: 12,
  },
  tourPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  tourPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: KELEMBA,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  dateValuePotReceived: {
    color: POT_RECEIVED_GREEN,
    fontSize: 18,
    fontWeight: '800',
  },
  microBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  microText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
