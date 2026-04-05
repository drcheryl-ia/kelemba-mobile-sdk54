import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';
import { KelembaBadge } from '@/components/common/KelembaBadge';

export interface UpgradeToOrganiserSectionProps {
  onContinue: () => void;
}

export const UpgradeToOrganiserSection: React.FC<UpgradeToOrganiserSectionProps> = ({
  onContinue,
}) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Compte Organisatrice</Text>
      <View style={styles.card}>
        <Pressable
          onPress={() =>
            Alert.alert(
              'Passer en compte Organisatrice ?',
              'Ce changement est irréversible. Votre KYC doit être vérifié.',
              [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Continuer', onPress: onContinue },
              ]
            )
          }
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.92 }]}
          accessibilityRole="button"
          accessibilityLabel="Passer en compte Organisatrice Créer et gérer des tontines · KYC requis"
        >
          <View style={styles.iconBox}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                stroke={COLORS.secondaryText}
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <View style={styles.textCol}>
            <Text style={styles.label}>Passer en compte Organisatrice</Text>
            <Text style={styles.sublabel}>
              Créer et gérer des tontines · KYC requis
            </Text>
          </View>
          <KelembaBadge variant="draft" label="Disponible" />
          <Text style={styles.chev}>›</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: COLORS.secondaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  sublabel: {
    fontSize: 11,
    color: COLORS.gray500,
    marginTop: 2,
  },
  chev: {
    fontSize: 22,
    color: COLORS.gray200,
  },
});
