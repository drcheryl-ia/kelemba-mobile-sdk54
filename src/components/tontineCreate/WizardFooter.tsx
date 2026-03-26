/**
 * Pied de wizard sticky — Retour / Suivant ou CTA unique.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@/theme/spacing';

export interface WizardFooterProps {
  onBack: () => void;
  onPrimary: () => void;
  backDisabled?: boolean;
  primaryDisabled?: boolean;
  primaryLabel: string;
  backLabel: string;
  primaryColor: string;
  primaryLoading?: boolean;
  /** Afficher le bouton retour (étape 1 : souvent masqué ou désactivé) */
  showBack?: boolean;
}

export const WizardFooter: React.FC<WizardFooterProps> = ({
  onBack,
  onPrimary,
  backDisabled = false,
  primaryDisabled = false,
  primaryLabel,
  backLabel,
  primaryColor,
  primaryLoading = false,
  showBack = true,
}) => {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, spacing.sm);

  return (
    <View style={[styles.bar, { paddingBottom: bottomPad }]}>
      <View style={styles.row}>
        {showBack ? (
          <Pressable
            onPress={onBack}
            disabled={backDisabled}
            style={({ pressed }) => [
              styles.backBtn,
              backDisabled && styles.backBtnDisabled,
              pressed && !backDisabled && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: backDisabled }}
          >
            <Text style={[styles.backText, backDisabled && styles.backTextDisabled]}>{backLabel}</Text>
          </Pressable>
        ) : (
          <View style={styles.backPlaceholder} />
        )}
        <Pressable
          onPress={onPrimary}
          disabled={primaryDisabled || primaryLoading}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: primaryColor },
            (primaryDisabled || primaryLoading) && styles.primaryBtnDisabled,
            pressed && !primaryDisabled && !primaryLoading && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: primaryDisabled || primaryLoading }}
        >
          {primaryLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryText}>{primaryLabel}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: spacing.minTouchTarget,
  },
  backBtn: {
    minWidth: 100,
    minHeight: spacing.minTouchTarget,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
  },
  backBtnDisabled: {
    opacity: 0.45,
  },
  backPlaceholder: {
    minWidth: 100,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
  backTextDisabled: {
    color: '#9CA3AF',
  },
  primaryBtn: {
    flex: 1,
    minHeight: spacing.minTouchTarget,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.92,
  },
});
