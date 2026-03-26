/**
 * En-tête commun des écrans tontine Épargne — safe area gérée par l’écran parent (SafeAreaView).
 * Layout : retour + bloc titre (flex 1, minWidth 0) + badges sous le titre + action droite optionnelle.
 */
import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

const INK = '#1C1C1E';
const GREEN = '#1A6B3C';
const BORDER = '#E5E7EB';

export interface SavingsStatusChip {
  key: string;
  label: string;
  backgroundColor: string;
  textColor?: string;
}

export interface SavingsScreenHeaderProps {
  title: string;
  onBack?: () => void;
  /** Si false (ex. onglet principal), pas de bouton retour ; le titre occupe l’espace avec l’action droite. */
  showBackButton?: boolean;
  subtitle?: string;
  statusChips?: SavingsStatusChip[];
  rightAction?: React.ReactNode;
  backAccessibilityLabel?: string;
  titleNumberOfLines?: 1 | 2;
  /** Remplace la flèche texte « ← » (ex. Ionicons). */
  backIcon?: React.ReactNode;
  backPressableStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  /** Fusionné avec le conteneur d’en-tête (bordure, fond, marges). */
  headerContainerStyle?: StyleProp<ViewStyle>;
}

export const SavingsScreenHeader: React.FC<SavingsScreenHeaderProps> = ({
  title,
  onBack,
  showBackButton = true,
  subtitle,
  statusChips,
  rightAction,
  backAccessibilityLabel = 'Retour',
  titleNumberOfLines = 2,
  backIcon,
  backPressableStyle,
  titleStyle,
  headerContainerStyle,
}) => {
  const showBack = showBackButton && onBack != null;

  return (
    <View style={[styles.headerContainer, headerContainerStyle]}>
      <View style={styles.headerTopRow}>
        {showBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={12}
            style={[styles.backButton, backPressableStyle]}
            accessibilityRole="button"
            accessibilityLabel={backAccessibilityLabel}
          >
            {backIcon != null ? (
              backIcon
            ) : (
              <Text style={styles.backArrow}>←</Text>
            )}
          </Pressable>
        ) : null}
        <View style={styles.titleBlock}>
          <Text
            style={[styles.title, titleStyle]}
            numberOfLines={titleNumberOfLines}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
          {subtitle != null && subtitle !== '' ? (
            <Text
              style={styles.subtitle}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {subtitle}
            </Text>
          ) : null}
          {statusChips != null && statusChips.length > 0 ? (
            <View style={styles.statusRow}>
              {statusChips.map((chip) => (
                <View
                  key={chip.key}
                  style={[styles.chip, { backgroundColor: chip.backgroundColor }]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      chip.textColor != null ? { color: chip.textColor } : null,
                    ]}
                  >
                    {chip.label}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
        {rightAction != null ? (
          <View style={styles.rightActionContainer}>{rightAction}</View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 4,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  backButton: {
    width: 40,
    height: 40,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 24,
    color: GREEN,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: INK,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#6B7280',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rightActionContainer: {
    marginLeft: 8,
    alignSelf: 'flex-start',
    minHeight: 40,
    justifyContent: 'center',
  },
});
