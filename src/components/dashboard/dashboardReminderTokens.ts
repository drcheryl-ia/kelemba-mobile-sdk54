/**
 * Tonalités partagées — carte rappel accueil (héro + `DashboardReminderCard`).
 */
export const DASHBOARD_REMINDER_TONES = {
  danger: { bg: '#FEF2F2', border: '#FECACA', accent: '#D0021B' },
  warning: { bg: '#FFFBEB', border: '#FDE68A', accent: '#F5A623' },
  info: { bg: '#EFF6FF', border: '#BFDBFE', accent: '#0055A5' },
  success: { bg: '#F0FDF4', border: '#BBF7D0', accent: '#1A6B3C' },
  neutral: { bg: '#F8FAFC', border: '#E2E8F0', accent: '#64748B' },
} as const;

export type DashboardReminderTone = keyof typeof DASHBOARD_REMINDER_TONES;
