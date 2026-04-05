/**
 * Espacements — WCAG AA : boutons minimum 48dp
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  minTouchTarget: 48,
} as const;

/** Échelle design system (dashboard / nouveaux composants) — distincte de `spacing` legacy */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 24,
  full: 9999,
} as const;
