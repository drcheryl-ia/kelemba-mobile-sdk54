/**
 * Carte avec bordure en dégradé (Vert → Jaune → Rouge).
 */
import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// ─── Dégradé Kelemba (Vert → Jaune → Rouge) ──────────────────────
const GRADIENT_COLORS: [string, string, string] = ['#1A6B3C', '#F5A623', '#D0021B'];

// Direction : coin supérieur-gauche → coin inférieur-droit (135°)
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };

const BORDER_WIDTH = 1;
const BORDER_RADIUS = 12;
const INNER_RADIUS = BORDER_RADIUS - BORDER_WIDTH; // 11

interface GradientBorderCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  innerStyle?: ViewStyle;
}

export function GradientBorderCard({
  children,
  style,
  innerStyle,
}: GradientBorderCardProps) {
  return (
    <LinearGradient
      colors={GRADIENT_COLORS}
      start={GRADIENT_START}
      end={GRADIENT_END}
      style={[styles.gradient, style]}
    >
      <View style={[styles.inner, innerStyle]}>{children}</View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    borderRadius: BORDER_RADIUS,
    padding: BORDER_WIDTH,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  inner: {
    backgroundColor: '#F7F8FA',
    borderRadius: INNER_RADIUS,
    overflow: 'hidden',
  },
});
