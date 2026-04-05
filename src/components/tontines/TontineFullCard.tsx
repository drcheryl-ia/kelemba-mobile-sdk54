import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type DimensionValue,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { KelembaBadge } from '@/components/common/KelembaBadge';
import type { TontineListItem } from '@/types/tontine';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';
import { formatFcfaAmount } from '@/utils/formatters';
import {
  canShowOrganizerPayoutFromListItem,
  listItemCollectionProgressPercent,
} from '@/utils/cyclePayoutEligibility';
import {
  deriveTontinePaymentUiState,
  resolveTontinePaymentContext,
  type TontinePaymentUiState,
} from '@/utils/tontinePaymentState';
import { freqShort } from '@/utils/tontineFrequencyShort';

const borderConfig: Record<
  string,
  { borderColor: string; accentColor: string }
> = {
  ACTIVE_PAID: { borderColor: '#1A6B3C', accentColor: '#1A6B3C' },
  ACTIVE_DUE: { borderColor: '#F5A623', accentColor: '#F5A623' },
  ACTIVE_OVERDUE: { borderColor: '#D0021B', accentColor: '#D0021B' },
  DRAFT: { borderColor: '#F5A623', accentColor: '#F5A623' },
  PENDING: { borderColor: '#D3D1C7', accentColor: '#D3D1C7' },
  COMPLETED: { borderColor: '#B4B2A9', accentColor: '#B4B2A9' },
  BETWEEN_ROUNDS: { borderColor: '#0055A5', accentColor: '#0055A5' },
  DEFAULT: { borderColor: '#D3D1C7', accentColor: '#D3D1C7' },
};

function getBorderKey(
  item: TontineListItem,
  ui: TontinePaymentUiState
): keyof typeof borderConfig {
  if (item.status === 'DRAFT') return 'DRAFT';
  if (item.membershipStatus === 'PENDING') return 'PENDING';
  if (item.status === 'COMPLETED') return 'COMPLETED';
  if (item.status === 'BETWEEN_ROUNDS') return 'BETWEEN_ROUNDS';
  if (item.status === 'ACTIVE') {
    const ps = item.currentCyclePaymentStatus as string | null | undefined;
    if (ps === 'OVERDUE' || ui.uiStatus === 'OVERDUE') return 'ACTIVE_OVERDUE';
    if (
      ps === 'DUE' ||
      ui.needsPaymentAttention ||
      ui.uiStatus === 'DUE_TODAY' ||
      ui.uiStatus === 'DUE_SOON'
    ) {
      return 'ACTIVE_DUE';
    }
    return 'ACTIVE_PAID';
  }
  return 'DEFAULT';
}

function toProgressPct(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0;
  return Math.min(100, Math.max(0, Math.round(fraction * 100)));
}

export interface TontineFullCardProps {
  item: TontineListItem;
  onPress: () => void;
  onActionPayment: () => void;
  onActionRotation: () => void;
  onActionMembers: () => void;
  onActionShare: () => void;
  onActionReport: () => void;
  onActionActivate: () => void;
  /** Créatrice · versement cagnotte — navigation vers le détail (PIN). */
  onActionPayoutTrigger?: () => void;
  /** @deprecated utiliser onActionPayoutTrigger */
  onActionOrganizerPayout?: () => void;
  /** BETWEEN_ROUNDS · créatrice — lancer la rotation suivante. */
  onActionLaunchRotation?: () => void;
  /** Tontine COMPLETED — rapport final. */
  onActionFinalReport?: () => void;
  /** Tontine COMPLETED — certificat PDF. */
  onActionCertificate?: () => void;
}

function isCreatorRole(item: TontineListItem): boolean {
  return item.isCreator === true || item.membershipRole === 'CREATOR';
}

function isActiveLike(item: TontineListItem): boolean {
  return item.status === 'ACTIVE' || item.status === 'BETWEEN_ROUNDS';
}

function formatDraftStart(iso: string | undefined): string {
  if (iso == null || iso === '') return '—';
  const ymd = String(iso).split('T')[0];
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function IconInfo({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 16v-4M12 8h.01M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

type StripBtn = {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};

export const TontineFullCard: React.FC<TontineFullCardProps> = ({
  item,
  onPress,
  onActionPayment,
  onActionRotation,
  onActionMembers,
  onActionShare,
  onActionReport,
  onActionActivate,
  onActionPayoutTrigger,
  onActionOrganizerPayout,
  onActionLaunchRotation,
  onActionFinalReport,
  onActionCertificate,
}) => {
  const ui = deriveTontinePaymentUiState(item);
  const creator = isCreatorRole(item);
  const activeLike = isActiveLike(item);
  const paymentCtx = useMemo(() => resolveTontinePaymentContext(item), [item]);

  const borderKey = getBorderKey(item, ui);
  const config = borderConfig[borderKey] ?? borderConfig.DEFAULT;

  const payoutHandler = onActionPayoutTrigger ?? onActionOrganizerPayout;

  const badge = useMemo(() => {
    if (item.status === 'DRAFT') {
      return { variant: 'draft' as const, label: 'Brouillon' };
    }
    if (item.status === 'COMPLETED') {
      return { variant: 'completed' as const, label: 'Terminée' };
    }
    if (!activeLike) {
      return { variant: 'pending' as const, label: item.status };
    }
    if (ui.uiStatus === 'OVERDUE') {
      return { variant: 'danger' as const, label: 'En retard' };
    }
    if (
      ui.needsPaymentAttention ||
      ui.uiStatus === 'DUE_TODAY' ||
      ui.uiStatus === 'DUE_SOON'
    ) {
      return { variant: 'draft' as const, label: 'Paiement dû' };
    }
    return { variant: 'active' as const, label: 'Active' };
  }, [activeLike, item.status, ui.needsPaymentAttention, ui.uiStatus]);

  const totalCycles = Math.max(1, item.totalCycles ?? 1);
  const currentCycle = item.currentCycleNumber ?? item.currentCycle ?? 0;
  const memberCount = item.activeMemberCount ?? 0;
  const shares = Math.max(1, item.userSharesCount ?? 1);
  const partTotal = (item.amountPerShare ?? 0) * shares;
  const amountDueLabel = formatFcfaAmount(Math.round(paymentCtx.totalDue ?? partTotal));
  const freqLabel = freqShort(item.frequency);
  const partLabel = freqLabel ? `Part ${freqLabel}` : 'Part';

  const collectionPct = listItemCollectionProgressPercent(item);
  const showCollectBar =
    item.status !== 'COMPLETED' &&
    activeLike &&
    currentCycle > 0 &&
    collectionPct != null;

  const totalVerséDisplay = useMemo(() => {
    const s = item.savingsTotalSaved;
    if (s != null && Number.isFinite(s)) {
      return `${formatFcfaAmount(Math.round(s))} FCFA`;
    }
    const m = item.memberTotalContributed;
    if (m != null && Number.isFinite(m)) {
      return `${formatFcfaAmount(Math.round(m))} FCFA`;
    }
    return '—';
  }, [item.memberTotalContributed, item.savingsTotalSaved]);

  const punctDisplay = useMemo(() => {
    const p = item.tontinePunctualityRate;
    if (p != null && Number.isFinite(p)) {
      return `${Math.round(p)} %`;
    }
    return '—';
  }, [item.tontinePunctualityRate]);

  const isPaymentDueRow =
    item.status === 'ACTIVE' &&
    (ui.needsPaymentAttention ||
      ui.uiStatus === 'OVERDUE' ||
      ui.uiStatus === 'DUE_TODAY' ||
      ui.uiStatus === 'DUE_SOON');

  const showCagnotte =
    creator &&
    item.status === 'ACTIVE' &&
    !isPaymentDueRow &&
    (canShowOrganizerPayoutFromListItem(item) || item.canTriggerPayout === true);

  const payDays = useMemo(() => {
    if (ui.uiStatus === 'OVERDUE') {
      return Math.max(0, Math.round(ui.daysOverdue ?? 0));
    }
    return Math.max(0, Math.round(ui.daysLeft ?? 0));
  }, [ui.daysLeft, ui.daysOverdue, ui.uiStatus]);

  const stripButtons: StripBtn[] = useMemo(() => {
    if (item.status === 'DRAFT') return [];

    if (item.status === 'COMPLETED') {
      return [
        {
          key: 'final',
          label: 'Rapport final',
          color: COLORS.primary,
          icon: (
            <Ionicons
              name="document-text-outline"
              size={14}
              color={COLORS.primary}
            />
          ),
          onPress: onActionFinalReport ?? onActionReport,
          accessibilityLabel: `Rapport final de la tontine ${item.name}`,
        },
        {
          key: 'cert',
          label: 'Certificat',
          color: COLORS.gray500,
          icon: (
            <Ionicons name="ribbon-outline" size={14} color={COLORS.gray500} />
          ),
          onPress: onActionCertificate,
          accessibilityLabel: `Télécharger le certificat pour ${item.name}`,
        },
      ];
    }

    if (item.status === 'BETWEEN_ROUNDS') {
      if (creator) {
        return [
          {
            key: 'launch',
            label: 'Lancer rotation',
            color: COLORS.accent,
            icon: (
              <Ionicons name="play-circle-outline" size={14} color={COLORS.accent} />
            ),
            onPress: onActionLaunchRotation,
            accessibilityLabel: `Lancer la rotation pour ${item.name}`,
          },
          {
            key: 'mem',
            label: 'Membres',
            color: COLORS.gray500,
            icon: (
              <Ionicons name="people-outline" size={14} color={COLORS.gray500} />
            ),
            onPress: onActionMembers,
            accessibilityLabel: `Voir les membres de ${item.name}`,
          },
          {
            key: 'share',
            label: 'Partager',
            color: COLORS.gray500,
            icon: (
              <Ionicons name="share-outline" size={14} color={COLORS.gray500} />
            ),
            onPress: onActionShare,
            accessibilityLabel: `Partager le lien d'invitation pour ${item.name}`,
          },
        ];
      }
      return [
        {
          key: 'rot',
          label: 'Rotation',
          color: COLORS.primary,
          icon: (
            <Ionicons name="time-outline" size={14} color={COLORS.primary} />
          ),
          onPress: onActionRotation,
          accessibilityLabel: `Voir la rotation de ${item.name}`,
        },
        {
          key: 'rep',
          label: 'Rapport',
          color: COLORS.gray500,
          icon: (
            <Ionicons
              name="document-text-outline"
              size={14}
              color={COLORS.gray500}
            />
          ),
          onPress: onActionReport,
          accessibilityLabel: `Voir les paiements et le rapport pour ${item.name}`,
        },
        {
          key: 'share',
          label: 'Partager',
          color: COLORS.gray500,
          icon: (
            <Ionicons name="share-outline" size={14} color={COLORS.gray500} />
          ),
          onPress: onActionShare,
          accessibilityLabel: `Partager le lien d'invitation pour ${item.name}`,
        },
      ];
    }

    if (!activeLike || item.status !== 'ACTIVE') return [];

    if (isPaymentDueRow) {
      const payColor =
        ui.uiStatus === 'OVERDUE' ? COLORS.dangerText : COLORS.secondaryText;
      const payA11y = `Payer la cotisation de ${amountDueLabel} FCFA pour ${item.name}`;
      const base = [
        {
          key: 'pay',
          label: `Payer · ${payDays} j`,
          color: payColor,
          icon: (
            <Ionicons name="card-outline" size={14} color={payColor} />
          ),
          onPress: onActionPayment,
          accessibilityLabel: payA11y,
        },
        {
          key: 'rot',
          label: 'Rotation',
          color: COLORS.primary,
          icon: (
            <Ionicons name="time-outline" size={14} color={COLORS.primary} />
          ),
          onPress: onActionRotation,
          accessibilityLabel: `Voir la rotation de ${item.name}`,
        },
      ];
      if (creator) {
        base.push(
          {
            key: 'mem',
            label: 'Membres',
            color: COLORS.gray500,
            icon: (
              <Ionicons name="people-outline" size={14} color={COLORS.gray500} />
            ),
            onPress: onActionMembers,
            accessibilityLabel: `Voir les membres de ${item.name}`,
          },
          {
            key: 'share',
            label: 'Partager',
            color: COLORS.gray500,
            icon: (
              <Ionicons name="share-outline" size={14} color={COLORS.gray500} />
            ),
            onPress: onActionShare,
            accessibilityLabel: `Partager le lien d'invitation pour ${item.name}`,
          }
        );
      } else {
        base.push({
          key: 'share',
          label: 'Partager',
          color: COLORS.gray500,
          icon: (
            <Ionicons name="share-outline" size={14} color={COLORS.gray500} />
          ),
          onPress: onActionShare,
          accessibilityLabel: `Partager le lien d'invitation pour ${item.name}`,
        });
      }
      return base;
    }

    if (creator) {
      const row: StripBtn[] = [];
      if (showCagnotte && payoutHandler != null) {
        row.push({
          key: 'wallet',
          label: 'Payer cagnotte',
          color: COLORS.accent,
          icon: (
            <Ionicons name="wallet-outline" size={14} color={COLORS.accent} />
          ),
          onPress: payoutHandler,
          accessibilityLabel: `Payer la cagnotte pour ${item.name}`,
        });
      }
      row.push(
        {
          key: 'rot',
          label: 'Rotation',
          color: COLORS.primary,
          icon: (
            <Ionicons name="time-outline" size={14} color={COLORS.primary} />
          ),
          onPress: onActionRotation,
          accessibilityLabel: `Voir la rotation de ${item.name}`,
        },
        {
          key: 'mem',
          label: 'Membres',
          color: COLORS.gray500,
          icon: (
            <Ionicons name="people-outline" size={14} color={COLORS.gray500} />
          ),
          onPress: onActionMembers,
          accessibilityLabel: `Voir les membres de ${item.name}`,
        },
        {
          key: 'share',
          label: 'Partager',
          color: COLORS.gray500,
          icon: (
            <Ionicons name="share-outline" size={14} color={COLORS.gray500} />
          ),
          onPress: onActionShare,
          accessibilityLabel: `Partager le lien d'invitation pour ${item.name}`,
        }
      );
      return row;
    }

    return [
      {
        key: 'rot',
        label: 'Rotation',
        color: COLORS.primary,
        icon: (
          <Ionicons name="time-outline" size={14} color={COLORS.primary} />
        ),
        onPress: onActionRotation,
        accessibilityLabel: `Voir la rotation de ${item.name}`,
      },
      {
        key: 'rep',
        label: 'Rapport',
        color: COLORS.gray500,
        icon: (
          <Ionicons
            name="document-text-outline"
            size={14}
            color={COLORS.gray500}
          />
        ),
        onPress: onActionReport,
        accessibilityLabel: `Voir les paiements et le rapport pour ${item.name}`,
      },
      {
        key: 'share',
        label: 'Partager',
        color: COLORS.gray500,
        icon: (
          <Ionicons name="share-outline" size={14} color={COLORS.gray500} />
        ),
        onPress: onActionShare,
        accessibilityLabel: `Partager le lien d'invitation pour ${item.name}`,
      },
    ];
  }, [
    activeLike,
    amountDueLabel,
    creator,
    isPaymentDueRow,
    item.name,
    item.status,
    onActionCertificate,
    onActionFinalReport,
    payoutHandler,
    onActionMembers,
    onActionPayment,
    onActionReport,
    onActionRotation,
    onActionShare,
    onActionLaunchRotation,
    payDays,
    showCagnotte,
    ui.uiStatus,
  ]);

  const cell2 = useMemo(() => {
    if (item.status === 'DRAFT') {
      return {
        label: 'Membres actifs',
        value: `${memberCount} / ${totalCycles}`,
      };
    }
    return {
      label: 'Cycle en cours',
      value: `${currentCycle} / ${totalCycles}`,
    };
  }, [currentCycle, item.status, memberCount, totalCycles]);

  const cell3 = useMemo(() => {
    if (item.status === 'DRAFT') {
      return {
        label: 'Démarrage prévu',
        value: formatDraftStart(item.startDate),
        valueColor: COLORS.textPrimary as string,
      };
    }
    if (item.isMyTurnNow === true) {
      return {
        label: 'Mon tour',
        value: 'En cours !',
        valueColor: COLORS.primary as string,
      };
    }
    if (item.myPayoutCycleNumber != null) {
      return {
        label: 'Mon tour',
        value: `Cycle ${item.myPayoutCycleNumber}`,
        valueColor: COLORS.secondaryText as string,
      };
    }
    return {
      label: 'Mon tour',
      value: '—',
      valueColor: COLORS.gray500 as string,
    };
  }, [item]);

  const rolePill = creator ? (
    <View style={[styles.pill, { backgroundColor: COLORS.accentLight }]}>
      <Ionicons name="star" size={10} color={COLORS.accentDark} />
      <Text style={[styles.pillText, { color: COLORS.accentDark }]}>
        {`Créatrice · ${memberCount} membres`}
      </Text>
    </View>
  ) : (
    <View style={[styles.pill, { backgroundColor: COLORS.primaryLight }]}>
      <Ionicons name="person" size={10} color={COLORS.primaryDark} />
      <Text style={[styles.pillText, { color: COLORS.primaryDark }]}>
        {`Membre · ${memberCount} membres`}
      </Text>
    </View>
  );

  const fillWidth =
    collectionPct != null ? `${toProgressPct(collectionPct)}%` : '0%';

  const draftRemaining = Math.max(0, totalCycles - memberCount);

  const cardA11yLabel = `${item.name}, ${badge.label}, ${formatFcfaAmount(
    Math.round(item.amountPerShare ?? 0)
  )} FCFA par part, cycle ${currentCycle} sur ${totalCycles}`;

  const completedOpacity = item.status === 'COMPLETED' ? 0.8 : 1;

  return (
    <View
      style={[
        styles.cardOuter,
        {
          borderColor: config.borderColor,
          opacity: completedOpacity,
        },
        item.status === 'COMPLETED' && styles.cardOuterCompleted,
      ]}
    >
      <View style={[styles.accentStripe, { backgroundColor: config.accentColor }]} />

      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.mainPressable, pressed && styles.cardPressed]}
        accessibilityRole="button"
        accessibilityLabel={cardA11yLabel}
      >
        <View style={styles.main}>
          <View style={styles.headerRow}>
            <Text style={styles.title} numberOfLines={2}>
              {item.name}
            </Text>
            <View style={styles.headerRight}>
              {item.isMyTurnNow === true && item.status !== 'COMPLETED' ? (
                <View style={styles.myTurnBadge}>
                  <Text style={styles.myTurnBadgeText}>MON TOUR</Text>
                </View>
              ) : null}
              <KelembaBadge variant={badge.variant} label={badge.label} />
            </View>
          </View>

          {item.status === 'COMPLETED' ? (
            <View style={styles.completedBlock}>
              <Text style={styles.completedHint}>
                {memberCount} membre{memberCount > 1 ? 's' : ''} · {totalCycles} cycle
                {totalCycles > 1 ? 's' : ''}
              </Text>
              <Text style={styles.completedLine}>
                Durée · {totalCycles} cycle{totalCycles > 1 ? 's' : ''}
              </Text>
              <Text style={styles.completedLine}>Total versé · {totalVerséDisplay}</Text>
              <Text style={styles.completedLine}>Ponctualité · {punctDisplay}</Text>
            </View>
          ) : (
            <>
              {rolePill}

              <View style={styles.metricsGrid}>
                <View style={styles.metricCell}>
                  <Text style={styles.metricLabel}>{partLabel}</Text>
                  <Text style={styles.metricValuePrimary}>
                    {formatFcfaAmount(Math.round(partTotal))} FCFA
                    {shares > 1 ? (
                      <Text style={styles.metricSuffix}> {` (×${shares})`}</Text>
                    ) : null}
                  </Text>
                </View>
                <View style={styles.metricVsep} />
                <View style={styles.metricCell}>
                  <Text style={styles.metricLabel}>{cell2.label}</Text>
                  <Text style={styles.metricValue}>{cell2.value}</Text>
                </View>
                <View style={styles.metricVsep} />
                <View style={styles.metricCell}>
                  <Text style={styles.metricLabel}>{cell3.label}</Text>
                  <Text style={[styles.metricValue, { color: cell3.valueColor }]}>
                    {cell3.value}
                  </Text>
                </View>
              </View>
            </>
          )}

          {showCollectBar ? (
            <View style={styles.collectRow}>
              <View style={styles.track}>
                <View
                  style={[styles.fill, { width: fillWidth as DimensionValue }]}
                />
              </View>
              <Text style={styles.collectLabel}>
                Collecte {collectionPct != null ? toProgressPct(collectionPct) : 0}%
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      {item.status === 'DRAFT' ? (
        <View style={styles.draftBanner}>
          <IconInfo color={COLORS.secondaryText} />
          <Text style={styles.draftBannerText}>
            {memberCount} membres sur {totalCycles} — En attente de {draftRemaining} pour
            activer
          </Text>
          <Pressable
            onPress={onActionActivate}
            style={({ pressed }) => [
              styles.activateBtn,
              pressed && styles.activateBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Activer la tontine ${item.name}`}
          >
            <Text style={styles.activateBtnLabel}>Activer</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.strip}>
          {stripButtons.map((b, index) => (
            <View
              key={b.key}
              style={[styles.stripCell, index > 0 && styles.stripBorder]}
            >
              <Pressable
                onPress={b.onPress}
                disabled={b.disabled || b.onPress == null}
                style={({ pressed }) => [
                  styles.stripInner,
                  pressed && b.onPress != null && styles.stripPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  b.accessibilityLabel ?? `${b.label} · ${item.name}`
                }
              >
                {b.icon}
                <Text style={[styles.stripLabel, { color: b.color }]}>
                  {b.label}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cardOuter: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  cardOuterCompleted: {
    backgroundColor: COLORS.gray100,
  },
  accentStripe: {
    height: 3,
    width: '100%',
  },
  mainPressable: {},
  cardPressed: {
    opacity: 0.96,
  },
  completedBlock: {
    marginBottom: 10,
    gap: 6,
  },
  completedHint: {
    fontSize: 11,
    color: COLORS.gray500,
    marginBottom: 4,
  },
  completedLine: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  main: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    maxWidth: '48%',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  myTurnBadge: {
    backgroundColor: COLORS.accentLight,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: RADIUS.pill,
  },
  myTurnBadgeText: {
    fontSize: 9,
    fontWeight: '500',
    color: COLORS.accentDark,
  },
  title: {
    flex: 1,
    marginRight: 8,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: RADIUS.pill,
    marginBottom: 8,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '500',
  },
  metricsGrid: {
    flexDirection: 'row',
    borderWidth: 0.5,
    borderColor: COLORS.primaryLight,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
    backgroundColor: COLORS.gray100,
  },
  metricCell: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  metricVsep: {
    width: 0.5,
    backgroundColor: COLORS.primaryLight,
  },
  metricLabel: {
    fontSize: 9,
    color: COLORS.gray500,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  metricValuePrimary: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.primary,
  },
  metricSuffix: {
    fontSize: 10,
    color: COLORS.gray500,
    fontWeight: '400',
  },
  collectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  track: {
    flex: 1,
    height: 5,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  collectLabel: {
    fontSize: 10,
    color: COLORS.gray500,
    flexShrink: 0,
  },
  strip: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: COLORS.gray200,
  },
  stripCell: {
    flex: 1,
  },
  stripBorder: {
    borderLeftWidth: 0.5,
    borderLeftColor: COLORS.gray200,
  },
  stripInner: {
    minHeight: 44,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  stripPressed: {
    opacity: 0.85,
  },
  stripLabel: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  draftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: COLORS.secondaryBg,
  },
  draftBannerText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.secondaryText,
  },
  activateBtn: {
    flexShrink: 0,
    backgroundColor: COLORS.secondary,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  activateBtnPressed: {
    opacity: 0.9,
  },
  activateBtnLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#412402',
  },
});
