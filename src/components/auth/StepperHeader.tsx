import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface StepperHeaderProps {
  /** Étape actuelle (1-based) pour compatibilité, ou steps + stepIndex pour flux dynamique */
  currentStep?: 1 | 2 | 3;
  /** Étapes personnalisées (ex. MEMBRE avec invitation) */
  steps?: readonly string[];
  /** Index de l'étape courante (0-based) quand steps fourni */
  stepIndex?: number;
}

const DEFAULT_STEPS = [
  { key: 1, label: 'IDENTITÉ' },
  { key: 2, label: 'SÉCURITÉ' },
  { key: 3, label: 'VÉRIFICATION' },
] as const;

const PRIMARY = '#1A6B3C';
const GRAY_BORDER = '#D1D5DB';
const GRAY_TEXT = '#9CA3AF';

export const StepperHeader: React.FC<StepperHeaderProps> = ({
  currentStep = 1,
  steps: customSteps,
  stepIndex,
}) => {
  const useCustom = customSteps && stepIndex !== undefined;
  const steps = useCustom
    ? customSteps.map((label, i) => ({ key: i + 1, label }))
    : DEFAULT_STEPS;
  const activeKey = useCustom ? stepIndex + 1 : currentStep;

  return (
    <View style={styles.container}>
      {steps.map((step, index) => {
        const isPast = step.key < activeKey;
        const isActive = step.key === activeKey;
        const isFuture = step.key > activeKey;
        const isLast = index === steps.length - 1;

        return (
          <React.Fragment key={step.key}>
            <View style={styles.stepWrapper}>
              <View
                style={[
                  styles.circle,
                  isPast && styles.circleFilled,
                  isActive && styles.circleFilled,
                  isFuture && styles.circleEmpty,
                ]}
              >
                {isPast ? (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                ) : (
                  <Text
                    style={[
                      styles.stepNumber,
                      isActive && styles.stepNumberActive,
                      isFuture && styles.stepNumberFuture,
                    ]}
                  >
                    {step.key}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.label,
                  (isPast || isActive) && styles.labelActive,
                  isFuture && styles.labelFuture,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {step.label}
              </Text>
            </View>
            {!isLast && (
              <View
                style={[
                  styles.connector,
                  isPast ? styles.connectorFilled : styles.connectorEmpty,
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
  stepWrapper: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleFilled: {
    backgroundColor: PRIMARY,
  },
  circleEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: GRAY_BORDER,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepNumberActive: {
    color: '#FFFFFF',
  },
  stepNumberFuture: {
    color: GRAY_TEXT,
  },
  label: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  labelActive: {
    color: PRIMARY,
  },
  labelFuture: {
    color: GRAY_TEXT,
  },
  connector: {
    width: 40,
    height: 2,
    marginTop: 15,
    marginHorizontal: 4,
  },
  connectorFilled: {
    backgroundColor: PRIMARY,
  },
  connectorEmpty: {
    backgroundColor: GRAY_BORDER,
  },
});
