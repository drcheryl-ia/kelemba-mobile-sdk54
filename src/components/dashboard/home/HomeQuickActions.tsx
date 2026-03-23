/**
 * Actions rapides — grille homogène, navigation existante.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type HomeQuickActionId =
  | 'cotiser'
  | 'tour'
  | 'historique'
  | 'rejoindre'
  | 'invitations'
  | 'aide'
  | 'createTontine'
  | 'cash'
  | 'invite'
  | 'relance'
  | 'rapports';

export interface HomeQuickActionDef {
  id: HomeQuickActionId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  /** Si présent et > 0, pastille sur l’icône (ex. validations espèces). */
  badgeCount?: number;
}

export interface HomeQuickActionsProps {
  actions: HomeQuickActionDef[];
}

const NUM_COLUMNS = 4;
const PADDING_H = 20;
const GAP = 10;

export const HomeQuickActions: React.FC<HomeQuickActionsProps> = ({ actions }) => {
  const { width } = useWindowDimensions();
  const totalGaps = NUM_COLUMNS - 1;
  const buttonSize = Math.floor(
    (width - PADDING_H * 2 - GAP * totalGaps) / NUM_COLUMNS
  );
  const iconSize = Math.max(20, Math.min(28, Math.floor(buttonSize * 0.38)));
  const labelFontSize = buttonSize < 70 ? 9 : 10;

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>ACTIONS RAPIDES</Text>
      <View style={styles.grid}>
        {actions.map((a) => (
          <Pressable
            key={a.id}
            style={({ pressed }) => [
              styles.btn,
              {
                width: buttonSize,
                height: buttonSize,
                borderRadius: 16,
              },
              pressed && styles.pressed,
            ]}
            onPress={a.onPress}
            accessibilityRole="button"
            accessibilityLabel={
              (a.badgeCount ?? 0) > 0
                ? `${a.label}, ${a.badgeCount} en attente`
                : a.label
            }
          >
            <View style={[styles.iconWrap, { width: iconSize + 10, height: iconSize + 10, borderRadius: (iconSize + 10) / 2 }]}>
              <Ionicons name={a.icon} size={iconSize} color="#1A6B3C" />
              {(a.badgeCount ?? 0) > 0 ? (
                <View style={styles.badge} accessibilityElementsHidden>
                  <Text style={styles.badgeText}>
                    {(a.badgeCount ?? 0) > 99 ? '99+' : String(a.badgeCount)}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, { fontSize: labelFontSize }]} numberOfLines={2}>
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    paddingHorizontal: PADDING_H,
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F7F3',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#D0021B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  label: {
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 2,
  },
});
