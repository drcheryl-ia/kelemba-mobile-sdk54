import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '@/theme/colors';

export type TontineCreateType = 'ROTATIVE' | 'EPARGNE';

export interface CreateStepHeaderProps {
  steps: Array<{ label: string }>;
  currentStep: number;
  tontineType: TontineCreateType;
  onTypeChange: (t: TontineCreateType) => void;
}

export const CreateStepHeader: React.FC<CreateStepHeaderProps> = ({
  steps,
  currentStep,
  tontineType,
  onTypeChange,
}) => {
  return (
    <View style={styles.wrap}>
      <View style={styles.typeToggle}>
        <Pressable
          onPress={() => onTypeChange('ROTATIVE')}
          style={[
            styles.typeBtn,
            tontineType === 'ROTATIVE' && styles.typeBtnSelected,
          ]}
          accessibilityRole="tab"
          accessibilityState={{ selected: tontineType === 'ROTATIVE' }}
        >
          <Text
            style={[
              styles.typeBtnTxt,
              tontineType === 'ROTATIVE' && styles.typeBtnTxtSelected,
            ]}
          >
            Tontine rotative
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onTypeChange('EPARGNE')}
          style={[
            styles.typeBtn,
            tontineType === 'EPARGNE' && styles.typeBtnSelected,
          ]}
          accessibilityRole="tab"
          accessibilityState={{ selected: tontineType === 'EPARGNE' }}
        >
          <Text
            style={[
              styles.typeBtnTxt,
              tontineType === 'EPARGNE' && styles.typeBtnTxtSelected,
            ]}
          >
            Tontine épargne
          </Text>
        </Pressable>
      </View>

      <View style={styles.stepperRow}>
        {steps.map((step, i) => (
          <View key={step.label} style={styles.stepCol}>
            <View style={styles.stepTopRow}>
              {i > 0 ? (
                <View
                  style={[
                    styles.connector,
                    {
                      backgroundColor:
                        i <= currentStep ? COLORS.secondary : 'rgba(255,255,255,0.25)',
                    },
                  ]}
                />
              ) : null}
              <View
                style={styles.circleWrap}
                accessibilityElementsHidden={false}
                importantForAccessibility="yes"
                accessibilityLabel={`Étape ${i + 1} sur ${steps.length}, ${step.label}, ${
                  i < currentStep ? 'complétée' : i === currentStep ? 'en cours' : 'à venir'
                }`}
              >
                {i < currentStep ? (
                  <View style={[styles.circle, styles.circleDone]}>
                    <Text style={styles.check}>✓</Text>
                  </View>
                ) : i === currentStep ? (
                  <View style={[styles.circle, styles.circleActive]}>
                    <Text style={styles.circleNumActive}>{i + 1}</Text>
                  </View>
                ) : (
                  <View style={[styles.circle, styles.circleTodo]}>
                    <Text style={styles.circleNumTodo}>{i + 1}</Text>
                  </View>
                )}
              </View>
              {i < steps.length - 1 ? (
                <View
                  style={[
                    styles.connector,
                    {
                      backgroundColor:
                        i + 1 <= currentStep ? COLORS.secondary : 'rgba(255,255,255,0.25)',
                    },
                  ]}
                />
              ) : null}
            </View>
            <Text
              style={[
                styles.stepLabel,
                i === currentStep ? styles.stepLabelActive : styles.stepLabelIdle,
              ]}
              numberOfLines={2}
            >
              {step.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  typeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 10,
    padding: 3,
    gap: 3,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  typeBtnSelected: {
    backgroundColor: COLORS.white,
  },
  typeBtnTxt: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  typeBtnTxtSelected: {
    color: COLORS.primary,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 4,
  },
  stepCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  stepTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  connector: {
    flex: 1,
    height: 1,
    maxHeight: 1,
  },
  circleWrap: {
    width: 28,
    alignItems: 'center',
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDone: {
    backgroundColor: COLORS.secondary,
  },
  circleActive: {
    backgroundColor: COLORS.white,
  },
  circleTodo: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  check: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A5C38',
  },
  circleNumActive: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  circleNumTodo: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  stepLabel: {
    fontSize: 9,
    textAlign: 'center',
    lineHeight: 12,
  },
  stepLabelActive: {
    color: COLORS.white,
    fontWeight: '500',
  },
  stepLabelIdle: {
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '400',
  },
});
