/**
 * En-tête assistant activation — progression + onglets étapes.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS } from '@/theme/colors';
import type { RootStackParamList } from '@/navigation/types';

export type ActivationStep = 'shares' | 'order';

export interface ActivationHeaderProps {
  tontineName: string;
  currentStep: ActivationStep;
  onStepChange: (step: ActivationStep) => void;
  navigation: NativeStackNavigationProp<RootStackParamList>;
}

export const ActivationHeader: React.FC<ActivationHeaderProps> = ({
  tontineName,
  currentStep,
  onStepChange,
  navigation,
}) => {
  const progress = useRef(new Animated.Value(currentStep === 'shares' ? 0.5 : 1)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: currentStep === 'shares' ? 0.5 : 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [currentStep, progress]);

  const fillWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['50%', '100%'],
  });

  const stepNum = currentStep === 'shares' ? 1 : 2;

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </Pressable>
        <Text style={styles.title}>Activer la tontine</Text>
      </View>

      <View style={styles.progressBox}>
        <View style={styles.progressTop}>
          <Text style={styles.tontineName} numberOfLines={1}>
            {tontineName}
          </Text>
          <Text style={styles.stepLabel}>
            Étape {stepNum} / 2
          </Text>
        </View>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: fillWidth }]} />
        </View>
      </View>

      <View style={styles.tabBar}>
        <Pressable
          onPress={() => onStepChange('shares')}
          style={[
            styles.tabBtn,
            currentStep === 'shares' && styles.tabBtnOn,
          ]}
        >
          <Text
            style={[
              styles.tabTxt,
              currentStep === 'shares' && styles.tabTxtOn,
            ]}
          >
            Parts par membre
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onStepChange('order')}
          style={[
            styles.tabBtn,
            currentStep === 'order' && styles.tabBtnOn,
          ]}
        >
          <Text
            style={[
              styles.tabTxt,
              currentStep === 'order' && styles.tabTxtOn,
            ]}
          >
            Ordre de rotation
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
    color: COLORS.white,
  },
  progressBox: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  progressTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tontineName: {
    flex: 1,
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    marginRight: 8,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.white,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    backgroundColor: COLORS.secondary,
    borderRadius: 3,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnOn: {
    backgroundColor: COLORS.white,
  },
  tabTxt: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  tabTxtOn: {
    color: COLORS.primary,
  },
});
