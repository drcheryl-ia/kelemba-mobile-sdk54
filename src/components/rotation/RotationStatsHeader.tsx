/**
 * Cartes statistiques — Montant Global + Prochain Tour.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatFcfa } from '@/utils/formatters';

export interface RotationStatsHeaderProps {
  totalAmount: number;
  nextTourNumber: number;
}

export const RotationStatsHeader: React.FC<RotationStatsHeaderProps> = ({
  totalAmount,
  nextTourNumber,
}) => {
  const { t } = useTranslation();
  const formattedAmount = formatFcfa(totalAmount);

  return (
    <View style={styles.row}>
      <View style={styles.cardLeft}>
        <Text style={styles.labelLeft}>{t('rotation.globalAmount')}</Text>
        <Text style={styles.valueLeft}>{formattedAmount}</Text>
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.labelRight}>{t('rotation.nextTour')}</Text>
        <Text style={styles.valueRight}>
          {t('rotation.tourNumber', { number: nextTourNumber })}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  cardLeft: {
    flex: 1,
    backgroundColor: '#F0F4F0',
    borderRadius: 16,
    padding: 16,
  },
  labelLeft: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  valueLeft: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A3C2E',
  },
  cardRight: {
    flex: 1,
    backgroundColor: '#1A3C2E',
    borderRadius: 16,
    padding: 16,
  },
  labelRight: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  valueRight: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
