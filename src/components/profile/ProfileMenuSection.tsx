import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '@/navigation/types';
import type { UserProfileResponseDto } from '@/types/user.types';
import type { KycStatus } from '@/api/types/api.types';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';
import { KelembaBadge } from '@/components/common/KelembaBadge';
import { maskPhone } from '@/utils/formatters';

export interface ProfileMenuSectionProps {
  user: UserProfileResponseDto | null;
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'Profile'>;
  biometricsEnabled: boolean;
  paymentPhoneMasked?: string | null;
}

function kycBadge(status: KycStatus): React.ReactElement {
  switch (status) {
    case 'VERIFIED':
      return <KelembaBadge variant="active" label="Vérifié" />;
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
      return <KelembaBadge variant="info" label="En cours" />;
    case 'PENDING':
      return <KelembaBadge variant="pending" label="À compléter" />;
    case 'REJECTED':
      return <KelembaBadge variant="danger" label="Refusé" />;
    default:
      return <KelembaBadge variant="pending" label="—" />;
  }
}

function kycUpdatedLabel(user: UserProfileResponseDto | null): string {
  if (user == null) return '—';
  const d = new Date(user.createdAt);
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

interface MenuItemProps {
  iconBg: string;
  iconStroke: string;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  badgeElement?: React.ReactNode;
  chevron?: boolean;
  onPress: () => void;
}

function MenuItem({
  iconBg,
  iconStroke,
  icon,
  label,
  sublabel,
  badgeElement,
  chevron = true,
  onPress,
}: MenuItemProps): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${sublabel}`}
    >
      <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <View style={styles.textCol}>
        <Text style={styles.menuLabel}>{label}</Text>
        <Text style={styles.menuSub} numberOfLines={2}>
          {sublabel}
        </Text>
      </View>
      <View style={styles.rightCol}>
        {badgeElement}
        {chevron ? <Text style={styles.chev}>›</Text> : null}
      </View>
    </Pressable>
  );
}

export const ProfileMenuSection: React.FC<ProfileMenuSectionProps> = ({
  user,
  navigation,
  biometricsEnabled,
  paymentPhoneMasked,
}) => {
  const phoneMasked =
    paymentPhoneMasked != null && paymentPhoneMasked !== ''
      ? maskPhone(paymentPhoneMasked)
      : user != null
        ? maskPhone(user.phone)
        : '—';

  const paymentSubtitle =
    paymentPhoneMasked != null && paymentPhoneMasked !== ''
      ? `Orange Money · ${phoneMasked}`
      : 'Aucun lié';

  const paymentBadge =
    paymentPhoneMasked != null && paymentPhoneMasked !== '' ? (
      <KelembaBadge variant="active" label="Lié" />
    ) : (
      <KelembaBadge variant="pending" label="Ajouter" />
    );

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Mon compte</Text>
      <View style={styles.card}>
        <MenuItem
          iconBg={COLORS.primaryLight}
          iconStroke={COLORS.primaryDark}
          icon={
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21v-2a4 4 0 014-4h8a4 4 0 014 4v2"
                stroke={COLORS.primaryDark}
                strokeWidth={1.8}
                strokeLinecap="round"
              />
            </Svg>
          }
          label="Identité et KYC"
          sublabel={`CNI / Passeport · Mise à jour : ${kycUpdatedLabel(user)}`}
          badgeElement={user != null ? kycBadge(user.kycStatus) : null}
          onPress={() => navigation.navigate('KycUpload', { origin: 'profile' })}
        />
        <View style={styles.divider} />
        <MenuItem
          iconBg={COLORS.accentLight}
          iconStroke={COLORS.accentDark}
          icon={
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M4 7h16M4 12h16M4 17h10"
                stroke={COLORS.accentDark}
                strokeWidth={1.8}
                strokeLinecap="round"
              />
            </Svg>
          }
          label="Moyens de paiement"
          sublabel={paymentSubtitle}
          badgeElement={paymentBadge}
          onPress={() =>
            Alert.alert('Moyens de paiement', 'Configuration bientôt disponible.')
          }
        />
        <View style={styles.divider} />
        <MenuItem
          iconBg={COLORS.gray100}
          iconStroke={COLORS.gray700}
          icon={
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 15a3 3 0 100-6 3 3 0 000 6z"
                stroke={COLORS.gray700}
                strokeWidth={1.8}
              />
              <Path
                d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
                stroke={COLORS.gray700}
                strokeWidth={0.8}
              />
            </Svg>
          }
          label="Sécurité du compte"
          sublabel={`Code PIN · Biométrie ${biometricsEnabled ? 'activée' : 'désactivée'}`}
          onPress={() => navigation.navigate('ChangePin')}
        />
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
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 12,
  },
  menuRowPressed: {
    opacity: 0.92,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  menuLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  menuSub: {
    fontSize: 11,
    color: COLORS.gray500,
    marginTop: 2,
  },
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chev: {
    fontSize: 22,
    color: COLORS.gray200,
    fontWeight: '300',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.gray100,
    marginLeft: 62,
  },
});
