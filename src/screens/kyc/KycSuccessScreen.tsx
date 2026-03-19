import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { KycStackParamList, ProfileStackParamList } from '@/navigation/types';

type KycNavigationParamList = KycStackParamList & ProfileStackParamList;

interface Props {
  navigation: NativeStackNavigationProp<KycNavigationParamList, 'KycSuccess'>;
  route: RouteProp<KycNavigationParamList, 'KycSuccess'>;
}

export const KycSuccessScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const origin = route.params?.origin ?? 'kycGate';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="checkmark-circle" size={80} color="#1A6B3C" />
        </View>
        <Text style={styles.title}>{t('kyc.successSubmitted')}</Text>
        <Text style={styles.message}>{t('kyc.successInReview')}</Text>
        <Pressable
          style={styles.button}
          onPress={() => {
            if (origin === 'profile') {
              navigation.replace('Profile');
              return;
            }

            navigation.replace('KycPending');
          }}
        >
          <Text style={styles.buttonText}>
            {origin === 'profile' ? t('kyc.backToProfile') : t('kyc.viewStatus')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  iconWrap: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    backgroundColor: '#1A6B3C',
    borderRadius: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
