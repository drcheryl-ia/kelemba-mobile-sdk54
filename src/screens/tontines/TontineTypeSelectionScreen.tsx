/**
 * Sélection du type de tontine avant création — Rotative ou Épargne.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  UIManager,
  LayoutAnimation,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '@/navigation/types';
import { logger } from '@/utils/logger';
import { spacing } from '@/theme/spacing';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Nav = NativeStackNavigationProp<RootStackParamList, 'TontineTypeSelectionScreen'>;

type CreationKind = 'ROTATIVE' | 'EPARGNE';

const GREEN = '#1A6B3C';
const BLUE = '#0055A5';
const INK = '#111827';
const MUTED = '#6B7280';

const KINDS: readonly {
  id: CreationKind;
  route: keyof Pick<RootStackParamList, 'CreateTontine' | 'SavingsCreateScreen'>;
  accent: string;
  icon: keyof typeof Ionicons.glyphMap;
  softBg: string;
  softBorder: string;
}[] = [
  {
    id: 'ROTATIVE',
    route: 'CreateTontine',
    accent: GREEN,
    icon: 'sync',
    softBg: '#F0FDF4',
    softBorder: '#BBF7D0',
  },
  {
    id: 'EPARGNE',
    route: 'SavingsCreateScreen',
    accent: BLUE,
    icon: 'wallet',
    softBg: '#EFF6FF',
    softBorder: '#BFDBFE',
  },
] as const;

export function TontineTypeSelectionScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<CreationKind | null>(null);

  const onSelectKind = useCallback((kind: CreationKind) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelected(kind);
  }, []);

  const handleContinue = useCallback(() => {
    if (selected == null) return;
    const cfg = KINDS.find((k) => k.id === selected);
    if (cfg == null) return;
    logger.info('[TontineTypeSelection] Type sélectionné → ' + cfg.route);
    navigation.navigate(cfg.route);
  }, [navigation, selected]);

  const footerPadBottom = useMemo(() => Math.max(insets.bottom, spacing.sm), [insets.bottom]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.flex}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressedOpacity]}
            accessibilityRole="button"
            accessibilityLabel={t('createTontine.typeBackA11y')}
          >
            <Ionicons name="arrow-back" size={24} color={INK} />
          </Pressable>
          <View style={styles.stepCenter}>
            <Text style={styles.stepPill}>{t('createTontine.typeStepIndicator')}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>{t('createTontine.typeSelectionTitle')}</Text>
          <Text style={styles.subtitle}>{t('createTontine.typeSelectionSubtitle')}</Text>

          <View style={styles.cards}>
            {KINDS.map((cfg) => {
              const isRotative = cfg.id === 'ROTATIVE';
              const isSelected = selected === cfg.id;
              const titleKey = isRotative ? 'createTontine.typeRotativeTitle' : 'createTontine.typeSavingsTitle';
              const badgeKey = isRotative ? 'createTontine.typeRotativeBadge' : 'createTontine.typeSavingsBadge';
              const descKey = isRotative ? 'createTontine.typeRotativeDesc' : 'createTontine.typeSavingsDesc';
              const chip1 = isRotative ? 'createTontine.typeRotativeChip1' : 'createTontine.typeSavingsChip1';
              const chip2 = isRotative ? 'createTontine.typeRotativeChip2' : 'createTontine.typeSavingsChip2';
              const chip3 = isRotative ? 'createTontine.typeRotativeChip3' : 'createTontine.typeSavingsChip3';
              const a11yHint = isRotative
                ? t('createTontine.typeSelectRotativeA11y')
                : t('createTontine.typeSelectSavingsA11y');

              return (
                <Pressable
                  key={cfg.id}
                  onPress={() => onSelectKind(cfg.id)}
                  style={({ pressed }) => [
                    styles.card,
                    {
                      borderColor: isSelected ? cfg.accent : '#E5E7EB',
                      borderWidth: isSelected ? 2 : 1,
                      backgroundColor: isSelected ? cfg.softBg : '#FFFFFF',
                    },
                    isSelected && styles.cardSelected,
                    pressed && styles.cardPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={a11yHint}
                  accessibilityState={{ selected: isSelected }}
                  android_ripple={{ color: `${cfg.accent}22` }}
                >
                  <View style={styles.cardTop}>
                    <View style={[styles.iconCircle, { backgroundColor: `${cfg.accent}18` }]}>
                      <Ionicons name={cfg.icon} size={26} color={cfg.accent} />
                    </View>
                    <View style={styles.cardTitleCol}>
                      <Text style={[styles.cardTitle, { color: INK }]}>{t(titleKey)}</Text>
                      <View style={[styles.badge, { borderColor: cfg.softBorder }]}>
                        <Text style={[styles.badgeText, { color: cfg.accent }]}>{t(badgeKey)}</Text>
                      </View>
                    </View>
                    <View style={styles.checkSlot}>
                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={28} color={cfg.accent} />
                      ) : (
                        <View style={styles.checkPlaceholder} />
                      )}
                    </View>
                  </View>
                  <Text style={styles.cardDesc}>{t(descKey)}</Text>
                  <View style={styles.chipsRow}>
                    {[chip1, chip2, chip3].map((key) => (
                      <View key={key} style={[styles.chip, { borderColor: cfg.softBorder }]}>
                        <Text style={[styles.chipText, { color: cfg.accent }]} numberOfLines={1}>
                          {t(key)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.helpBox}>
            <Ionicons name="information-circle-outline" size={18} color={MUTED} style={styles.helpIcon} />
            <View style={styles.helpTextCol}>
              <Text style={styles.helpLine}>{t('createTontine.typeHelpRotative')}</Text>
              <Text style={styles.helpLine}>{t('createTontine.typeHelpSavings')}</Text>
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: footerPadBottom }]}>
          <Pressable
            onPress={handleContinue}
            disabled={selected == null}
            style={({ pressed }) => [
              styles.cta,
              selected == null && styles.ctaDisabled,
              pressed && selected != null && styles.ctaPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('createTontine.typeContinueA11y')}
            accessibilityState={{ disabled: selected == null }}
          >
            <Text style={[styles.ctaText, selected == null && styles.ctaTextDisabled]}>
              {t('createTontine.typeContinue')}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={20}
              color={selected == null ? '#9CA3AF' : '#FFFFFF'}
            />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    width: spacing.minTouchTarget,
    height: spacing.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: spacing.minTouchTarget,
  },
  stepCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressedOpacity: {
    opacity: 0.7,
  },
  stepPill: {
    fontSize: 12,
    fontWeight: '700',
    color: GREEN,
    letterSpacing: 0.4,
  },
  scrollContent: {
    paddingHorizontal: spacing.md + 4,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.4,
    lineHeight: 30,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: MUTED,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  cards: {
    gap: spacing.md,
  },
  card: {
    borderRadius: 20,
    padding: spacing.md + 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 2,
  },
  cardSelected: {
    shadowOpacity: 0.12,
    elevation: 4,
  },
  cardPressed: {
    opacity: 0.96,
    transform: [{ scale: 0.992 }],
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm + 2,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  checkSlot: {
    width: 32,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  checkPlaceholder: {
    width: 28,
    height: 28,
  },
  cardDesc: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 21,
    marginBottom: spacing.md,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    maxWidth: '100%',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  helpBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.lg + 4,
    padding: spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: spacing.sm,
  },
  helpIcon: {
    marginTop: 2,
  },
  helpTextCol: {
    flex: 1,
    gap: 6,
  },
  helpLine: {
    fontSize: 13,
    color: MUTED,
    lineHeight: 19,
  },
  footer: {
    paddingHorizontal: spacing.md + 4,
    paddingTop: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  cta: {
    minHeight: spacing.minTouchTarget + 4,
    borderRadius: 16,
    backgroundColor: GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  ctaDisabled: {
    backgroundColor: '#E5E7EB',
  },
  ctaPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  ctaTextDisabled: {
    color: '#9CA3AF',
  },
});
