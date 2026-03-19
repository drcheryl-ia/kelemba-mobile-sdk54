import React from 'react';
import { View, Text, Switch, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export interface ProfileSettingsProps {
  language: 'fr' | 'sango';
  onLanguageChange: (lang: 'fr' | 'sango') => void;
  notificationsEnabled: boolean;
  onNotificationsChange: (value: boolean) => void;
  biometricsEnabled: boolean;
  onBiometricsChange: (value: boolean) => void;
  onSecurityPress: () => void;
}

function SettingRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {children}
    </View>
  );
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({
  language,
  onLanguageChange,
  notificationsEnabled,
  onNotificationsChange,
  biometricsEnabled,
  onBiometricsChange,
  onSecurityPress,
}) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <SettingRow label={t('profile.language')}>
          <View style={styles.pills}>
            <Pressable
              style={[
                styles.pill,
                language === 'fr' && styles.pillActive,
              ]}
              onPress={() => onLanguageChange('fr')}
            >
              <Text
                style={[
                  styles.pillText,
                  language === 'fr' && styles.pillTextActive,
                ]}
              >
                FR
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.pill,
                language === 'sango' && styles.pillActive,
              ]}
              onPress={() => onLanguageChange('sango')}
            >
              <Text
                style={[
                  styles.pillText,
                  language === 'sango' && styles.pillTextActive,
                ]}
              >
                Sango
              </Text>
            </Pressable>
          </View>
        </SettingRow>

        <SettingRow label={t('profile.notifications')}>
          <Switch
            value={notificationsEnabled}
            onValueChange={onNotificationsChange}
            trackColor={{ false: '#E5E7EB', true: '#1A6B3C' }}
            thumbColor="#FFFFFF"
          />
        </SettingRow>

        <SettingRow label={t('profile.biometrics')}>
          <Switch
            value={biometricsEnabled}
            onValueChange={onBiometricsChange}
            trackColor={{ false: '#E5E7EB', true: '#1A6B3C' }}
            thumbColor="#FFFFFF"
          />
        </SettingRow>

        <Pressable style={[styles.row, styles.rowLast]} onPress={onSecurityPress}>
          <Text style={styles.rowLabel}>{t('profile.security')}</Text>
          <Ionicons name="chevron-forward" size={20} color="#6B7280" />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginHorizontal: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rowLabel: {
    fontSize: 15,
    color: '#1A1A2E',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  pills: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  pillActive: {
    backgroundColor: '#1A6B3C',
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
});
