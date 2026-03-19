/**
 * Choix du type de compte — MEMBRE ou ORGANISATEUR.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

const PRIMARY = '#1A6B3C';
const CTA = '#F5A623';

export interface AccountTypePickerProps {
  onSelectMember: () => void;
  onSelectOrganizer: () => void;
}

export const AccountTypePicker: React.FC<AccountTypePickerProps> = ({
  onSelectMember,
  onSelectOrganizer,
}) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('register.accountTypeTitle')}</Text>

      <Pressable
        onPress={onSelectMember}
        style={({ pressed }) => [styles.option, styles.optionMember, pressed && styles.pressed]}
      >
        <View style={styles.iconWrapper}>
          <Ionicons name="people" size={28} color={PRIMARY} />
        </View>
        <View style={styles.textWrapper}>
          <Text style={[styles.optionTitle, { color: PRIMARY }]}>
            {t('register.accountTypeMember')}
          </Text>
          <Text style={styles.optionSub}>{t('register.accountTypeMemberSub')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={PRIMARY} />
      </Pressable>

      <Pressable
        onPress={onSelectOrganizer}
        style={({ pressed }) => [styles.option, styles.optionOrganizer, pressed && styles.pressed]}
      >
        <View style={[styles.iconWrapper, { backgroundColor: 'rgba(245,166,35,0.2)' }]}>
          <Ionicons name="briefcase" size={28} color={CTA} />
        </View>
        <View style={styles.textWrapper}>
          <Text style={[styles.optionTitle, { color: CTA }]}>
            {t('register.accountTypeOrganizer')}
          </Text>
          <Text style={styles.optionSub}>{t('register.accountTypeOrganizerSub')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={CTA} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    minHeight: 56,
  },
  optionMember: {
    backgroundColor: 'rgba(26,107,60,0.08)',
    borderColor: PRIMARY,
  },
  optionOrganizer: {
    backgroundColor: 'rgba(245,166,35,0.12)',
    borderColor: CTA,
  },
  pressed: {
    opacity: 0.8,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(26,107,60,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textWrapper: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  optionSub: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
});
