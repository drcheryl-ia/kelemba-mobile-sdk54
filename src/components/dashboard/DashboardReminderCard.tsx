/**
 * Shell visuel unique des rappels dashboard — aligné sur la carte héro membre (bordure, icône, CTA pleine largeur).
 */
import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  DASHBOARD_REMINDER_TONES,
  type DashboardReminderTone,
} from '@/components/dashboard/dashboardReminderTokens';

export type { DashboardReminderTone };

export interface DashboardReminderCardProps {
  tone: DashboardReminderTone;
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  /** Lignes complémentaires (montant, détail, pénalités…) sous le sous-titre */
  detailLines?: string[];
  ctaLabel: string;
  onPress: () => void;
  ctaDisabled?: boolean;
  accessibilityLabel?: string;
  /** Enveloppe animée (ex. entrée / pulse sur la 1re carte du banner) */
  animatedStyle?: StyleProp<ViewStyle>;
}

export const DashboardReminderCard: React.FC<DashboardReminderCardProps> = ({
  tone,
  iconName,
  title,
  subtitle,
  detailLines,
  ctaLabel,
  onPress,
  ctaDisabled = false,
  accessibilityLabel,
  animatedStyle,
}) => {
  const colors = DASHBOARD_REMINDER_TONES[tone];

  const shell = (
    <>
      <View style={styles.topRow}>
        <View style={[styles.iconCircle, { backgroundColor: colors.accent }]}>
          <Ionicons name={iconName} size={22} color="#FFFFFF" />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title} numberOfLines={3}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={4}>
            {subtitle}
          </Text>
          {detailLines?.map((line, i) => (
            <Text key={`d-${i}`} style={styles.detail} numberOfLines={3}>
              {line}
            </Text>
          ))}
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          style={[
            styles.ctaMain,
            { backgroundColor: colors.accent },
            ctaDisabled && styles.ctaDisabled,
          ]}
          onPress={onPress}
          disabled={ctaDisabled}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? `${ctaLabel} — ${title}`}
        >
          <Text style={styles.ctaMainText}>{ctaLabel}</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </>
  );

  const cardStyle = [
    styles.wrap,
    { backgroundColor: colors.bg, borderColor: colors.border },
    animatedStyle,
  ];

  if (animatedStyle != null) {
    return <Animated.View style={cardStyle}>{shell}</Animated.View>;
  }

  return <View style={cardStyle}>{shell}</View>;
};

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 20,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1C1C1E',
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 6,
    lineHeight: 20,
  },
  detail: {
    fontSize: 13,
    color: '#374151',
    marginTop: 4,
    lineHeight: 18,
  },
  actions: {
    marginTop: 16,
  },
  ctaMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  ctaDisabled: {
    opacity: 0.55,
  },
  ctaMainText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
