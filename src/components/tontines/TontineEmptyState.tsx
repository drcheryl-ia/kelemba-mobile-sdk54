import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';

export type TontineEmptyFilter =
  | 'all'
  | 'active'
  | 'draft'
  | 'pending'
  | 'completed';

export interface TontineEmptyStateProps {
  filter: TontineEmptyFilter;
  onCreatePress: () => void;
}

const MESSAGES: Record<
  TontineEmptyFilter,
  { title: string; subtitle: string }
> = {
  all: {
    title:
      'Vous n\'avez encore aucune tontine.\nCréez la vôtre ou attendez une invitation.',
    subtitle: '',
  },
  active: {
    title: 'Aucune tontine active pour le moment.',
    subtitle: '',
  },
  draft: {
    title: 'Aucun brouillon en cours.',
    subtitle: '',
  },
  pending: {
    title: 'Aucune invitation en attente.',
    subtitle: '',
  },
  completed: {
    title: 'Aucune tontine terminée.',
    subtitle: '',
  },
};

function GroupIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
        stroke={COLORS.primary}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export const TontineEmptyState: React.FC<TontineEmptyStateProps> = ({
  filter,
  onCreatePress,
}) => {
  const { title, subtitle } = MESSAGES[filter];
  const showCta = filter === 'all';

  return (
    <View style={styles.wrap}>
      <View style={styles.illus}>
        <GroupIcon />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle !== '' ? (
        <Text style={styles.subtitle}>{subtitle}</Text>
      ) : null}
      {showCta ? (
        <Pressable
          onPress={onCreatePress}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          accessibilityRole="button"
          accessibilityLabel="Créer une tontine"
        >
          <Text style={styles.ctaLabel}>Créer une tontine</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  illus: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.gray500,
    textAlign: 'center',
    lineHeight: 18,
  },
  cta: {
    alignSelf: 'stretch',
    minHeight: 48,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
  },
});
