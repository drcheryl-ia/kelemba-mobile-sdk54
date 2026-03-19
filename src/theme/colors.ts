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
