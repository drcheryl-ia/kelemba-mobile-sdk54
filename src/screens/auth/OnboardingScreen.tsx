/**
 * Écran onboarding — présentation Kelemba (placeholder).
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>;

export const OnboardingScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.logoCircle}>
          <Ionicons name="people" size={64} color="#1A6B3C" />
        </View>
        <Text style={styles.title}>KELEMBA</Text>
        <Text style={styles.subtitle}>
          {t('app.taglineBilingual', 'Sécurise ton épargne communautaire')}
        </Text>
      </View>
      <Pressable
        style={styles.btn}
        onPress={() => navigation.navigate('Login')}
        accessibilityRole="button"
      >
        <Text style={styles.btnText}>{t('auth.login', 'Connexion')}</Text>
      </Pressable>
      <Pressable
        style={styles.link}
        onPress={() => navigation.navigate('Register')}
        accessibilityRole="button"
      >
        <Text style={styles.linkText}>
          {t('auth.noAccount', "Pas encore de compte ?")} {t('auth.createAccount', 'Créer un compte')}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    padding: 24,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A2E',
    marginTop: 24,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
  },
  btn: {
    backgroundColor: '#1A6B3C',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  link: {
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    color: '#6B7280',
  },
});
