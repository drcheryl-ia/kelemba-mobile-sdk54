import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/navigation/types';
import { COLORS } from '@/theme/colors';

type Props = NativeStackScreenProps<AuthStackParamList, 'AccountTypeChoice'>;

function IconPeople(): React.ReactElement {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
        stroke={COLORS.primary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
        stroke={COLORS.primary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke={COLORS.primary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconStar(): React.ReactElement {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        stroke={COLORS.secondaryText}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconInfoSmall(): React.ReactElement {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
        stroke={COLORS.gray500}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 16v-4M12 8h.01"
        stroke={COLORS.gray500}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function AccountChoiceHeader({
  onBack,
}: {
  onBack: () => void;
}): React.ReactElement {
  return (
    <View style={headerStyles.wrap}>
      <View style={headerStyles.row}>
        <Pressable
          onPress={onBack}
          style={headerStyles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </Pressable>
        <Text style={headerStyles.title}>Créer un compte</Text>
      </View>
      <Text style={headerStyles.subtitle}>
        Choisissez comment vous souhaitez utiliser Kelemba
      </Text>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  wrap: {
    backgroundColor: '#1A6B3C',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.white,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 18,
  },
});

function AccountChoiceBody({
  onJoinTontine,
  onOrganizer,
  onLogin,
}: {
  onJoinTontine: () => void;
  onOrganizer: () => void;
  onLogin: () => void;
}): React.ReactElement {
  return (
    <View>
      <Text style={bodyStyles.heading}>Quel est votre profil ?</Text>
      <Text style={bodyStyles.subheading}>
        Votre choix détermine le type de compte créé
      </Text>

      <Pressable
        onPress={onJoinTontine}
        accessibilityRole="button"
        accessibilityLabel="Rejoindre une tontine, créer un compte Membre"
        style={({ pressed }) => [
          cardStyles.card,
          pressed && cardStyles.cardPressed,
        ]}
      >
        <View style={cardStyles.row}>
          <View style={[cardStyles.iconBox, { backgroundColor: COLORS.primaryLight }]}>
            <IconPeople />
          </View>
          <View style={cardStyles.textCol}>
            <Text style={cardStyles.cardTitle}>Rejoindre une tontine</Text>
            <Text style={cardStyles.cardDesc}>
              Vous avez reçu un lien ou un QR Code d&apos;invitation. Collez le
              lien ou scannez pour commencer.
            </Text>
            <View style={cardStyles.badgeMembre}>
              <Text style={cardStyles.badgeMembreText}>Compte Membre</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.gray200} />
        </View>
      </Pressable>

      <Pressable
        onPress={onOrganizer}
        accessibilityRole="button"
        accessibilityLabel="Créer et gérer des tontines, compte Organisatrice"
        style={({ pressed }) => [
          cardStyles.card,
          pressed && cardStyles.cardPressed,
        ]}
      >
        <View style={cardStyles.row}>
          <View style={[cardStyles.iconBox, { backgroundColor: COLORS.secondaryBg }]}>
            <IconStar />
          </View>
          <View style={cardStyles.textCol}>
            <Text style={cardStyles.cardTitle}>
              Créer et gérer des tontines
            </Text>
            <Text style={cardStyles.cardDesc}>
              Vous souhaitez organiser des tontines pour votre communauté. KYC
              obligatoire.
            </Text>
            <View style={cardStyles.badgeOrg}>
              <Text style={cardStyles.badgeOrgText}>Compte Organisatrice</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.gray200} />
        </View>
      </Pressable>

      <View style={bodyStyles.infoNote}>
        <IconInfoSmall />
        <Text style={bodyStyles.infoNoteText}>
          Un compte Membre peut être converti en Organisatrice plus tard depuis
          votre profil, après vérification KYC.
        </Text>
      </View>

      <Pressable onPress={onLogin} accessibilityRole="button">
        <Text style={bodyStyles.loginLink}>
          Déjà un compte ? Se connecter
        </Text>
      </Pressable>
    </View>
  );
}

const bodyStyles = StyleSheet.create({
  heading: {
    fontSize: 17,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subheading: {
    fontSize: 12,
    color: COLORS.gray500,
    marginBottom: 18,
  },
  infoNote: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: COLORS.gray100,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  infoNoteText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.gray500,
    lineHeight: 15.4,
  },
  loginLink: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    color: COLORS.gray700,
  },
});

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    padding: 16,
    marginBottom: 12,
    backgroundColor: COLORS.white,
  },
  cardPressed: {
    opacity: 0.92,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginBottom: 3,
  },
  cardDesc: {
    fontSize: 11,
    color: COLORS.gray500,
    lineHeight: 15.4,
  },
  badgeMembre: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primaryLight,
    borderRadius: 20,
    paddingVertical: 2,
    paddingHorizontal: 8,
    marginTop: 6,
  },
  badgeMembreText: {
    fontSize: 9,
    fontWeight: '500',
    color: COLORS.primaryDark,
  },
  badgeOrg: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.secondaryBg,
    borderRadius: 20,
    paddingVertical: 2,
    paddingHorizontal: 8,
    marginTop: 6,
  },
  badgeOrgText: {
    fontSize: 9,
    fontWeight: '500',
    color: COLORS.secondaryText,
  },
});

export const AccountTypeChoiceScreen: React.FC<Props> = ({ navigation }) => (
  <SafeAreaView style={styles.safe} edges={['top']}>
    <AccountChoiceHeader onBack={() => navigation.goBack()} />
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      <AccountChoiceBody
        onJoinTontine={() => navigation.navigate('JoinTontine')}
        onOrganizer={() =>
          navigation.navigate('Register', { mode: 'ORGANISATEUR' })
        }
        onLogin={() => navigation.goBack()}
      />
    </ScrollView>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#1A6B3C',
  },
  scroll: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
});
