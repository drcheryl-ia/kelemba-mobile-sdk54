import React from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const NUM_COLUMNS = 4;
const PADDING_H = 16;
const GAP = 10;

export interface QuickActionItem {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  iconBg?: string;
}

export interface QuickActionsProps {
  onCotiser: () => void;
  onNouvelleTontine: () => void;
  onHistorique: () => void;
  onAide: () => void;
  showNouvelleTontine?: boolean;
  showRejoindreTontine?: boolean;
  onRejoindreTontine?: () => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onCotiser,
  onNouvelleTontine,
  onHistorique,
  onAide,
  showNouvelleTontine = true,
  showRejoindreTontine = false,
  onRejoindreTontine,
}) => {
  const { width } = useWindowDimensions();
  const totalGaps = NUM_COLUMNS - 1;
  const buttonSize = Math.floor(
    (width - PADDING_H * 2 - GAP * totalGaps) / NUM_COLUMNS
  );
  const iconSize = Math.max(20, Math.min(32, Math.floor(buttonSize * 0.4)));
  const labelFontSize = buttonSize < 70 ? 10 : 11;

  const middleAction: QuickActionItem | null = showNouvelleTontine
    ? {
        id: 'nouvelle',
        icon: 'add-circle',
        label: 'Nouvelle\nTontine',
        onPress: onNouvelleTontine,
      }
    : showRejoindreTontine && onRejoindreTontine
      ? {
          id: 'rejoindre',
          icon: 'enter-outline',
          label: 'Rejoindre Tontine',
          onPress: onRejoindreTontine,
        }
      : null;

  const actions: QuickActionItem[] = [
    { id: 'cotiser', icon: 'card-outline', label: 'Cotiser', onPress: onCotiser },
    ...(middleAction ? [middleAction] : []),
    { id: 'historique', icon: 'time-outline', label: 'Historique', onPress: onHistorique },
    { id: 'aide', icon: 'help-circle-outline', label: 'Aide', onPress: onAide },
  ];

  const buttonStyle = {
    width: buttonSize,
    height: buttonSize,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  };

  return (
    <View style={styles.actionsGrid}>
      {actions.map((action) => (
        <Pressable
          key={action.id}
          style={({ pressed }) => [
            buttonStyle,
            pressed && styles.actionCardPressed,
          ]}
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label.replace('\n', ' ')}
        >
          <View style={styles.actionCardInner}>
            <View style={[styles.actionIconWrapper, { width: iconSize + 10, height: iconSize + 10, borderRadius: (iconSize + 10) / 2 }]}>
              <Ionicons name={action.icon} size={iconSize} color="#1A6B3C" />
            </View>
            <Text
              style={[styles.actionLabel, { fontSize: labelFontSize }]}
              numberOfLines={2}
              textBreakStrategy="balanced"
            >
              {action.label}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    paddingHorizontal: PADDING_H,
  },
  actionCardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  actionCardInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  actionIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F7F3',
  },
  actionLabel: {
    fontWeight: '500',
    color: '#1A1A1A',
    textAlign: 'center',
    marginTop: 6,
  },
});
