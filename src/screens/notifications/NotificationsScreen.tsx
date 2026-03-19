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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '@/navigation/types';
import type {
  Notification,
  FilterTab,
  SectionKey,
  NotificationType,
} from '@/types/notification.types';
import { useQueryClient } from '@tanstack/react-query';
import { useNotifications } from '@/hooks/useNotifications';
import { apiClient } from '@/api/apiClient';
import { ENDPOINTS } from '@/api/endpoints';
import { useNetwork } from '@/hooks/useNetwork';
import {
  NotificationFilterTabs,
  NotificationItem,
} from '@/components/notifications';

const FILTER_MAP: Record<FilterTab, NotificationType[]> = {
  ALL: [],
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

type Props = BottomTabScreenProps<MainTabParamList, 'History'>;

export const NotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { isConnected } = useNetwork();
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const {
    allNotifications,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isError,
    refetch,
    isFetchingNextPage,
    markAsReadMutation,
  } = useNotifications();

  const filteredNotifications = useMemo(() => {
    const types = FILTER_MAP[activeTab];
    if (types.length === 0) return allNotifications;
    return allNotifications.filter((n) => types.includes(n.type));
  }, [allNotifications, activeTab]);

  const sections = useMemo(
    () => groupByDate(filteredNotifications),
    [filteredNotifications]
  );

  const handleMarkAllRead = useCallback(async () => {
    const unread = allNotifications.filter((n) => !n.readAt);
    await Promise.allSettled(
      unread.map((n) =>
        apiClient.patch(ENDPOINTS.NOTIFICATIONS.MARK_READ(n.uid).url)
      )
    );
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    refetch();
  }, [allNotifications, refetch, queryClient]);

  const handlePress = useCallback(
    (item: Notification) => {
      if (!item.readAt) {
        markAsReadMutation.mutate(item.uid);
      }
      switch (item.type) {
        case 'TONTINE_INVITATION':
          navigation.navigate('Tontines', { initialTab: 'invitations' });
          break;
        case 'PAYMENT_REMINDER':
        case 'PAYMENT_RECEIVED':
        case 'POT_AVAILABLE':
          navigation.navigate('Tontines');
          break;
        case 'KYC_UPDATE':
          navigation.navigate('Profile', { screen: 'KycUpload' });
          break;
        case 'SCORE_UPDATE':
          navigation.navigate('Profile', { screen: 'ScoreHistory' });
          break;
        case 'POT_DELAYED':
        case 'ROTATION_CHANGED':
        case 'PENALTY_APPLIED':
          navigation.navigate('Tontines');
          break;
        case 'SYSTEM':
        default:
          Alert.alert(item.title, item.message);
          break;
      }
    },
    [navigation, markAsReadMutation]
  );

  const handleMarkAsRead = useCallback(
    (uid: string) => {
      markAsReadMutation.mutate(uid);
    },
    [markAsReadMutation]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderItem = useCallback(
    ({ item }: { item: Notification }) => (
      <NotificationItem
        item={item}
        onPress={handlePress}
        onMarkAsRead={handleMarkAsRead}
      />
    ),
    [handlePress, handleMarkAsRead]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionData }) => (
      <Text style={styles.sectionHeader}>
        {t(`notifications.sections.${section.title}`)}
      </Text>
    ),
    [t]
  );

  const keyExtractor = useCallback(
    (item: Notification, index: number) => item?.uid ?? `fallback-${index}`,
    []
  );

  const titleText =
    i18n.language === 'sango' ? t('notifications.titleSango') : t('notifications.title');

  if (isLoading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1A6B3C" />
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
          <Ionicons name="cloud-offline-outline" size={64} color="#6B7280" />
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
        <Text style={styles.headerTitle}>← {titleText}</Text>
        <Pressable
          onPress={handleMarkAllRead}
          style={styles.markAllRead}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('notifications.markAllRead')}
        >
          <Text style={styles.markAllReadText}>{t('notifications.markAllRead')}</Text>
        </Pressable>
      </View>

      <NotificationFilterTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {isConnected === false && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>{t('notifications.offline')}</Text>
        </View>
      )}

      {sections.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="notifications-outline" size={64} color="#6B7280" />
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
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#1A6B3C"
            />
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            hasNextPage && isFetchingNextPage ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#1A6B3C" />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  markAllRead: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  markAllReadText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A6B3C',
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#1A6B3C',
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
  },
  offlineBanner: {
    backgroundColor: '#FFF9C4',
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  offlineText: {
    fontSize: 14,
    color: '#1A1A2E',
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 100, // 64 tab height + 20 margin + 16 safe area
  },
});
