/**
 * Carte tontine — hiérarchie visuelle fintech (header, montant, encart échéance, footer, CTA).
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { isMembershipPending } from '@/utils/tontineMerge';
import {
  deriveTontinePaymentUiState,
  getTontineListDueDateHeadingKey,
  resolveDisplayPaymentDate,
  resolveTontineDueState,
  resolveTontinePaymentContext,
  type TontineDueState,
  type TontinePaymentUiState,
} from '@/utils/tontinePaymentState';
import type { TontineListItem, TontineStatus, TontineFrequency } from '@/types/tontine';
import {
  getPersonalStatusKind,
  getPrimaryActionKind,
  type TontinePersonalStatusKind,
  type TontinePrimaryActionKind,
} from '@/screens/tontines/tontineListViewModel';
import { canShowOrganizerPayoutFromListItem } from '@/utils/cyclePayoutEligibility';

const GREEN = '#1A6B3C';
const ORANGE = '#F5A623';
const BLUE = '#0055A5';
const RED = '#D0021B';
const GRAY = '#6B7280';
const INK = '#111827';
const MUTED = '#6B7280';

const FREQ_KEYS: Record<TontineFrequency, string> = {
  DAILY: 'createTontine.freqDAILY',
  WEEKLY: 'createTontine.freqWEEKLY',
  BIWEEKLY: 'createTontine.freqBIWEEKLY',
  MONTHLY: 'createTontine.freqMONTHLY',
};

const STATUS_KEYS: Record<TontineStatus, string> = {
  DRAFT: 'tontineList.statusDraft',
  ACTIVE: 'tontineList.statusActive',
  BETWEEN_ROUNDS: 'tontineList.statusBetweenRounds',
  PAUSED: 'tontineList.statusPaused',
  COMPLETED: 'tontineList.statusCompleted',
  CANCELLED: 'tontineList.statusCancelled',
};

/** Badge global : fond léger + texte teinté (plus discret qu’un plein bloc) */
const STATUS_HEADER_STYLE: Record<TontineStatus, { bg: string; fg: string }> = {
  DRAFT: { bg: '#FFF7E6', fg: '#B45309' },
  ACTIVE: { bg: '#E8F5E9', fg: GREEN },
  BETWEEN_ROUNDS: { bg: '#E8F1FF', fg: BLUE },
  PAUSED: { bg: '#FFF7E6', fg: '#B45309' },
  COMPLETED: { bg: '#F3F4F6', fg: '#4B5563' },
  CANCELLED: { bg: '#FEE2E2', fg: '#991B1B' },
};

type EncartTone = 'success' | 'warning' | 'danger' | 'info' | 'muted';

const ENCART_SURFACE: Record<
  EncartTone,
  { bg: string; border: string; icon: string; text: string; sub?: string }
> = {
  success: { bg: '#ECFDF5', border: '#A7F3D0', icon: GREEN, text: '#065F46', sub: '#047857' },
  warning: { bg: '#FFFBEB', border: '#FDE68A', icon: '#B45309', text: '#92400E', sub: '#B45309' },
  danger: { bg: '#FEF2F2', border: '#FECACA', icon: RED, text: '#991B1B', sub: '#B91C1C' },
  info: { bg: '#EFF6FF', border: '#BFDBFE', icon: BLUE, text: '#1E3A8A', sub: '#1E40AF' },
  muted: { bg: '#F9FAFB', border: '#E5E7EB', icon: GRAY, text: '#374151', sub: MUTED },
};

function formatFcfa(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} FCFA`;
}

function formatDateLong(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateShort(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const date = new Date(`${dateStr.split('T')[0]}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function roleLabel(item: TontineListItem, t: (key: string, fallback: string) => string): string {
  return item.isCreator === true || item.membershipRole === 'CREATOR'
    ? t('tontineList.organizer', 'Organisateur')
    : t('tontineList.memberRole', 'Membre');
}

function personalStatusMeta(
  kind: TontinePersonalStatusKind,
  item: TontineListItem,
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string
): { label: string; color: string; background: string } {
  switch (kind) {
    case 'INVITATION_RECEIVED':
      return {
        label: t('tontineList.invitationReceived', 'Invitation reçue'),
        color: GREEN,
        background: '#E8F5E9',
      };
    case 'VALIDATION_PENDING':
      return {
        label: t('tontineList.pendingBadge', 'En attente'),
        color: GRAY,
        background: '#F3F4F6',
      };
    case 'PAYMENT_DUE':
      return {
        label: t('tontineList.personalDue', 'Cotisation attendue'),
        color: ORANGE,
        background: '#FFF7E6',
      };
    case 'OVERDUE':
      return {
        label: t('tontineList.personalOverdue', 'En retard'),
        color: RED,
        background: '#FEE2E2',
      };
    case 'PROCESSING':
      return {
        label: t('tontineList.personalProcessing', 'En traitement'),
        color: BLUE,
        background: '#E8F1FF',
      };
    case 'UP_TO_DATE':
      return {
        label: t('tontineList.personalUpToDate', 'À jour'),
        color: GREEN,
        background: '#E8F5E9',
      };
    case 'DRAFT':
      return {
        label: t('tontineList.statusDraft', 'Brouillon'),
        color: ORANGE,
        background: '#FFF7E6',
      };
    default:
      return {
        label:
          item.status === 'COMPLETED'
            ? t('tontineList.personalClosed', 'Terminée')
            : t('tontineList.personalUnknown', 'Statut indisponible'),
        color: GRAY,
        background: '#F3F4F6',
      };
  }
}

function primaryActionLabel(
  kind: TontinePrimaryActionKind,
  t: (key: string, fallback: string) => string
): string {
  switch (kind) {
    case 'RESPOND':
      return t('tontineList.respond', 'Répondre');
    case 'FINALIZE':
      return t('common.continue', 'Continuer');
    case 'MANAGE':
      return t('tontineList.manageTontine', 'Gérer la tontine');
    case 'PAY':
      return t('tontineList.payNow', 'Cotiser');
    case 'NEW_ROTATION':
      return t('tontineList.newRotationCta', 'Nouvelle rotation');
    default:
      return t('tontineList.viewDetails', 'Voir détails');
  }
}

/**
 * Texte d’insight secondaire : évite la redondance avec l’encart échéance (paiement).
 */
function insightText(
  item: TontineListItem,
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string
): string {
  if (item.status === 'DRAFT') {
    return t(
      'tontineList.draftInsight',
      'Publiez et complétez cette tontine avant son démarrage.'
    );
  }

  if (isMembershipPending(item)) {
    return item.invitationOrigin === 'INVITE'
      ? t(
          'tontineList.pendingSubInvite',
          'Acceptez cette invitation pour activer la tontine.'
        )
      : t(
          'tontineList.pendingSubJoinRequest',
          'En attente de validation par l’organisateur.'
        );
  }

  if (item.status === 'BETWEEN_ROUNDS') {
    return t(
      'tontineList.rotationCompletedLine',
      'Rotation {{n}} complétée',
      { n: item.totalCycles }
    );
  }

  if (item.status === 'COMPLETED') {
    return t('tontineList.completedInsight', 'Cette tontine est terminée.');
  }

  if (item.status === 'CANCELLED') {
    return t('tontineList.cancelledInsight', 'Cette tontine a été annulée.');
  }

  if (item.status === 'PAUSED') {
    return t('tontineList.pausedInsight', 'Cette tontine est temporairement en pause.');
  }

  if (
    item.type === 'EPARGNE' &&
    (item.savingsMemberStatus === 'WITHDRAWN' || item.savingsMemberStatus === 'EXCLUDED')
  ) {
    return t(
      'tontineList.savingsInsightLeft',
      'Vous ne participez plus à cette épargne.'
    );
  }

  const payState = deriveTontinePaymentUiState(item);
  const paymentContext = resolveTontinePaymentContext(item);

  const paymentUrgent =
    payState.uiStatus === 'OVERDUE' ||
    payState.uiStatus === 'DUE_TODAY' ||
    payState.uiStatus === 'DUE_SOON';

  if (paymentUrgent && item.currentCycle != null) {
    return t('tontineList.turnSummary', 'Tour {{current}} sur {{total}}.', {
      current: item.currentCycle,
      total: item.totalCycles,
    });
  }

  if (payState.uiStatus === 'OVERDUE') {
    return item.type === 'EPARGNE'
      ? t('tontineList.savingsOverdueInsight', 'Versement en retard depuis {{count}} jour(s).', {
          count: payState.daysOverdue ?? 0,
        })
      : t('tontineList.overdueInsight', 'Cotisation attendue depuis {{count}} jour(s).', {
          count: payState.daysOverdue ?? 0,
        });
  }

  if (payState.uiStatus === 'DUE_TODAY') {
    return item.type === 'EPARGNE'
      ? t('tontineList.savingsDueTodayInsight', 'Versement attendu aujourd’hui.')
      : t('tontineList.dueTodayInsight', 'Cotisation attendue aujourd’hui.');
  }

  if (payState.uiStatus === 'DUE_SOON') {
    return item.type === 'EPARGNE'
      ? t('tontineList.savingsDueSoonInsight', 'Prochain versement dans {{count}} jour(s).', {
          count: payState.daysLeft ?? 0,
        })
      : t('tontineList.dueSoonInsight', 'Prochaine cotisation dans {{count}} jour(s).', {
          count: payState.daysLeft ?? 0,
        });
  }

  if (payState.uiStatus === 'UP_TO_DATE' && item.currentCycle != null) {
    return t('tontineList.turnSummary', 'Tour {{current}} sur {{total}}.', {
      current: item.currentCycle,
      total: item.totalCycles,
    });
  }

  if (paymentContext.totalDue > 0 && paymentContext.showAmountBreakdown) {
    return t('tontineList.amountDueSummary', '{{amount}} à verser sur le cycle courant.', {
      amount: formatFcfa(paymentContext.totalDue),
    });
  }

  if (item.activeMemberCount != null && item.currentCycle != null) {
    return t('tontineList.membersCycleSummary', '{{count}} membres actifs · Tour {{current}}/{{total}}', {
      count: item.activeMemberCount,
      current: item.currentCycle,
      total: item.totalCycles,
    });
  }

  if (item.startDate) {
    return t('tontineList.startsOn', 'Démarre le {{date}}', {
      date: formatDateLong(item.startDate),
    });
  }

  if (item.type === 'EPARGNE') {
    return t(
      'tontineList.savingsInsightDefault',
      'Épargne collective — versements flexibles (minimum respecté).'
    );
  }

  return t('tontineList.genericInsight', 'Consultez les détails de cette tontine.');
}

export interface TontineCardProps {
  item: TontineListItem;
  onPress: (item: TontineListItem) => void;
  onInvitePress?: (uid: string, name: string) => void;
  PaymentDueBadge?: React.ComponentType;
  onNewRotationPress?: (item: TontineListItem) => void;
  /** Liste : navigation `CyclePayoutScreen` quand collecte complète + organisateur */
  onOrganizerPayoutPress?: (item: TontineListItem) => void;
  /** UID de la tontine dont le montant payout est en cours de résolution (API) — désactive les CTA payout */
  organizerPayoutFetchTontineUid?: string | null;
}

function encartFromPaymentState(
  item: TontineListItem,
  payState: TontinePaymentUiState,
  dueState: TontineDueState,
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string,
  rawDueIso: string | null,
  dueFormatted: string | null
): { tone: EncartTone; icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string } {
  if (item.type === 'EPARGNE' && item.savingsMemberStatus === 'SUSPENDED') {
    return {
      tone: 'danger',
      icon: 'pause-circle',
      title: t(
        'tontineList.savingsEpargneSuspendedEncart',
        'Compte suspendu — contactez l’organisateur si besoin.'
      ),
    };
  }

  if (
    item.type === 'EPARGNE' &&
    item.savingsWithdrawalAvailable === true &&
    item.savingsMemberStatus !== 'SUSPENDED'
  ) {
    return {
      tone: 'success',
      icon: 'wallet',
      title: t('tontineList.savingsEpargneEncartWithdraw', 'Retrait disponible'),
      subtitle: t(
        'tontineList.savingsEpargneEncartWithdrawSub',
        'Ouvrez le détail pour retirer vos fonds.'
      ),
    };
  }

  if (dueState === 'PROCESSING') {
    return {
      tone: 'info',
      icon: 'sync',
      title: t('tontineList.cardEncartProcessing', 'Paiement en cours'),
      subtitle:
        dueFormatted != null
          ? t('tontineList.cardEncartScheduled', 'Date prévue le {{date}}', { date: dueFormatted })
          : undefined,
    };
  }

  if (payState.uiStatus === 'OVERDUE') {
    return {
      tone: 'danger',
      icon: 'alert-circle',
      title: t('tontineList.cardEncartOverdue', 'En retard de {{count}} jour(s)', {
        count: payState.daysOverdue ?? 0,
      }),
      subtitle:
        dueFormatted != null
          ? t('tontineList.currentDueWithDate', 'Échéance actuelle : {{date}}', {
              date: dueFormatted,
            })
          : undefined,
    };
  }

  if (payState.uiStatus === 'DUE_TODAY') {
    return {
      tone: 'warning',
      icon: 'today',
      title: t('tontineList.cardEncartDueToday', 'À payer aujourd’hui'),
      subtitle:
        dueFormatted != null
          ? t('tontineList.currentDueWithDate', 'Échéance actuelle : {{date}}', {
              date: dueFormatted,
            })
          : undefined,
    };
  }

  if (payState.uiStatus === 'DUE_SOON') {
    return {
      tone: 'warning',
      icon: 'time',
      title: t('tontineList.cardEncartDueSoon', 'À payer dans {{count}} jour(s)', {
        count: payState.daysLeft ?? 0,
      }),
      subtitle:
        dueFormatted != null
          ? t('tontineList.currentDueWithDate', 'Échéance actuelle : {{date}}', {
              date: dueFormatted,
            })
          : undefined,
    };
  }

  if (payState.uiStatus === 'UP_TO_DATE') {
    const dateLine =
      payState.displayDate != null && rawDueIso != null
        ? t('tontineList.cardEncartUpToDateWithDate', 'À jour · prochaine échéance le {{date}}', {
            date: payState.displayDate,
          })
        : t('tontineList.cardEncartUpToDate', 'À jour');
    return {
      tone: 'success',
      icon: 'checkmark-circle',
      title: dateLine,
    };
  }

  if (payState.needsPaymentAttention && payState.uiStatus === 'UNKNOWN') {
    return {
      tone: 'warning',
      icon: 'wallet',
      title: t('tontineList.cardEncartDueNoDate', 'Cotisation à payer'),
      subtitle: t('tontineList.dateUndefined', 'Date non définie'),
    };
  }

  if (payState.uiStatus === 'UNKNOWN' && rawDueIso != null && dueFormatted != null) {
    return {
      tone: 'muted',
      icon: 'calendar-outline',
      title: t('tontineList.cardEncartScheduled', 'Date prévue le {{date}}', { date: dueFormatted }),
    };
  }

  return {
    tone: 'muted',
    icon: 'help-circle-outline',
    title: t('tontineList.cardEncartUnknown', 'Échéance indisponible'),
  };
}

/** `collectionProgress` backend : 0..1 ou 0..100 — pas de barre si absent. */
function resolveCollectionProgressPercent(item: TontineListItem): number | null {
  const rawProgress =
    typeof item.collectionProgress === 'number' && Number.isFinite(item.collectionProgress)
      ? item.collectionProgress
      : null;
  if (rawProgress == null) return null;
  const pct =
    rawProgress <= 1 ? Math.round(rawProgress * 100) : Math.round(rawProgress);
  return Math.min(100, Math.max(0, pct));
}

function CollectionProgressSection({
  progressPercent,
  t,
}: {
  progressPercent: number;
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string;
}) {
  const complete = progressPercent >= 100;
  const widthPct = Math.min(100, Math.max(0, progressPercent));
  return (
    <View
      style={styles.progressSection}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: widthPct }}
    >
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>
          {t('tontineList.collectionProgressLabel', 'Collecte du cycle')}
        </Text>
        <Text style={styles.progressValue}>
          {complete
            ? `${widthPct}%`
            : t('tontineList.collectionPercentValue', '{{percent}}%', { percent: widthPct })}
        </Text>
      </View>
      {complete ? (
        <Text style={styles.progressDoneText}>
          {t('tontineList.collectionComplete', 'Collecte terminée')}
        </Text>
      ) : null}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${widthPct}%` }]} />
      </View>
    </View>
  );
}

function PaymentEncart({
  encart,
}: {
  encart: { tone: EncartTone; icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string };
}) {
  const surface = ENCART_SURFACE[encart.tone];
  return (
    <View
      style={[
        styles.encartWrap,
        styles.encartShadow,
        { backgroundColor: surface.bg, borderColor: surface.border },
      ]}
    >
      <View style={styles.encartMainRow}>
        <Ionicons name={encart.icon} size={22} color={surface.icon} />
        <View style={styles.encartTextCol}>
          <Text style={[styles.encartTitle, { color: surface.text }]}>{encart.title}</Text>
          {encart.subtitle ? (
            <Text style={[styles.encartSubtitle, { color: surface.sub ?? MUTED }]} numberOfLines={2}>
              {encart.subtitle}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** Pastille « Tontine rotative » / « Tontine épargne » (liste des tontines). */
function TontineTypeMarker({
  item,
  t,
}: {
  item: TontineListItem;
  t: (key: string, fallback: string) => string;
}) {
  const isEpargne = item.type === 'EPARGNE';
  const label = isEpargne
    ? t('createTontine.typeSavingsTitle', 'Tontine épargne')
    : t('createTontine.typeRotativeTitle', 'Tontine rotative');
  return (
    <View style={styles.typeMarkerRow} accessibilityRole="text">
      <View
        style={[styles.typePill, isEpargne ? styles.typePillEpargne : styles.typePillRotative]}
      >
        <Text
          style={[
            styles.typePillText,
            isEpargne ? styles.typePillTextEpargne : styles.typePillTextRotative,
          ]}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

function savingsEpargneHeroLabel(
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string,
  item: TontineListItem
): string {
  return item.type === 'EPARGNE'
    ? t('tontineList.cardHeroMinContribution', 'Versement minimum')
    : t('tontineList.cardHeroPerShare', 'par part');
}

function SavingsEpargneMetaLines({
  item,
  t,
}: {
  item: TontineListItem;
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string;
}) {
  if (item.type !== 'EPARGNE') return null;
  const unlock = item.savingsUnlockDate;
  const saved = item.savingsTotalSaved;
  const next = item.nextPaymentDate;

  const lines: React.ReactNode[] = [];
  if (typeof saved === 'number' && saved > 0) {
    lines.push(
      <Text key="saved" style={styles.savingsMetaLine}>
        {t('tontineList.savingsEpargneTotalSaved', 'Total épargné : {{amount}}', {
          amount: formatFcfa(saved),
        })}
      </Text>
    );
  }
  if (next) {
    lines.push(
      <Text key="next" style={styles.savingsMetaLine}>
        {t('tontineList.savingsEpargneNextDue', 'Prochaine échéance : {{date}}', {
          date: formatDateShort(next) ?? next,
        })}
      </Text>
    );
  }
  if (unlock) {
    lines.push(
      <Text key="unlock" style={styles.savingsMetaLine}>
        {t('tontineList.savingsEpargneUnlock', 'Déblocage : {{date}}', {
          date: formatDateLong(unlock),
        })}
      </Text>
    );
  }
  if (lines.length === 0) return null;
  return <View style={styles.savingsMetaBlock}>{lines}</View>;
}

export const TontineCard: React.FC<TontineCardProps> = ({
  item,
  onPress,
  onNewRotationPress,
  onOrganizerPayoutPress,
  organizerPayoutFetchTontineUid,
}) => {
  const { t } = useTranslation();
  const statusLabel = t(STATUS_KEYS[item.status], STATUS_KEYS[item.status]);
  const frequencyLabel = t(FREQ_KEYS[item.frequency ?? 'MONTHLY'], item.frequency ?? 'MONTHLY');
  const headerSub = t('tontineList.headerSubRoleFreq', '{{role}} · {{frequency}}', {
    role: roleLabel(item, t),
    frequency: frequencyLabel,
  });
  const turnFooter =
    item.currentCycle != null
      ? t('tontineList.turnShort', 'Tour {{current}} / {{total}}', {
          current: item.currentCycle,
          total: item.totalCycles,
        })
      : null;
  const cycleLabel =
    item.currentCycle != null
      ? t('tontineList.cycleFormat', 'Cycle {{current}} / {{total}}', {
          current: item.currentCycle,
          total: item.totalCycles,
        })
      : t('tontineList.notStarted', 'Non démarré');
  const rawDue = resolveDisplayPaymentDate(item);
  const dueDate = formatDateShort(rawDue ?? undefined);
  const dueHeadingKey = getTontineListDueDateHeadingKey(item);
  const payState = deriveTontinePaymentUiState(item);
  const dueState = resolveTontineDueState(item);
  const personalKind = getPersonalStatusKind(item);
  const personalStatus = personalStatusMeta(personalKind, item, t);
  const actionKind = getPrimaryActionKind(item);
  const progressPercent = resolveCollectionProgressPercent(item);
  const showProgressSection = progressPercent != null;
  const isOrganizer = item.isCreator === true || item.membershipRole === 'CREATOR';
  const canPayout =
    item.canTriggerPayout === false
      ? false
      : item.canTriggerPayout === true
        ? true
        : canShowOrganizerPayoutFromListItem(item);
  /** Payout : collecte 100 % + organisateur + éligibilité + handler (branche standard uniquement). */
  const payoutMode =
    progressPercent != null &&
    progressPercent >= 100 &&
    isOrganizer &&
    canPayout &&
    onOrganizerPayoutPress != null &&
    !isMembershipPending(item) &&
    item.status !== 'DRAFT';
  const actionLabel = payoutMode
    ? t('tontineList.payCagnotteCta', 'Payer la cagnotte')
    : primaryActionLabel(actionKind, t);
  const encart = encartFromPaymentState(item, payState, dueState, t, rawDue, dueDate);
  const handlePrimaryAction = () => {
    if (payoutMode && onOrganizerPayoutPress) {
      onOrganizerPayoutPress(item);
      return;
    }
    if (actionKind === 'NEW_ROTATION' && onNewRotationPress) {
      onNewRotationPress(item);
      return;
    }
    if (item.status === 'DRAFT' && item.canInvite) {
      onPress(item);
      return;
    }
    onPress(item);
  };

  const ctaIsPay = actionKind === 'PAY' && !payoutMode;
  const ctaPayout = payoutMode;
  const payoutCtaDisabled =
    payoutMode && organizerPayoutFetchTontineUid != null;
  const payoutCtaLoading =
    payoutMode &&
    organizerPayoutFetchTontineUid != null &&
    organizerPayoutFetchTontineUid === item.uid;
  const statusHeader = STATUS_HEADER_STYLE[item.status];

  /** Fond léger selon le type (rotative vs épargne). */
  const typeSurfaceStyle =
    item.type === 'EPARGNE' ? styles.cardBgEpargne : styles.cardBgRotative;

  const footerSecondary =
    item.activeMemberCount != null
      ? t('tontineList.footerMembers', '{{count}} membres actifs', { count: item.activeMemberCount })
      : null;

  // 1. membershipStatus === 'PENDING'
  if (isMembershipPending(item)) {
    return (
      <View style={[styles.pendingCard, typeSurfaceStyle, styles.cardListBorder]}>
        <View style={styles.headerBlock}>
          <View style={styles.headerTopRow}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.name}
            </Text>
            <View style={[styles.statusBadgeHeader, { backgroundColor: statusHeader.bg }]}>
              <Text style={[styles.statusBadgeHeaderText, { color: statusHeader.fg }]}>{statusLabel}</Text>
            </View>
          </View>
          <TontineTypeMarker item={item} t={t} />
          <Text style={styles.headerSubline}>{headerSub}</Text>
        </View>

        <View style={styles.heroBlock}>
          <Text style={styles.heroAmount}>{formatFcfa(item.amountPerShare)}</Text>
          <Text style={styles.heroPerShare}>{savingsEpargneHeroLabel(t, item)}</Text>
        </View>

        <SavingsEpargneMetaLines item={item} t={t} />

        <View style={[styles.encartWrap, styles.encartShadow, styles.pendingEncart]}>
          <Text style={styles.pendingEncartLabel}>
            {item.invitationOrigin === 'INVITE'
              ? t('tontineList.invitationReceived', 'Invitation reçue')
              : t('tontineList.pendingBadge', 'En attente')}
          </Text>
          <Text style={styles.pendingEncartBody}>{insightText(item, t)}</Text>
        </View>

        <Text style={styles.footerLine}>
          {turnFooter != null ? `${turnFooter} · ${cycleLabel}` : cycleLabel}
        </Text>

        {item.invitationOrigin === 'INVITE' ? (
          <Pressable
            style={[styles.primaryButton, ctaIsPay && styles.ctaPay]}
            onPress={() => onPress(item)}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
          >
            <Text style={styles.primaryButtonText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  // 2. status === 'DRAFT'
  if (item.status === 'DRAFT') {
    return (
      <View style={[styles.card, typeSurfaceStyle, styles.cardListBorder]}>
        <Pressable
          onPress={() => onPress(item)}
          accessibilityRole="button"
          accessibilityLabel={item.name}
          style={styles.cardTapArea}
        >
          <View style={styles.headerBlock}>
            <View style={styles.headerTopRow}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.name}
              </Text>
              <View style={[styles.statusBadgeHeader, { backgroundColor: statusHeader.bg }]}>
                <Text style={[styles.statusBadgeHeaderText, { color: statusHeader.fg }]}>{statusLabel}</Text>
              </View>
            </View>
            <TontineTypeMarker item={item} t={t} />
            <Text style={styles.headerSubline}>{headerSub}</Text>
          </View>

          <View style={styles.heroBlock}>
            <Text style={styles.heroAmount}>{formatFcfa(item.amountPerShare)}</Text>
            <Text style={styles.heroPerShare}>{savingsEpargneHeroLabel(t, item)}</Text>
          </View>

          <SavingsEpargneMetaLines item={item} t={t} />

          <View
            style={[
              styles.encartWrap,
              styles.encartShadow,
              {
                backgroundColor: ENCART_SURFACE.warning.bg,
                borderColor: ENCART_SURFACE.warning.border,
              },
            ]}
          >
            <View style={styles.encartMainRow}>
              <Ionicons name="construct-outline" size={22} color={ENCART_SURFACE.warning.icon} />
              <Text style={[styles.encartTitle, { color: ENCART_SURFACE.warning.text, flex: 1 }]}>
                {t('tontineList.pendingFinalization', 'À finaliser')}
              </Text>
            </View>
          </View>

          <Text style={styles.insightText}>{insightText(item, t)}</Text>

          <Text style={styles.footerLine}>
            {turnFooter != null ? `${turnFooter} · ${cycleLabel}` : cycleLabel}
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.primaryButton,
            styles.ctaInCard,
            ctaIsPay && styles.ctaPay,
            ctaPayout && styles.ctaPayoutAccent,
          ]}
          onPress={handlePrimaryAction}
          disabled={payoutCtaDisabled}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          accessibilityState={{ disabled: payoutCtaDisabled }}
        >
          {payoutCtaLoading ? (
            <View style={styles.payoutCtaRow}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={[styles.primaryButtonText, styles.payoutCtaLoadingText]}>{actionLabel}</Text>
            </View>
          ) : (
            <Text style={styles.primaryButtonText}>{actionLabel}</Text>
          )}
        </Pressable>
      </View>
    );
  }

  // 3. ACTIVE and other standard states
  const dueFallbackLine =
    dueDate != null
      ? dueHeadingKey === 'currentDue'
        ? t('tontineList.currentDueWithDate', 'Échéance actuelle : {{date}}', {
            date: dueDate,
          })
        : t('tontineList.nextDueWithDate', 'Prochaine échéance : {{date}}', {
            date: dueDate,
          })
      : null;

  return (
    <View style={[styles.card, typeSurfaceStyle, styles.cardListBorder]}>
      <Pressable
        onPress={() => onPress(item)}
        accessibilityRole="button"
        accessibilityLabel={item.name}
        style={styles.cardTapArea}
      >
        <View style={styles.headerBlock}>
          <View style={styles.headerTopRow}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.name}
            </Text>
            <View style={[styles.statusBadgeHeader, { backgroundColor: statusHeader.bg }]}>
              <Text style={[styles.statusBadgeHeaderText, { color: statusHeader.fg }]}>{statusLabel}</Text>
            </View>
          </View>
          <TontineTypeMarker item={item} t={t} />
          <Text style={styles.headerSubline}>{headerSub}</Text>
        </View>

        <View style={styles.heroBlock}>
          <Text style={styles.heroAmount}>{formatFcfa(item.amountPerShare)}</Text>
          <Text style={styles.heroPerShare}>{savingsEpargneHeroLabel(t, item)}</Text>
        </View>

        <SavingsEpargneMetaLines item={item} t={t} />

        {encart.tone === 'muted' && (
          <View style={styles.personalPillRow}>
            <View style={[styles.personalPill, { backgroundColor: personalStatus.background }]}>
              <Text style={[styles.personalPillText, { color: personalStatus.color }]} numberOfLines={1}>
                {personalStatus.label}
              </Text>
            </View>
          </View>
        )}

        <PaymentEncart encart={encart} />

        {dueFallbackLine != null && encart.tone === 'muted' ? (
          <Text style={styles.dueFallbackMuted}>{dueFallbackLine}</Text>
        ) : null}

        <Text style={styles.insightText}>{insightText(item, t)}</Text>

        <View style={styles.footerRow}>
          <Text style={styles.footerLine}>
            {turnFooter != null ? turnFooter : cycleLabel}
            {footerSecondary != null ? ` · ${footerSecondary}` : ''}
          </Text>
        </View>
      </Pressable>

      {showProgressSection && progressPercent != null ? (
        <View style={styles.progressWrap}>
          <CollectionProgressSection progressPercent={progressPercent} t={t} />
        </View>
      ) : null}

      <Pressable
        style={[
          styles.primaryButton,
          styles.ctaInCard,
          ctaIsPay && styles.ctaPay,
          ctaPayout && styles.ctaPayoutAccent,
        ]}
        onPress={handlePrimaryAction}
        disabled={payoutCtaDisabled}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        accessibilityState={{ disabled: payoutCtaDisabled }}
      >
        {payoutCtaLoading ? (
          <View style={styles.payoutCtaRow}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={[styles.primaryButtonText, styles.payoutCtaLoadingText]}>{actionLabel}</Text>
          </View>
        ) : (
          <Text style={styles.primaryButtonText}>{actionLabel}</Text>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
    overflow: 'hidden',
  },
  /** Bordure verte — liste des tontines */
  cardListBorder: {
    borderWidth: 1.5,
    borderColor: GREEN,
  },
  /** Tontine rotative (fond léger vert) */
  cardBgRotative: {
    backgroundColor: '#F0FDF4',
  },
  /** Tontine épargne (fond léger bleu, distinct de la rotative) */
  cardBgEpargne: {
    backgroundColor: '#EFF6FF',
  },
  progressWrap: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  progressSection: {
    marginBottom: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
    flex: 1,
  },
  progressValue: {
    fontSize: 12,
    fontWeight: '800',
    color: GREEN,
  },
  progressDoneText: {
    fontSize: 12,
    fontWeight: '700',
    color: GREEN,
    marginBottom: 6,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#ECFDF5',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: GREEN,
  },
  cardTapArea: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  pendingCard: {
    borderRadius: 22,
    padding: 20,
    marginBottom: 14,
  },
  headerBlock: {
    marginBottom: 4,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: INK,
    lineHeight: 24,
  },
  headerSubline: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: MUTED,
  },
  typeMarkerRow: {
    marginTop: 8,
  },
  typePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  typePillRotative: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  typePillEpargne: {
    backgroundColor: '#DBEAFE',
    borderColor: '#93C5FD',
  },
  typePillText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  typePillTextRotative: {
    color: GREEN,
  },
  typePillTextEpargne: {
    color: BLUE,
  },
  statusBadgeHeader: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '42%',
  },
  statusBadgeHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  heroBlock: {
    marginTop: 18,
    marginBottom: 4,
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: GREEN,
    letterSpacing: -0.5,
  },
  heroPerShare: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: MUTED,
  },
  savingsMetaBlock: {
    marginTop: 10,
    gap: 4,
  },
  savingsMetaLine: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  personalPillRow: {
    marginTop: 12,
    flexDirection: 'row',
  },
  personalPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  personalPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  encartWrap: {
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  encartShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  encartMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  encartTextCol: {
    flex: 1,
  },
  encartTitle: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
  },
  encartSubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  pendingEncart: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  pendingEncartLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pendingEncartBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#4B5563',
  },
  dueFallbackMuted: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  insightText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 19,
    color: '#374151',
  },
  footerRow: {
    marginTop: 4,
  },
  footerLine: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  ctaInCard: {
    marginHorizontal: 20,
    marginBottom: 18,
    marginTop: 4,
  },
  ctaPay: {
    backgroundColor: ORANGE,
  },
  ctaPayoutAccent: {
    backgroundColor: '#DC2626',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  payoutCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutCtaLoadingText: {
    marginLeft: 10,
  },
});
