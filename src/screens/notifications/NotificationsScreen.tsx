/**
 * Écran Notifications — liste groupée, filtres, pagination, actions.
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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { RootStackParamList } from '@/navigation/types';
import type { Notification } from '@/types/notification.types';
import { useNotifications } from '@/hooks/useNotifications';
import { useNextPayment } from '@/hooks/useNextPayment';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { PaymentModal } from '@/components/dashboard/modals/PaymentModal';
import { SkeletonPulse } from '@/components/common/SkeletonPulse';
import { COLORS } from '@/theme/colors';
import { rejectInvitation } from '@/api/tontinesApi';
import { navigateFromNotification } from '@/utils/notificationNavigationFromItem';
import {
  groupNotificationsByDate,
  type NotificationListFilter,
} from '@/utils/notificationGrouping';
import { extractScoreDelta, extractTontineUid } from '@/utils/notificationPayload';

type Props = NativeStackScreenProps<RootStackParamList, 'NotificationsScreen'>;

const HEADER_GREEN = '#1A6B3C';

function FilterIcon(): React.ReactElement {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function actionHintForType(type: string): string {
  const t = String(type);
  if (t === 'SYSTEM') return 'Voir les détails si disponible';
  return 'Ouvrir le détail associé';
}

type PropsStrip = {
  n: Notification;
  navigation: Props['navigation'];
  onOpenPaymentModal: (n: Notification) => void;
  onRejectInvite: (tontineUid: string) => void;
};

function buildActionStrip(p: PropsStrip): React.ReactNode {
  const { n, navigation, onOpenPaymentModal, onRejectInvite } = p;
  const t = String(n.type);
  const tontineUid = extractTontineUid(n);

  if (t === 'PAYMENT_REMINDER') {
    return (
      <View style={stripStyles.strip}>
        <Pressable
          style={stripStyles.btnDanger}
          onPress={() => onOpenPaymentModal(n)}
          accessibilityRole="button"
          accessibilityLabel="Payer maintenant"
        >
          <Text style={stripStyles.btnDangerTxt}>Payer maintenant</Text>
        </Pressable>
        <Pressable
          style={stripStyles.btnMuted}
          onPress={() => {
            if (tontineUid) {
              navigation.navigate('TontineDetails', {
                tontineUid,
                tab: 'dashboard',
              });
            }
          }}
          accessibilityRole="button"
          accessibilityLabel="Voir la tontine"
        >
          <Text style={stripStyles.btnMutedTxt}>Voir la tontine</Text>
        </Pressable>
      </View>
    );
  }

  if (t === 'POT_AVAILABLE') {
    return (
      <View style={stripStyles.strip}>
        <Pressable
          style={stripStyles.btnAccent}
          onPress={() => {
            if (tontineUid) {
              navigation.navigate('TontineDetails', {
                tontineUid,
                isCreator: true,
                tab: 'dashboard',
              });
            }
          }}
          accessibilityRole="button"
          accessibilityLabel="Verser la cagnotte"
        >
          <Text style={stripStyles.btnAccentTxt}>Verser la cagnotte</Text>
        </Pressable>
        <Pressable
          style={stripStyles.btnMuted}
          onPress={() => {
            if (tontineUid) {
              navigation.navigate('TontineDetails', {
                tontineUid,
                tab: 'dashboard',
              });
            }
          }}
          accessibilityRole="button"
          accessibilityLabel="Voir les détails"
        >
          <Text style={stripStyles.btnMutedTxt}>Voir les détails</Text>
        </Pressable>
      </View>
    );
  }

  if (t === 'TONTINE_INVITATION' && tontineUid) {
    const name = n.title;
    return (
      <View style={stripStyles.strip}>
        <Pressable
          style={stripStyles.btnAccent}
          onPress={() =>
            navigation.navigate('TontineContractSignature', {
              mode: 'INVITE_ACCEPT',
              tontineUid,
              tontineName: name,
            })
          }
          accessibilityRole="button"
          accessibilityLabel="Accepter l'invitation"
        >
          <Text style={stripStyles.btnAccentTxt}>Accepter</Text>
        </Pressable>
        <Pressable
          style={stripStyles.btnMuted}
          onPress={() =>
            navigation.navigate('TontineContractSignature', {
              mode: 'INVITE_ACCEPT',
              tontineUid,
              tontineName: name,
            })
          }
          accessibilityRole="button"
          accessibilityLabel="Voir le contrat"
        >
          <Text style={stripStyles.btnMutedTxt}>Voir contrat</Text>
        </Pressable>
        <Pressable
          style={stripStyles.btnDanger}
          onPress={() => {
            Alert.alert(
              'Refuser l’invitation',
              'Confirmer le refus ?',
              [
                { text: 'Annuler', style: 'cancel' },
                {
                  text: 'Refuser',
                  style: 'destructive',
                  onPress: () => onRejectInvite(tontineUid),
                },
              ]
            );
          }}
          accessibilityRole="button"
          accessibilityLabel="Refuser l'invitation"
        >
          <Text style={stripStyles.btnDangerTxt}>Refuser</Text>
        </Pressable>
      </View>
    );
  }

  if (t === 'CASH_PENDING') {
    return (
      <View style={stripStyles.strip}>
        <Pressable
          style={stripStyles.btnAccent}
          onPress={() =>
            navigation.navigate('MainTabs', {
              screen: 'Payments',
              params: { initialSegment: 'cashValidations' },
            })
          }
          accessibilityRole="button"
          accessibilityLabel="Valider les paiements espèces"
        >
          <Text style={stripStyles.btnAccentTxt}>Valider</Text>
        </Pressable>
        <Pressable
          style={stripStyles.btnMuted}
          onPress={() =>
            navigation.navigate('MainTabs', {
              screen: 'Payments',
              params: { initialSegment: 'cashValidations' },
            })
          }
          accessibilityRole="button"
          accessibilityLabel="Voir la liste"
        >
          <Text style={stripStyles.btnMutedTxt}>Voir liste</Text>
        </Pressable>
      </View>
    );
  }

  return null;
}

const stripStyles = StyleSheet.create({
  strip: {
    borderTopWidth: 0.5,
    borderTopColor: COLORS.gray100,
    paddingVertical: 6,
    paddingHorizontal: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: COLORS.white,
  },
  btnDanger: {
    backgroundColor: COLORS.danger,
    borderRadius: 7,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  btnDangerTxt: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '500',
  },
  btnAccent: {
    backgroundColor: COLORS.accent,
    borderRadius: 7,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  btnAccentTxt: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '500',
  },
  btnMuted: {
    backgroundColor: COLORS.gray100,
    borderRadius: 7,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  btnMutedTxt: {
    color: COLORS.gray700,
    fontSize: 11,
    fontWeight: '500',
  },
});

export const NotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const queryClient = useQueryClient();
  const [listFilter, setListFilter] = useState<NotificationListFilter>('all');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentFor, setPaymentFor] = useState<Notification | null>(null);

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
    archiveMutation,
    archiveManyMutation,
    unreadData,
  } = useNotifications();

  const { nextPayment } = useNextPayment();

  const unreadCount = unreadData?.count ?? 0;

  const totalLoaded = useMemo(
    () =>
      allNotifications.filter(
        (n) => n != null && typeof n.createdAt === 'string'
      ).length,
    [allNotifications]
  );

  const sections = useMemo(
    () => groupNotificationsByDate(allNotifications, listFilter),
    [allNotifications, listFilter]
  );

  const rejectInviteMut = useMutation({
    mutationFn: (tontineUid: string) => rejectInvitation(tontineUid),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['tontines'] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const openPaymentModal = useCallback(
    (n: Notification) => {
      const uid = extractTontineUid(n);
      if (
        uid &&
        nextPayment &&
        nextPayment.tontineUid === uid
      ) {
        setPaymentFor(n);
        setPaymentModalOpen(true);
        return;
      }
      if (uid) {
        navigation.navigate('TontineDetails', { tontineUid: uid, tab: 'dashboard' });
      }
    },
    [navigation, nextPayment]
  );

  const onNotificationPress = useCallback(
    (n: Notification) => {
      if (n.readAt == null) {
        markAsReadMutation.mutate(n.uid);
      }
      navigateFromNotification(n, navigation);
    },
    [markAsReadMutation, navigation]
  );

  const markAllRead = useCallback(() => {
    const uids = allNotifications
      .filter((n) => n.readAt == null)
      .map((n) => n.uid);
    if (uids.length === 0) return;
    markManyAsReadMutation.mutate(uids);
  }, [allNotifications, markManyAsReadMutation]);

  const archiveAll = useCallback(() => {
    const uids = allNotifications.map((n) => n.uid);
    if (uids.length === 0) return;
    archiveManyMutation.mutate(uids);
  }, [allNotifications, archiveManyMutation]);

  const renderItem = useCallback(
    ({
      item,
      section,
      index,
    }: {
      item: Notification;
      section: { data: Notification[] };
      index: number;
    }) => {
      const isFirst = index === 0;
      const isLast = index === section.data.length - 1;
      const strip = buildActionStrip({
        n: item,
        navigation,
        onOpenPaymentModal: openPaymentModal,
        onRejectInvite: (uid) => rejectInviteMut.mutate(uid),
      });
      return (
        <NotificationItem
          notification={item}
          onPress={() => onNotificationPress(item)}
          onMarkRead={(uid) => markAsReadMutation.mutate(uid)}
          onArchive={(uid) => archiveMutation.mutate(uid)}
          isFirst={isFirst}
          isLast={isLast}
          actionStrip={strip}
          accessibilityActionHint={actionHintForType(String(item.type))}
          scoreDelta={extractScoreDelta(item)}
        />
      );
    },
    [
      archiveMutation,
      markAsReadMutation,
      navigation,
      onNotificationPress,
      openPaymentModal,
      rejectInviteMut,
    ]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string } }) => (
      <View style={styles.sectionHead}>
        <Text style={styles.sectionHeadTxt}>{section.title}</Text>
      </View>
    ),
    []
  );

  const listHeader = useMemo(() => {
    if (totalLoaded === 0) return null;
    return (
      <View style={styles.actionsBar}>
        <Pressable
          onPress={markAllRead}
          disabled={unreadCount === 0}
          style={[styles.markAll, unreadCount === 0 && styles.markAllDis]}
          accessibilityRole="button"
          accessibilityState={{ disabled: unreadCount === 0 }}
        >
          <Text style={styles.markAllTxt}>Tout marquer lu</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            Alert.alert(
              'Archiver toutes les notifications ?',
              'Elles seront masquées mais conservées dans votre historique.',
              [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Archiver', onPress: archiveAll },
              ]
            )
          }
          accessibilityRole="button"
        >
          <Text style={styles.archiveAllTxt}>Archiver tout</Text>
        </Pressable>
      </View>
    );
  }, [archiveAll, markAllRead, totalLoaded, unreadCount]);

  const emptyMessage = useMemo(() => {
    if (listFilter === 'unread') {
      return 'Tout est lu · Aucune notification non lue';
    }
    if (listFilter === 'payments') {
      return 'Aucune notification de paiement';
    }
    return 'Aucune notification pour le moment';
  }, [listFilter]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyWrap}>
        {listFilter === 'unread' ? (
          <Ionicons name="checkmark-circle" size={48} color={COLORS.primary} />
        ) : (
          <Ionicons name="notifications-off-outline" size={48} color={COLORS.gray500} />
        )}
        <Text style={styles.emptyTxt}>{emptyMessage}</Text>
      </View>
    );
  }, [emptyMessage, isLoading, listFilter]);

  const paymentModalProps = useMemo(() => {
    if (!paymentFor || !nextPayment) return null;
    const uid = extractTontineUid(paymentFor);
    if (!uid || nextPayment.tontineUid !== uid) return null;
    const total =
      Math.round(nextPayment.totalDue ?? nextPayment.totalAmountDue ?? 0);
    const pen = Math.round(nextPayment.penaltyAmount ?? 0);
    const base = Math.max(0, total - pen);
    const urgency =
      nextPayment.obligationStatus === 'OVERDUE' ||
      nextPayment.obligationStatus === 'PENALIZED' ||
      nextPayment.isOverdue
        ? ('OVERDUE' as const)
        : ('DUE' as const);
    return {
      tontineName: nextPayment.tontineName,
      cycleLabel: `Cycle ${nextPayment.cycleNumber}`,
      totalAmountDue: total,
      penaltyAmount: pen,
      cycleUid: nextPayment.cycleUid,
      tontineUid: nextPayment.tontineUid,
      cycleNumber: nextPayment.cycleNumber,
      paymentBaseAmount: base,
      urgency,
    };
  }, [nextPayment, paymentFor]);

  if (isError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.errBox}>
          <Ionicons name="cloud-offline-outline" size={32} color={COLORS.gray500} />
          <Text style={styles.errTxt}>Impossible de charger les notifications</Text>
          <Pressable style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryTxt}>Réessayer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading && totalLoaded === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerBlock}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Notifications</Text>
          </View>
        </View>
        <View style={styles.skelPad}>
          <Text style={styles.skelSection}>AUJOURD&apos;HUI</Text>
          <SkeletonPulse width="100%" height={48} borderRadius={10} />
          <SkeletonPulse width="100%" height={48} borderRadius={10} />
          <Text style={[styles.skelSection, { marginTop: 16 }]}>HIER</Text>
          <SkeletonPulse width="100%" height={48} borderRadius={10} />
          <SkeletonPulse width="100%" height={48} borderRadius={10} />
          <SkeletonPulse width="100%" height={48} borderRadius={10} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerBlock}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Pressable
            style={styles.filterBtn}
            onPress={() => setFilterModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Filtres"
          >
            <FilterIcon />
            {listFilter !== 'all' ? <View style={styles.filterDot} /> : null}
          </Pressable>
        </View>
        <View style={styles.subRow}>
          <View style={styles.unreadRow}>
            <Text style={styles.unreadLbl}>{unreadCount} non lues</Text>
            {unreadCount > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeTxt}>{unreadCount}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.chipRow}>
            {(
              [
                ['all', 'Toutes'],
                ['unread', 'Non lues'],
                ['payments', 'Paiements'],
              ] as const
            ).map(([k, label]) => (
              <Pressable
                key={k}
                style={[
                  styles.chip,
                  listFilter === k && styles.chipOn,
                ]}
                onPress={() => setListFilter(k)}
              >
                <Text
                  style={[
                    styles.chipTxt,
                    listFilter === k && styles.chipTxtOn,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <SectionList
        style={styles.list}
        sections={sections}
        renderItem={(info) =>
          renderItem({
            item: info.item,
            index: info.index,
            section: info.section as { data: Notification[] },
          })
        }
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(it) => it.uid}
        ItemSeparatorComponent={null}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.3}
        stickySectionHeadersEnabled={false}
        initialNumToRender={15}
        maxToRenderPerBatch={8}
        windowSize={5}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footer}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : !hasNextPage && totalLoaded > 20 ? (
            <Text style={styles.footerEnd}>Toutes les notifications chargées</Text>
          ) : null
        }
        contentContainerStyle={
          sections.length === 0 ? styles.listEmptyGrow : styles.listContent
        }
      />

      <Modal
        visible={filterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setFilterModalVisible(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Filtrer</Text>
            {(
              [
                ['all', 'Toutes les notifications'],
                ['unread', 'Non lues uniquement'],
                ['payments', 'Paiements'],
              ] as const
            ).map(([k, label]) => (
              <Pressable
                key={k}
                style={styles.modalOpt}
                onPress={() => {
                  setListFilter(k);
                  setFilterModalVisible(false);
                }}
              >
                <Text style={styles.modalOptTxt}>{label}</Text>
                {listFilter === k ? (
                  <Ionicons name="checkmark" size={20} color={COLORS.primary} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {paymentModalProps ? (
        <PaymentModal
          visible={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false);
            setPaymentFor(null);
          }}
          tontineName={paymentModalProps.tontineName}
          cycleLabel={paymentModalProps.cycleLabel}
          totalAmountDue={paymentModalProps.totalAmountDue}
          penaltyAmount={paymentModalProps.penaltyAmount}
          cycleUid={paymentModalProps.cycleUid}
          tontineUid={paymentModalProps.tontineUid}
          cycleNumber={paymentModalProps.cycleNumber}
          paymentBaseAmount={paymentModalProps.paymentBaseAmount}
          urgency={paymentModalProps.urgency}
          onPaymentSuccess={() => {
            setPaymentModalOpen(false);
            setPaymentFor(null);
            void queryClient.invalidateQueries({ queryKey: ['notifications'] });
            void queryClient.invalidateQueries({ queryKey: ['nextPayment'] });
          }}
        />
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: HEADER_GREEN },
  headerBlock: {
    backgroundColor: HEADER_GREEN,
    paddingTop: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '500',
    color: COLORS.white,
  },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  subRow: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  unreadRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unreadLbl: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
  },
  unreadBadge: {
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  unreadBadgeTxt: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.white,
  },
  chipRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 10,
    padding: 2,
    gap: 1,
  },
  chip: {
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  chipOn: { backgroundColor: COLORS.white },
  chipTxt: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  chipTxtOn: { color: COLORS.primary },
  list: { flex: 1, backgroundColor: COLORS.gray100 },
  listContent: { paddingBottom: 32 },
  listEmptyGrow: { flexGrow: 1 },
  sectionHead: { paddingVertical: 10, paddingHorizontal: 16, paddingBottom: 5 },
  sectionHeadTxt: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: COLORS.gray100,
  },
  markAll: {},
  markAllDis: { opacity: 0.4 },
  markAllTxt: { fontSize: 12, fontWeight: '500', color: COLORS.primary },
  archiveAllTxt: { fontSize: 12, color: COLORS.gray500 },
  emptyWrap: {
    paddingTop: 48,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTxt: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.gray500,
    textAlign: 'center',
  },
  footer: { paddingVertical: 16, alignItems: 'center' },
  footerEnd: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.gray500,
    paddingVertical: 12,
  },
  errBox: {
    flex: 1,
    padding: 40,
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.gray100,
  },
  errTxt: { fontSize: 14, color: COLORS.gray500, textAlign: 'center' },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
  },
  retryTxt: { color: COLORS.white, fontWeight: '600' },
  skelPad: { padding: 16, backgroundColor: COLORS.gray100, flex: 1 },
  skelSection: {
    fontSize: 11,
    color: COLORS.gray500,
    marginBottom: 8,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: COLORS.textPrimary,
  },
  modalOpt: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.gray200,
  },
  modalOptTxt: { fontSize: 15, color: COLORS.textPrimary },
});
