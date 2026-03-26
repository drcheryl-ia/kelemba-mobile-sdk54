/**
 * Écran Notifications — liste sectionnée, détail modal, swipes, mode édition.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SectionList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import type { Notification, FilterTab, SectionKey, NotificationType } from '@/types/notification.types';
import { useNotifications } from '@/hooks/useNotifications';
import { useNetwork } from '@/hooks/useNetwork';
import {
  NotificationFilterTabs,
  NotificationItem,
  NotificationDetailModal,
} from '@/components/notifications';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { NOTIFICATION_DELETE_API_AVAILABLE } from '@/utils/notificationsDeletePolicy';

const FILTER_TYPES: Record<Exclude<FilterTab, 'ALL' | 'UNREAD'>, NotificationType[]> = {
  PAYMENTS: [
    'PAYMENT_REMINDER',
    'PAYMENT_RECEIVED',
    'POT_AVAILABLE',
    'POT_DELAYED',
  ],
  TONTINES: ['TONTINE_INVITATION', 'ROTATION_CHANGED', 'PENALTY_APPLIED'],
  SYSTEM: ['KYC_UPDATE', 'SCORE_UPDATE', 'SYSTEM'],
};

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const OLDER_PREVIEW = 5;

function getSectionKey(createdAt: string): SectionKey {
  const ts = new Date(createdAt).getTime();
  const now = Date.now();
  if (ts >= now - DAY_MS) return 'today';
  if (ts >= now - WEEK_MS) return 'thisWeek';
  return 'older';
}

interface SectionData {
  title: SectionKey;
  data: Notification[];
  expandOlderHint?: number;
  showOlderCollapse?: boolean;
}

function groupByDate(notifications: Notification[]): SectionData[] {
  const valid = notifications.filter(
    (n) =>
      n != null &&
      typeof n.createdAt === 'string' &&
      !Number.isNaN(Date.parse(n.createdAt))
  );

  const groups = new Map<SectionKey, Notification[]>();
  for (const n of valid) {
    const key = getSectionKey(n.createdAt);
    const arr = groups.get(key) ?? [];
    arr.push(n);
    groups.set(key, arr);
  }
  const order: SectionKey[] = ['today', 'thisWeek', 'older'];
  return order
    .filter((k) => groups.has(k))
    .map((title) => ({ title, data: groups.get(title)! }));
}

function applyOlderPreview(sections: SectionData[], olderExpanded: boolean): SectionData[] {
  return sections.map((section) => {
    if (section.title !== 'older') return section;
    if (olderExpanded) {
      return {
        ...section,
        showOlderCollapse: section.data.length > OLDER_PREVIEW,
      };
    }
    if (section.data.length <= OLDER_PREVIEW) return section;
    const hidden = section.data.length - OLDER_PREVIEW;
    return {
      title: section.title,
      data: section.data.slice(0, OLDER_PREVIEW),
      expandOlderHint: hidden,
    };
  });
}

type Props = NativeStackScreenProps<RootStackParamList, 'NotificationsScreen'>;

export const NotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const exitOrHome = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('MainTabs', { screen: 'Dashboard', params: undefined });
    }
  }, [navigation]);
  const { t, i18n } = useTranslation();
  const { isConnected } = useNetwork();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [olderExpanded, setOlderExpanded] = useState(false);
  const [detailItem, setDetailItem] = useState<Notification | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedUids, setSelectedUids] = useState<Set<string>>(() => new Set());
  /** Masquage local session — en attendant DELETE serveur (voir notificationsDeletePolicy). */
  const [locallyHiddenUids, setLocallyHiddenUids] = useState<Set<string>>(() => new Set());

  const {
    allNotifications,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isError,
    refetch,
    isFetchingNextPage,
    markAsReadMutation,
    markManyAsReadMutation,
  } = useNotifications();

  const visibleNotifications = useMemo(
    () => allNotifications.filter((n) => !locallyHiddenUids.has(n.uid)),
    [allNotifications, locallyHiddenUids]
  );

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'UNREAD') {
      return visibleNotifications.filter((n) => n.readAt == null);
    }
    if (activeTab === 'ALL') return visibleNotifications;
    const types = FILTER_TYPES[activeTab];
    return visibleNotifications.filter((n) => types.includes(n.type));
  }, [visibleNotifications, activeTab]);

  const grouped = useMemo(
    () => groupByDate(filteredNotifications),
    [filteredNotifications]
  );

  const sections = useMemo(
    () => applyOlderPreview(grouped, olderExpanded),
    [grouped, olderExpanded]
  );

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedUids(new Set());
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    const unread = visibleNotifications.filter((n) => !n.readAt);
    if (unread.length === 0) return;
    markManyAsReadMutation.mutate(unread.map((n) => n.uid));
  }, [markManyAsReadMutation, visibleNotifications]);

  const openDetail = useCallback(
    (item: Notification) => {
      if (!item.readAt) {
        markAsReadMutation.mutate(item.uid);
      }
      setDetailItem(item);
    },
    [markAsReadMutation]
  );

  const confirmLocalHide = useCallback(
    (items: Notification[]) => {
      const run = () => {
        setLocallyHiddenUids((prev) => {
          const next = new Set(prev);
          for (const it of items) next.add(it.uid);
          return next;
        });
        exitSelectionMode();
      };

      if (NOTIFICATION_DELETE_API_AVAILABLE) {
        /**
         * Brancher ici l’appel officiel (DELETE) + invalidateQueries(['notifications']).
         */
        return;
      }

      Alert.alert(t('notifications.deleteLocalTitle'), t('notifications.deleteLocalMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('notifications.deleteLocalConfirm'), onPress: run },
      ]);
    },
    [exitSelectionMode, t]
  );

  const handleRequestLocalHide = useCallback(
    (item: Notification) => {
      confirmLocalHide([item]);
    },
    [confirmLocalHide]
  );

  const toggleSelect = useCallback((uid: string) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }, []);

  const selectAllVisibleUnread = useCallback(() => {
    const unread = filteredNotifications.filter((n) => n.readAt == null);
    setSelectedUids(new Set(unread.map((n) => n.uid)));
  }, [filteredNotifications]);

  const handleMarkSelectedRead = useCallback(() => {
    const uids = Array.from(selectedUids);
    if (uids.length === 0) return;
    markManyAsReadMutation.mutate(uids);
    exitSelectionMode();
  }, [exitSelectionMode, markManyAsReadMutation, selectedUids]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedUids.size === 0) return;
    const items = filteredNotifications.filter((n) => selectedUids.has(n.uid));
    confirmLocalHide(items);
  }, [confirmLocalHide, filteredNotifications, selectedUids]);

  const enterEditFromLongPress = useCallback((uid: string) => {
    setSelectionMode(true);
    setSelectedUids(new Set([uid]));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderItem = useCallback(
    ({ item }: { item: Notification }) => (
      <NotificationItem
        item={item}
        onOpen={openDetail}
        onMarkAsRead={(uid) => markAsReadMutation.mutate(uid)}
        onRequestLocalHide={handleRequestLocalHide}
        selectionMode={selectionMode}
        selected={selectedUids.has(item.uid)}
        onToggleSelect={toggleSelect}
        onLongPressToEdit={enterEditFromLongPress}
        swipeEnabled={!selectionMode}
      />
    ),
    [
      enterEditFromLongPress,
      handleRequestLocalHide,
      markAsReadMutation,
      openDetail,
      selectionMode,
      selectedUids,
      toggleSelect,
    ]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionData }) => (
      <Text style={styles.sectionHeader}>{t(`notifications.sections.${section.title}`)}</Text>
    ),
    [t]
  );

  const renderSectionFooter = useCallback(
    ({ section }: { section: SectionData }) => {
      if (section.expandOlderHint != null && section.expandOlderHint > 0) {
        return (
          <Pressable
            style={styles.sectionFooterBtn}
            onPress={() => setOlderExpanded(true)}
            accessibilityRole="button"
          >
            <Text style={styles.sectionFooterBtnText}>
              {t('notifications.expandOlder', { count: section.expandOlderHint })}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.primary} />
          </Pressable>
        );
      }
      if (section.showOlderCollapse) {
        return (
          <Pressable
            style={styles.sectionFooterBtn}
            onPress={() => setOlderExpanded(false)}
            accessibilityRole="button"
          >
            <Text style={styles.sectionFooterBtnText}>{t('notifications.collapseOlder')}</Text>
            <Ionicons name="chevron-up" size={18} color={colors.primary} />
          </Pressable>
        );
      }
      return null;
    },
    [t]
  );

  const keyExtractor = useCallback(
    (item: Notification, index: number) => item?.uid ?? `fallback-${index}`,
    []
  );

  const titleText =
    i18n.language === 'sango' ? t('notifications.titleSango') : t('notifications.title');

  const bottomReserve = 88 + Math.max(insets.bottom, spacing.sm);
  const listBottomPad = bottomReserve + (selectionMode ? 56 : 0);

  if (isLoading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{titleText}</Text>
        </View>
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={64} color={colors.grayTagline} />
          <Text style={styles.errorText}>{t('common.error')}</Text>
          <Pressable style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryText}>{t('notifications.retry')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            onPress={exitOrHome}
            style={styles.iconBtn}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('notifications.backHome')}
          >
            <Ionicons name="home-outline" size={24} color={colors.gray[800]} />
          </Pressable>
          <Text style={styles.headerTitle}>{titleText}</Text>
        </View>
        <View style={styles.headerActions}>
          {!selectionMode ? (
            <>
              <Pressable
                onPress={handleMarkAllRead}
                style={styles.headerLink}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('notifications.markAllRead')}
              >
                <Text style={styles.headerLinkText}>{t('notifications.markAllRead')}</Text>
              </Pressable>
              <Pressable
                onPress={() => setSelectionMode(true)}
                style={styles.headerLink}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('notifications.edit')}
              >
                <Text style={styles.headerLinkText}>{t('notifications.edit')}</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={exitSelectionMode}
              style={styles.headerLink}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('notifications.done')}
            >
              <Text style={styles.headerLinkText}>{t('notifications.done')}</Text>
            </Pressable>
          )}
        </View>
      </View>

      <NotificationFilterTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {isConnected === false && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>{t('notifications.offline')}</Text>
        </View>
      )}

      {sections.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="notifications-outline" size={64} color={colors.grayTagline} />
          <Text style={styles.emptyText}>
            {i18n.language === 'sango'
              ? t('notifications.emptySango')
              : t('notifications.empty')}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          renderSectionFooter={renderSectionFooter}
          keyExtractor={keyExtractor}
          contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPad }]}
          stickySectionHeadersEnabled={false}
          removeClippedSubviews
          maxToRenderPerBatch={12}
          windowSize={7}
          initialNumToRender={12}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.35}
          ListFooterComponent={
            hasNextPage && isFetchingNextPage ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
        />
      )}

      {selectionMode ? (
        <View style={[styles.editBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <Pressable style={styles.editBarBtn} onPress={selectAllVisibleUnread}>
            <Text style={styles.editBarBtnText}>{t('notifications.selectAllUnread')}</Text>
          </Pressable>
          <Pressable style={styles.editBarBtnPrimary} onPress={handleMarkSelectedRead}>
            <Text style={styles.editBarBtnPrimaryText}>{t('notifications.markSelectedRead')}</Text>
          </Pressable>
          <Pressable style={styles.editBarBtnDanger} onPress={handleDeleteSelected}>
            <Text style={styles.editBarBtnDangerText}>{t('notifications.deleteSelected')}</Text>
          </Pressable>
        </View>
      ) : null}

      <NotificationDetailModal
        visible={detailItem != null}
        item={detailItem}
        onClose={() => setDetailItem(null)}
        navigation={navigation}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.inputBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
    gap: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  iconBtn: {
    width: spacing.minTouchTarget,
    height: spacing.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.gray[900],
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexShrink: 0,
  },
  headerLink: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  headerLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.grayTagline,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  sectionFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  sectionFooterBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 16,
    color: colors.grayTagline,
    marginTop: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  retryText: {
    color: colors.white,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 16,
    color: colors.grayTagline,
    marginTop: 16,
    textAlign: 'center',
  },
  offlineBanner: {
    backgroundColor: '#FFF9C4',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  offlineText: {
    fontSize: 14,
    color: colors.gray[900],
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  listContent: {
    paddingTop: spacing.sm,
  },
  editBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  editBarBtn: {
    flex: 1,
    minWidth: '28%',
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  editBarBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gray[800],
    textAlign: 'center',
  },
  editBarBtnPrimary: {
    flex: 1,
    minWidth: '28%',
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  editBarBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.white,
    textAlign: 'center',
  },
  editBarBtnDanger: {
    flex: 1,
    minWidth: '28%',
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  editBarBtnDangerText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.danger,
    textAlign: 'center',
  },
});
