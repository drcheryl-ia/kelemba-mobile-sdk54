/**
 * Bandeau d'alerte — retard de versement.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

export interface DelayBannerProps {
  pendingReason: string;
}

export const DelayBanner: React.FC<DelayBannerProps> = ({ pendingReason }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.banner}>
      <Ionicons name="warning" size={24} color="#D0021B" />
      <View style={styles.content}>
        <Text style={styles.reason}>{pendingReason}</Text>
        <Text style={styles.reassurance}>
          {t('rotation.delayReassurance')}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF0F0',
    borderLeftWidth: 4,
    borderLeftColor: '#D0021B',
    padding: 12,
    borderRadius: 0,
    marginBottom: 16,
    gap: 12,
  },
  content: {
    flex: 1,
  },
  reason: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  reassurance: {
    fontSize: 12,
    color: '#8E8E93',
  },
});
