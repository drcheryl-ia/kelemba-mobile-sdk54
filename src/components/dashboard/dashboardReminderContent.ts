/**
 * Textes / tonalités des rappels dashboard — partagé par HomeHeroCard (source unique buildDashboardReminderCards).
 */
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { formatFcfa } from '@/utils/formatters';
import type { DashboardReminderCardVm } from '@/components/dashboard/paymentReminderBanner.helpers';
import type { DashboardReminderTone } from '@/components/dashboard/dashboardReminderTokens';

export type UrgencyLevel =
  | 'overdue'
  | 'today'
  | 'soon'
  | 'upcoming'
  | 'pendingValidation'
  | 'payoutReady'
  | 'payoutInProgress';

const MS_PER_DAY = 86_400_000;

export function computeDaysUntilDue(dueDate: string): number {
  const parts = dueDate.split('T')[0].split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return 0;
  const [y, m, d] = parts;
  const dueLocal = new Date(y, m - 1, d);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((dueLocal.getTime() - todayStart.getTime()) / MS_PER_DAY);
}

export function getUrgency(daysUntilDue: number): Exclude<UrgencyLevel, 'pendingValidation'> {
  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue === 0) return 'today';
  if (daysUntilDue <= 3) return 'soon';
  return 'upcoming';
}

function urgencyToTone(urgency: UrgencyLevel): DashboardReminderTone {
  switch (urgency) {
    case 'overdue':
      return 'danger';
    case 'today':
    case 'soon':
      return 'warning';
    case 'upcoming':
    case 'pendingValidation':
      return 'info';
    case 'payoutReady':
      return 'success';
    case 'payoutInProgress':
      return 'neutral';
    default:
      return 'info';
  }
}

function getDueLabel(daysUntilDue: number): string {
  if (daysUntilDue < 0) {
    const late = Math.abs(daysUntilDue);
    return `En retard de ${late} jour${late > 1 ? 's' : ''}`;
  }
  if (daysUntilDue === 0) return "Aujourd'hui";
  if (daysUntilDue === 1) return 'Demain';
  return `Dans ${daysUntilDue} jours`;
}

function formatDateFr(dateStr: string): string {
  const parts = dateStr.split('T')[0].split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return dateStr;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTimeFr(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAmountBreakdown(amountDue: number, penaltyAmount: number): string {
  if (penaltyAmount <= 0) {
    return `Cotisation : ${formatFcfa(amountDue)}`;
  }
  return `Cotisation : ${formatFcfa(amountDue)} + Penalite : ${formatFcfa(penaltyAmount)}`;
}

export function getDashboardReminderContent(
  reminder: DashboardReminderCardVm,
  nextPaymentAmountDue: number | null,
  nextPaymentPenaltyAmount: number | null
): {
  urgency: UrgencyLevel;
  tone: DashboardReminderTone;
  iconName: ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  amountLabel: string;
  detail: string;
  ctaLabel: string;
} {
  if (reminder.kind === 'pendingValidation') {
    return {
      urgency: 'pendingValidation',
      tone: 'info',
      iconName: 'shield-checkmark-outline',
      title: `Cotisation ${reminder.tontineName} en attente de validation`,
      subtitle:
        reminder.status === 'PROCESSING'
          ? 'Preuve envoyee · validation en cours'
          : "Paiement en especes declare · validation organisateur en attente",
      amountLabel: `Montant : ${formatFcfa(reminder.amount)}`,
      detail: reminder.createdAt
        ? `Declaree le ${formatDateTimeFr(reminder.createdAt)}`
        : 'Suivez cette cotisation dans vos paiements.',
      ctaLabel: 'Voir paiements',
    };
  }

  if (reminder.kind === 'payoutPot') {
    const phase = reminder.payoutPhase ?? 'ready';
    if (phase === 'in_progress') {
      return {
        urgency: 'payoutInProgress',
        tone: 'neutral',
        iconName: 'hourglass-outline',
        title: 'Versement en cours',
        subtitle: `${reminder.tontineName} — cycle ${reminder.cycleNumber ?? '—'}`,
        amountLabel:
          reminder.amount > 0 ? `Montant : ${formatFcfa(reminder.amount)}` : 'Versement traité',
        detail: 'La cagnotte est en cours de versement au bénéficiaire.',
        ctaLabel: 'Voir la tontine',
      };
    }
    return {
      urgency: 'payoutReady',
      tone: 'success',
      iconName: 'wallet-outline',
      title: 'Payer la cagnotte',
      subtitle: `Collecte complète · ${reminder.tontineName}`,
      amountLabel: `À verser : ${formatFcfa(reminder.amount)}`,
      detail: `Cycle ${reminder.cycleNumber ?? '—'} — vous pouvez lancer le versement.`,
      ctaLabel: 'Payer maintenant',
    };
  }

  if (reminder.kind === 'nextPayment') {
    const daysUntilDue = reminder.dueDate ? computeDaysUntilDue(reminder.dueDate) : 0;
    const urgency = getUrgency(daysUntilDue);
    return {
      urgency,
      tone: urgencyToTone(urgency),
      iconName: 'time-outline',
      title: `${getDueLabel(daysUntilDue)}${reminder.tontineName ? ` — ${reminder.tontineName}` : ''}`,
      subtitle: reminder.dueDate
        ? `Echeance : ${formatDateFr(reminder.dueDate)}`
        : 'Echeance a confirmer',
      amountLabel: `Total : ${formatFcfa(reminder.amount)}`,
      detail: formatAmountBreakdown(nextPaymentAmountDue ?? reminder.amount, nextPaymentPenaltyAmount ?? 0),
      ctaLabel: 'Cotiser',
    };
  }

  if (reminder.kind === 'savingsPeriod') {
    const daysUntilDue = reminder.dueDate ? computeDaysUntilDue(reminder.dueDate) : 0;
    const urgency = getUrgency(daysUntilDue);
    return {
      urgency,
      tone: urgencyToTone(urgency),
      iconName: 'wallet-outline',
      title: `${getDueLabel(daysUntilDue)} — ${reminder.tontineName}`,
      subtitle: reminder.dueDate
        ? `Échéance versement : ${formatDateFr(reminder.dueDate)}`
        : 'Échéance à confirmer',
      amountLabel: `Minimum : ${formatFcfa(reminder.amount)}`,
      detail: 'Tontine épargne — versement avant la date limite de période.',
      ctaLabel: reminder.periodUid ? 'Verser' : 'Voir l’épargne',
    };
  }

  return {
    urgency: 'upcoming',
    tone: 'info',
    iconName: 'information-circle-outline',
    title: 'Rappel',
    subtitle: '',
    amountLabel: '',
    detail: '',
    ctaLabel: 'Voir',
  };
}
