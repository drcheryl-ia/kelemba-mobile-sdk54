/**
 * Carte de prévisualisation d'une tontine (invitation).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TontinePreview } from '@/api/types/api.types';

const FREQUENCY_LABELS: Record<string, string> = {
  DAILY: 'Quotidien',
  WEEKLY: 'Hebdomadaire',
  BIWEEKLY: 'Bi-hebdomadaire',
  MONTHLY: 'Mensuel',
};

export interface TontinePreviewCardProps {
  preview: TontinePreview;
}

export const TontinePreviewCard: React.FC<TontinePreviewCardProps> = ({ preview }) => {
  const { t } = useTranslation();
  const frequencyLabel = FREQUENCY_LABELS[preview.frequency] ?? preview.frequency;

  return (
    <View style={styles.card}>
      <Text style={styles.name}>{preview.name}</Text>
      <View style={styles.row}>
        <Text style={styles.label}>{t('register.previewAmount')}</Text>
        <Text style={styles.value}>{preview.amountPerShare.toLocaleString('fr-FR')} FCFA</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{t('register.previewFrequency')}</Text>
        <Text style={styles.value}>{frequencyLabel}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{t('register.previewCycles')}</Text>
        <Text style={styles.value}>{preview.totalCycles}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{t('register.previewMembers')}</Text>
        <Text style={styles.value}>{preview.memberCount}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#F0F4F0',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1A6B3C',
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A6B3C',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
});
