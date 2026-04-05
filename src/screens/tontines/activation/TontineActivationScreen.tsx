/**
 * Assistant d'activation — parts (étape 1) puis ordre de rotation (étape 2).
 */
import React, { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { COLORS } from '@/theme/colors';
import { useTontineDetails } from '@/hooks/useTontineDetails';
import { ActivationHeader, type ActivationStep } from './ActivationHeader';
import { SharesStep } from './SharesStep';
import { OrderStep } from './OrderStep';

export type TontineActivationScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'TontineActivationScreen'
>;

export const TontineActivationScreen: React.FC<TontineActivationScreenProps> = ({
  route,
}) => {
  const { tontineUid, initialStep } = route.params;
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { tontine } = useTontineDetails(tontineUid);

  const [currentStep, setCurrentStep] = useState<ActivationStep>(
    initialStep ?? 'shares'
  );

  const onNext = useCallback(() => setCurrentStep('order'), []);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ActivationHeader
        tontineName={tontine?.name ?? '…'}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        navigation={navigation}
      />
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {currentStep === 'shares' && (
            <SharesStep tontineUid={tontineUid} onNext={onNext} />
          )}
          {currentStep === 'order' && (
            <OrderStep
              tontineUid={tontineUid}
              onPrev={() => setCurrentStep('shares')}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.primary },
  kav: { flex: 1 },
  scroll: { flex: 1, backgroundColor: COLORS.gray100 },
  scrollContent: { padding: 16, paddingBottom: 100 },
});
