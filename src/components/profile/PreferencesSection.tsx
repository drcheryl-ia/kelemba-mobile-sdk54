import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { navigationRef } from '@/navigation/navigationRef';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';
import { KelembaBadge } from '@/components/common/KelembaBadge';

export interface PreferencesSectionProps {
  languageLabel: string;
  onLanguagePress?: () => void;
  onReportsPress?: () => void;
}

function MenuRow(props: {
  iconBg: string;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  badge?: React.ReactNode;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.92 }]}
      accessibilityRole="button"
      accessibilityLabel={`${props.label} ${props.sublabel}`}
    >
      <View style={[styles.iconBox, { backgroundColor: props.iconBg }]}>
        {props.icon}
      </View>
      <View style={styles.textCol}>
        <Text style={styles.label}>{props.label}</Text>
        <Text style={styles.sublabel}>{props.sublabel}</Text>
      </View>
      {props.badge}
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}

export const PreferencesSection: React.FC<PreferencesSectionProps> = ({
  languageLabel,
  onLanguagePress,
  onReportsPress,
}) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Préférences</Text>
      <View style={styles.card}>
        <MenuRow
          iconBg="#EEEDFE"
          icon={
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
                stroke="#534AB7"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          }
          label="Notifications"
          sublabel="Push · SMS pour les paiements urgents"
          onPress={() => {
            if (navigationRef.isReady()) {
              navigationRef.navigate('NotificationsScreen');
            }
          }}
        />
        <View style={styles.divider} />
        <MenuRow
          iconBg={COLORS.gray100}
          icon={
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M4 5h16M4 12h16M4 19h8"
                stroke={COLORS.gray700}
                strokeWidth={1.8}
                strokeLinecap="round"
              />
            </Svg>
          }
          label="Langue"
          sublabel={languageLabel}
          badge={<KelembaBadge variant="pending" label="FR" />}
          onPress={() =>
            onLanguagePress != null
              ? onLanguagePress()
              : Alert.alert('Langue', 'Choix de langue bientôt disponible.')
          }
        />
        <View style={styles.divider} />
        <MenuRow
          iconBg={COLORS.gray100}
          icon={
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
                stroke={COLORS.gray700}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
                stroke={COLORS.gray700}
                strokeWidth={1.8}
                strokeLinecap="round"
              />
            </Svg>
          }
          label="Rapports et certificats"
          sublabel="Exporter mon historique PDF"
          onPress={() =>
            onReportsPress != null
              ? onReportsPress()
              : navigationRef.isReady() && navigationRef.navigate('PaymentHistory')
          }
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
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.gray100,
    marginLeft: 62,
  },
});
