import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import Constants from 'expo-constants';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/navigation/types';
import { useNetwork } from '@/hooks/useNetwork';

type Props = NativeStackScreenProps<AuthStackParamList, 'Splash'>;

export const SplashScreenComponent: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isConnected } = useNetwork();

  useEffect(() => {
    void SplashScreen.hideAsync();
    const timer = setTimeout(() => {
      navigation.replace('Onboarding');
    }, 3000);
    return () => clearTimeout(timer);
  }, [navigation]);

  const bottomInset = Math.max(insets.bottom, 32);

  return (
    <View style={styles.container}>
      <View style={styles.centered}>
        <View style={styles.logoCircle}>
          <Ionicons name="people" size={64} color="#1A5C38" />
        </View>
        <Text style={styles.title}>KELEMBA</Text>
        <Text style={styles.subtitle}>Votre tontine numérique</Text>
        <Text style={styles.slogan}>Tontine na yângâ</Text>
        <View style={styles.spinnerContainer}>
          <ActivityIndicator size="large" color="rgba(255,255,255,0.5)" />
        </View>
      </View>

      <View style={[styles.bottomLeft, { bottom: bottomInset }]}>
        <Ionicons name="wifi" size={16} color="#FFFFFF" />
        <Text style={styles.bottomText}>
          {isConnected !== false ? t('common.connected') : t('common.disconnected')}
        </Text>
      </View>

      <View style={[styles.bottomRight, { bottom: bottomInset }]}>
        <Text style={styles.bottomText}>
          v{Constants.expoConfig?.version ?? '1.0'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A5C38',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 38,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginTop: 24,
  },
  subtitle: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    marginTop: 8,
  },
  slogan: {
    color: '#FFFFFF',
    fontStyle: 'italic',
    fontSize: 14,
    opacity: 0.85,
    marginTop: 4,
  },
  spinnerContainer: {
    marginTop: 48,
  },
  bottomLeft: {
    position: 'absolute',
    left: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bottomRight: {
    position: 'absolute',
    right: 24,
  },
  bottomText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
});
