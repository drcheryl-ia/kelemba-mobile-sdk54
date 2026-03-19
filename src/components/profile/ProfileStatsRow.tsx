import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';

export interface ProfileStatsRowProps {
  totalCotise: number;
  tontinesTerminees: number;
  tontinesActives: number;
  isLoading: boolean;
}

function formatFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
}

export const ProfileStatsRow: React.FC<ProfileStatsRowProps> = ({
  totalCotise,
  tontinesTerminees,
  tontinesActives,
  isLoading,
}) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <SkeletonBlock width="100%" height={80} borderRadius={12} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.block}>
        <View style={[styles.iconWrap, { backgroundColor: '#FFF3E0' }]}>
          <Ionicons name="wallet-outline" size={24} color="#F5A623" />
        </View>
        <Text style={styles.value}>{formatFCFA(totalCotise)}</Text>
        <Text style={styles.label}>{t('profile.totalCotise')}</Text>
      </View>
      <View style={styles.block}>
        <View style={[styles.iconWrap, { backgroundColor: '#E8F5E9' }]}>
          <Ionicons name="checkmark-circle-outline" size={24} color="#1A6B3C" />
        </View>
        <Text style={styles.value}>{tontinesTerminees}</Text>
        <Text style={styles.label}>{t('profile.tontinesTerminees')}</Text>
      </View>
      <View style={styles.block}>
        <View style={[styles.iconWrap, { backgroundColor: '#E3F2FD' }]}>
          <Ionicons name="people-outline" size={24} color="#0055A5" />
        </View>
        <Text style={styles.value}>{tontinesActives}</Text>
        <Text style={styles.label}>{t('profile.tontinesActives')}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 16,
    gap: 12,
  },
  block: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  value: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  label: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
});
