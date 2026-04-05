import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '@/theme/colors';

export interface FormNavButtonsProps {
  currentStep: number;
  totalSteps: number;
  onPrev: () => void;
  onNext: () => void;
  isLastStep: boolean;
  isSubmitting?: boolean;
  /** Remplace le libellé d’accessibilité du bouton principal (hors dernière étape). */
  nextAccessibilityLabel?: string;
  /** Remplace le libellé d’accessibilité du bouton « Créer » (dernière étape). */
  createAccessibilityLabel?: string;
}

export const FormNavButtons: React.FC<FormNavButtonsProps> = ({
  currentStep,
  totalSteps: _totalSteps,
  onPrev,
  onNext,
  isLastStep,
  isSubmitting = false,
  nextAccessibilityLabel,
  createAccessibilityLabel,
}) => {
  const showPrev = currentStep > 0;
  const nextFlex = showPrev ? 2 : 1;

  return (
    <View style={styles.bar}>
      {showPrev ? (
        <Pressable
          onPress={onPrev}
          style={[styles.btnPrev, { flex: 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Étape précédente"
        >
          <Text style={styles.btnPrevTxt}>Précédent</Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={onNext}
        style={[
          isLastStep ? styles.btnCreate : styles.btnNext,
          { flex: nextFlex },
        ]}
        disabled={isSubmitting}
        accessibilityRole="button"
        accessibilityLabel={
          isLastStep
            ? createAccessibilityLabel ?? 'Créer la tontine'
            : nextAccessibilityLabel ?? "Passer à l'étape suivante"
        }
        accessibilityState={{ disabled: isSubmitting }}
      >
        {isSubmitting ? (
          <ActivityIndicator
            color={isLastStep ? '#1A5C38' : COLORS.white}
            size="small"
          />
        ) : (
          <Text style={isLastStep ? styles.btnCreateTxt : styles.btnNextTxt}>
            {isLastStep ? 'Créer la tontine' : 'Suivant'}
          </Text>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    backgroundColor: COLORS.gray100,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.gray200,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 10,
  },
  btnPrev: {
    minHeight: 48,
    backgroundColor: COLORS.white,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrevTxt: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.gray700,
  },
  btnNext: {
    minHeight: 48,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnNextTxt: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.white,
  },
  btnCreate: {
    minHeight: 48,
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCreateTxt: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A5C38',
  },
});
