/**
 * Tab bar personnalisée — garantit l'affichage des icônes.
 * Wrapper autour de BottomTabBar : position absolute et borderRadius sur le wrapper,
 * layout normal pour le contenu interne (évite clipping des icônes).
 */
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BottomTabBar, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme } from '@/theme/appTheme';
import { spacing } from '@/theme/spacing';

const TAB_BAR_HEIGHT = 64;

export function CustomTabBar(props: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;
  const t = theme.colors;
  const tabBarBottom = Math.max(insets.bottom, spacing.md);

  const wrapperStyle: ViewStyle = {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: tabBarBottom,
    height: TAB_BAR_HEIGHT,
    borderRadius: 20,
    shadowColor: t.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: theme.mode === 'dark' ? 0.3 : 0.1,
    shadowRadius: 12,
    elevation: 8,
  };

  return (
    <View style={[styles.wrapper, wrapperStyle]}>
      <BottomTabBar {...props} style={[styles.tabBarInner, props.style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'visible',
    borderRadius: 20,
  },
  tabBarInner: {
    borderTopWidth: 0,
    flex: 1,
  },
});
