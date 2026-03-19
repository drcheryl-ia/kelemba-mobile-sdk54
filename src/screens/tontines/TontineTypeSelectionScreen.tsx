/**
 * Sélection du type de tontine avant création — Rotative ou Épargne.
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { logger } from '@/utils/logger';

type Nav = NativeStackNavigationProp<RootStackParamList, 'TontineTypeSelectionScreen'>;

// ─── Données des cartes ───────────────────────────────────────────

const TONTINE_TYPES = [
  {
    type: 'ROTATIVE' as const,
    label: 'Tontine Rotative',
    emoji: '🔄',
    description:
      'Chaque membre verse une cotisation fixe. À tour de rôle, un membre reçoit la cagnotte complète.',
    details: [
      'Montant fixe par période',
      'Chaque membre reçoit une fois',
      'Idéal pour les achats importants',
    ],
    accentColor: '#1A6B3C',
    route: 'CreateTontine' as const,
  },
  {
    type: 'EPARGNE' as const,
    label: 'Tontine Épargne',
    emoji: '🏦',
    description:
      'Chaque membre épargne à son rythme dans un cadre collectif. À la date de déblocage, chacun récupère son capital.',
    details: [
      'Montant flexible (minimum défini)',
      'Chaque membre garde son argent',
      'Idéal pour se constituer une épargne',
    ],
    accentColor: '#0055A5',
    route: 'SavingsCreateScreen' as const,
  },
] as const;

// ─── Composant ────────────────────────────────────────────────────

export function TontineTypeSelectionScreen() {
  const navigation = useNavigation<Nav>();

  const handleSelect = (route: 'CreateTontine' | 'SavingsCreateScreen') => {
    logger.info('[TontineTypeSelection] Type sélectionné → ' + route);
    navigation.navigate(route);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Quel type de tontine{'\n'}souhaitez-vous créer ?</Text>
        <Text style={styles.subtitle}>
          Choisissez le modèle adapté à votre groupe.
        </Text>

        {TONTINE_TYPES.map((item) => (
          <TouchableOpacity
            key={item.type}
            style={[styles.card, { borderTopColor: item.accentColor }]}
            onPress={() => handleSelect(item.route)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Créer une tontine ${item.label}`}
          >
            {/* En-tête de la carte */}
            <View style={styles.cardHeader}>
              <Text style={styles.cardEmoji}>{item.emoji}</Text>
              <View style={styles.cardTitleBlock}>
                <Text style={[styles.cardLabel, { color: item.accentColor }]}>
                  {item.label}
                </Text>
              </View>
              <Text style={styles.cardChevron}>›</Text>
            </View>

            {/* Description */}
            <Text style={styles.cardDescription}>{item.description}</Text>

            {/* Points clés */}
            <View style={styles.detailsBlock}>
              {item.details.map((d) => (
                <View key={d} style={styles.detailRow}>
                  <Text style={[styles.detailDot, { color: item.accentColor }]}>•</Text>
                  <Text style={styles.detailText}>{d}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 40,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A2E',
    lineHeight: 32,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderTopWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  cardTitleBlock: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 17,
    fontWeight: '700',
  },
  cardChevron: {
    fontSize: 24,
    color: '#CCCCCC',
    fontWeight: '300',
  },
  cardDescription: {
    fontSize: 14,
    color: '#444',
    lineHeight: 21,
    marginBottom: 14,
  },
  detailsBlock: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  detailDot: {
    fontSize: 16,
    lineHeight: 20,
  },
  detailText: {
    fontSize: 13,
    color: '#555',
    lineHeight: 20,
    flex: 1,
  },
});
