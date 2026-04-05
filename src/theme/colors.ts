/**
 * Palette Kelemba — CLAUDE.md section 6
 * Ne pas utiliser d'autres couleurs primaires.
 */
export const colors = {
  primary: '#1A6B3C',
  secondary: '#F5A623',
  accent: '#0055A5',
  danger: '#D0021B',
  splashBackground: '#1A5C38',
  white: '#FFFFFF',
  black: '#000000',
  grayTagline: '#6B7280',
  inputBackground: '#F3F4F6',
  gray: {
    100: '#F5F5F5',
    200: '#EEEEEE',
    300: '#E0E0E0',
    400: '#BDBDBD',
    500: '#9E9E9E',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
  },
} as const;

export type Colors = typeof colors;

/** Tokens design system dashboard — ne pas retirer les clés existantes de `colors` */
export const COLORS = {
  primary: '#1A6B3C',
  primaryLight: '#EAF3DE',
  primaryDark: '#27500A',
  secondary: '#F5A623',
  secondaryBg: '#FFF3D4',
  secondaryText: '#854F0B',
  accent: '#0055A5',
  accentLight: '#E6F1FB',
  accentDark: '#0C447C',
  danger: '#D0021B',
  dangerLight: '#FCEBEB',
  dangerText: '#A32D2D',
  gray100: '#F5F5F0',
  gray200: '#D3D1C7',
  gray500: '#888780',
  gray700: '#444441',
  white: '#FFFFFF',
  textPrimary: '#1A1A18',
} as const;

export type ColorKey = keyof typeof COLORS;
