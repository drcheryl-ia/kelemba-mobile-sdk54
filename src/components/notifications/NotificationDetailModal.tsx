/**
 * Détail notification — modal type bottom sheet (pas de lib supplémentaire).
 */
import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import type { Notification } from '@/types/notification.types';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { NotificationIcon } from './NotificationIcon';
import {
  executeNotificationDetailAction,
  getNotificationDetailActions,
} from '@/utils/notificationNavigation';

const GREEN = colors.primary;

function formatDetailDate(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale === 'sango' ? 'fr-FR' : 'fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface NotificationDetailModalProps {
  visible: boolean;
  item: Notification | null;
  onClose: () => void;
  navigation: NativeStackNavigationProp<RootStackParamList, 'NotificationsScreen'>;
}

export const NotificationDetailModal: React.FC<NotificationDetailModalProps> = ({
  visible,
  item,
  onClose,
  navigation,
}) => {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();

  const actions = useMemo(
    () => (item ? getNotificationDetailActions(item.type) : []),
    [item]
  );

  if (!item) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.backdrop} />
      </Modal>
    );
  }

  const readLabel = item.readAt
    ? t('notifications.detail.statusRead')
    : t('notifications.detail.statusUnread');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.grabberWrap}>
            <View style={styles.grabber} />
          </View>
          <View style={styles.headerRow}>
            <Text style={styles.sheetTitle}>{t('notifications.detail.title')}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.back')}>
              <Ionicons name="close" size={26} color={colors.grayTagline} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.scroll}
          >
            <View style={styles.heroRow}>
              <NotificationIcon type={item.type} />
              <View style={styles.heroText}>
                <Text style={styles.typeBadge}>{t(`notifications.types.${item.type}`)}</Text>
                <Text style={styles.itemTitle}>{item.title}</Text>
              </View>
            </View>

            <Text style={styles.metaLabel}>{t('notifications.detail.message')}</Text>
            <Text style={styles.messageFull}>{item.message}</Text>

            <Text style={styles.metaLabel}>{t('notifications.detail.date')}</Text>
            <Text style={styles.metaValue}>
              {formatDetailDate(item.createdAt, i18n.language)}
            </Text>

            <Text style={styles.metaLabel}>{t('notifications.detail.status')}</Text>
            <Text style={styles.metaValue}>{readLabel}</Text>
          </ScrollView>

          {actions.length > 0 ? (
            <View style={styles.ctaCol}>
              {actions.map((a) => (
                <Pressable
                  key={a.key + a.labelKey}
                  style={styles.ctaBtn}
                  onPress={() => {
                    executeNotificationDetailAction(navigation, a.key);
                    onClose();
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.ctaBtnText}>{t(a.labelKey)}</Text>
                  <Ionicons name="chevron-forward" size={20} color={GREEN} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    maxHeight: '88%',
  },
  grabberWrap: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray[300],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.gray[900],
  },
  scroll: {
    maxHeight: 360,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  typeBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.gray[900],
    lineHeight: 24,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.grayTagline,
    marginTop: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metaValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray[800],
    marginTop: 4,
  },
  messageFull: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.gray[800],
    marginTop: 4,
  },
  ctaCol: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: spacing.minTouchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: GREEN,
  },
});
