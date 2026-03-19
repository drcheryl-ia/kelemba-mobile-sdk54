/**
 * Système de thème Kelemba — source de vérité pour les couleurs.
 * Mode clair : fond blanc ; mode sombre : fond sombre.
 * Compatible avec NavigationContainer et React Navigation.
 */
import type { Theme } from '@react-navigation/native';
import { DefaultTheme, DarkTheme } from '@react-navigation/native';

// Tokens Kelemba (CLAUDE.md section 6)
const PRIMARY = '#1A6B3C';
const SECONDARY = '#F5A623';
const ACCENT = '#0055A5';
const DANGER = '#D0021B';

export type ThemeMode = 'light' | 'dark';

export interface AppThemeColors {
  background: string;
  surface: string;
  card: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  secondary: string;
  accent: string;
  danger: string;
  tabBarBackground: string;
  tabBarActive: string;
  tabBarInactive: string;
  iconActive: string;
  iconInactive: string;
  white: string;
  black: string;
}

export interface AppTheme {
  mode: ThemeMode;
  colors: AppThemeColors;
}

export const lightThemeColors: AppThemeColors = {
  background: '#F9FAFB',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  text: '#1A1A2E',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  primary: PRIMARY,
  secondary: SECONDARY,
  accent: ACCENT,
  danger: DANGER,
  tabBarBackground: '#FFFFFF',
  tabBarActive: PRIMARY,
  tabBarInactive: '#757575',
  iconActive: PRIMARY,
  iconInactive: '#757575',
  white: '#FFFFFF',
  black: '#000000',
};

export const darkThemeColors: AppThemeColors = {
  background: '#111827',
  surface: '#1F2937',
  card: '#1F2937',
  text: '#F9FAFB',
  textMuted: '#9CA3AF',
  border: '#374151',
  primary: PRIMARY,
  secondary: SECONDARY,
  accent: ACCENT,
  danger: DANGER,
  tabBarBackground: '#1F2937',
  tabBarActive: '#34D399',
  tabBarInactive: '#9CA3AF',
  iconActive: '#34D399',
  iconInactive: '#9CA3AF',
  white: '#FFFFFF',
  black: '#000000',
};

export const lightTheme: AppTheme = {
  mode: 'light',
  colors: lightThemeColors,
};

export const darkTheme: AppTheme = {
  mode: 'dark',
  colors: darkThemeColors,
};

/** Thème pour NavigationContainer — format React Navigation */
export function getNavigationTheme(mode: ThemeMode): Theme {
  const theme = mode === 'dark' ? darkTheme : lightTheme;
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: mode === 'dark',
    colors: {
      ...base.colors,
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.card,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.danger,
    },
  };
}
