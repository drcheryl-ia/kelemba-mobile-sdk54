import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';

export interface BalanceCardProps {
  totalBalance: number;
  activeTontinesCount: number;
  isLoading: boolean;
  /** Désactive marginHorizontal quand la card est dans GradientBorderCard */
  compact?: boolean;
}

const formatFCFA = (amount: number): string =>
  new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';

export const BalanceCard: React.FC<BalanceCardProps> = ({
  totalBalance,
  activeTontinesCount,
  isLoading,
  compact = false,
}) => {
  const cardStyle = [styles.card, compact && styles.cardCompact];
  if (isLoading) {
    return (
      <View style={cardStyle}>
        <SkeletonBlock width="100%" height={100} borderRadius={16} />
      </View>
    );
  }

  return (
    <View style={cardStyle}>
      <Text style={styles.label}>SOLDE ESTIMÉ</Text>
      <Text style={styles.amount}>{formatFCFA(totalBalance)}</Text>
      <Text style={styles.subtitle}>
        Répartis sur {activeTontinesCount} tontine{activeTontinesCount > 1 ? 's' : ''} active
        {activeTontinesCount > 1 ? 's' : ''}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardCompact: {
    marginHorizontal: 0,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  amount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
});
