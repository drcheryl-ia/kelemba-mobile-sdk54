/**
 * Modal validations espèces — liste compacte + actions (même API que ValidationsTab).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Animated,
  Alert,
  FlatList,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { validateCashPayment } from '@/api/cashPaymentApi';
import { navigationRef } from '@/navigation/navigationRef';
import { useOrganizerCashPendingActions } from '@/hooks/useOrganizerCashPending';
import { useTontines } from '@/hooks/useTontines';
import {
  filterOrganizerCashPendingForTontineScope,
  getOrganizerTontineUids,
} from '@/hooks/useOrganizerCashPending';
import { organizerActionToCashValidationItem } from '@/screens/payments/cashValidationMapper';
import { COLORS } from '@/theme/colors';
import { formatFcfa } from '@/utils/formatters';
import { logger } from '@/utils/logger';
import { selectUserUid } from '@/store/authSlice';
import type { RootState } from '@/store/store';
import type { CashValidationItem } from '@/types/payments.types';

const PANEL_OFF = Math.round(Dimensions.get('window').height * 0.5);

export interface CashValidationModalProps {
  visible: boolean;
  onClose: () => void;
  onValidationComplete: () => void;
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return `${p[0][0] ?? ''}${p[p.length - 1][0] ?? ''}`.toUpperCase();
}

function daysAgoLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  return `il y a ${days} j`;
}

export const CashValidationModal: React.FC<CashValidationModalProps> = ({
  visible,
  onClose,
  onValidationComplete,
}) => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const userUid = useSelector((s: RootState) => selectUserUid(s));
  const { tontines } = useTontines({ includeInvitations: false });
  const organizerUids = useMemo(
    () => getOrganizerTontineUids(tontines),
    [tontines]
  );

  const { data: pendingRaw = [] } = useOrganizerCashPendingActions({
    active: visible,
  });

  const items = useMemo(() => {
    if (userUid == null) return [];
    const scoped = filterOrganizerCashPendingForTontineScope(
      pendingRaw,
      userUid,
      organizerUids
    );
    return scoped
      .map(organizerActionToCashValidationItem)
      .filter((i) => i.status === 'PENDING_REVIEW')
      .sort(
        (a, b) =>
          new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
      );
  }, [pendingRaw, userUid, organizerUids]);

  const overlayOpacity = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(PANEL_OFF)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 0.45,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: PANEL_OFF,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, overlayOpacity, slideAnim]);

  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'APPROVE' | 'REJECT' | null>(
    null
  );
  const [bulkBusy, setBulkBusy] = useState(false);

  const invalidateCash = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ['payments', 'cash', 'organizer', 'pending-actions'],
    });
    void queryClient.invalidateQueries({
      queryKey: ['payments', 'cash', 'organizer', 'pending-count'],
    });
    void queryClient.invalidateQueries({ queryKey: ['payments', 'history'] });
    void queryClient.invalidateQueries({ queryKey: ['nextPayment'] });
  }, [queryClient]);

  const validateMutation = useMutation({
    mutationFn: (vars: {
      paymentUid: string;
      action: 'APPROVE' | 'REJECT';
      rejectionReason?: string;
    }) =>
      validateCashPayment(
        vars.paymentUid,
        vars.action,
        vars.rejectionReason
      ),
    onMutate: (vars) => {
      setBusyUid(vars.paymentUid);
      setBusyAction(vars.action);
    },
    onSettled: () => {
      setBusyUid(null);
      setBusyAction(null);
    },
    onSuccess: () => {
      invalidateCash();
      onValidationComplete();
    },
    onError: (err: unknown) => {
      logger.error('CashValidationModal mutation error', err);
      Alert.alert('Erreur', "L'action n'a pas pu être enregistrée. Réessayez.");
    },
  });

  const handleApprove = useCallback(
    (paymentUid: string) => {
      validateMutation.mutate({ paymentUid, action: 'APPROVE' });
    },
    [validateMutation]
  );

  const handleReject = useCallback(
    (paymentUid: string) => {
      validateMutation.mutate({ paymentUid, action: 'REJECT' });
    },
    [validateMutation]
  );

  const visibleList = useMemo(() => items.slice(0, 3), [items]);
  const restCount = Math.max(0, items.length - 3);

  const navigateFullList = useCallback(() => {
    onClose();
    if (!navigationRef.isReady()) return;
    navigationRef.navigate('MainTabs', {
      screen: 'Payments',
      params: { initialSegment: 'cashValidations' },
    });
  }, [onClose]);

  const runBulkApprove = useCallback(async () => {
    if (items.length < 2) return;
    setBulkBusy(true);
    try {
      for (const it of items) {
        await validateCashPayment(it.paymentUid, 'APPROVE');
      }
      invalidateCash();
      onValidationComplete();
      onClose();
    } catch (err: unknown) {
      logger.error('CashValidationModal bulk approve', err);
      Alert.alert('Erreur', 'Certaines validations ont échoué.');
    } finally {
      setBulkBusy(false);
    }
  }, [items, invalidateCash, onClose, onValidationComplete]);

  const onBulkPress = useCallback(() => {
    Alert.alert(
      'Valider tous les paiements ?',
      `${items.length} paiement${items.length > 1 ? 's' : ''} espèces seront acceptés.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Valider', onPress: () => void runBulkApprove() },
      ]
    );
  }, [items.length, runBulkApprove]);

  const renderItem = useCallback(
    ({ item }: { item: CashValidationItem }) => {
      const busy =
        busyUid === item.paymentUid &&
        (busyAction === 'APPROVE' || busyAction === 'REJECT');
      const line = `${item.tontineName} · Cycle ${item.cycleNumber} · ${formatFcfa(
        item.totalAmount
      )} · ${daysAgoLabel(item.submittedAt)}`;
      return (
        <View style={styles.rowCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>{initials(item.memberName)}</Text>
          </View>
          <View style={styles.rowCenter}>
            <Text style={styles.memberName} numberOfLines={1}>
              {item.memberName}
            </Text>
            <Text style={styles.rowMeta} numberOfLines={2}>
              {line}
            </Text>
          </View>
          <View style={styles.rowRight}>
            <Text style={styles.amt}>{formatFcfa(item.totalAmount)}</Text>
            <View style={styles.rowBtns}>
              <Pressable
                onPress={() => handleApprove(item.paymentUid)}
                disabled={busy || bulkBusy}
                style={[styles.miniBtn, styles.miniOk]}
                accessibilityRole="button"
                accessibilityLabel="Valider"
              >
                {busy && busyAction === 'APPROVE' ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.miniOkTxt}>Valider</Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => handleReject(item.paymentUid)}
                disabled={busy || bulkBusy}
                style={[styles.miniBtn, styles.miniKo]}
                accessibilityRole="button"
                accessibilityLabel="Refuser"
              >
                {busy && busyAction === 'REJECT' ? (
                  <ActivityIndicator size="small" color={COLORS.dangerText} />
                ) : (
                  <Text style={styles.miniKoTxt}>Refuser</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      );
    },
    [bulkBusy, busyAction, busyUid, handleApprove, handleReject]
  );

  const n = items.length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <View style={styles.root}>
        <Animated.View
          pointerEvents="none"
          style={[styles.overlay, { opacity: overlayOpacity }]}
        />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
        />
        <Animated.View
          style={[
            styles.panel,
            {
              transform: [{ translateY: slideAnim }],
              paddingBottom: Math.max(insets.bottom, 16),
              maxHeight: '90%',
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Validations espèces</Text>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
            >
              <Text style={styles.closeTxt}>×</Text>
            </Pressable>
          </View>
          <Text style={styles.subtitle}>
            {n} paiement{n > 1 ? 's' : ''} en attente de décision
          </Text>
          <FlatList
            data={visibleList}
            keyExtractor={(i) => i.paymentUid}
            renderItem={renderItem}
            scrollEnabled={false}
            ListEmptyComponent={
              <Text style={styles.empty}>Aucune validation en attente.</Text>
            }
          />
          {restCount > 0 ? (
            <Pressable onPress={navigateFullList} style={styles.moreLink}>
              <Text style={styles.moreLinkTxt}>
                Voir les {restCount} autre{restCount > 1 ? 's' : ''}{' '}
                validation{restCount > 1 ? 's' : ''} →
              </Text>
            </Pressable>
          ) : null}
          {n >= 2 ? (
            <Pressable
              onPress={onBulkPress}
              disabled={bulkBusy}
              style={({ pressed }) => [
                styles.bulkBtn,
                pressed && { opacity: 0.9 },
                bulkBusy && { opacity: 0.7 },
              ]}
            >
              {bulkBusy ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.bulkTxt}>Tout valider</Text>
              )}
            </Pressable>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  panel: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.gray200,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeTxt: {
    fontSize: 22,
    color: COLORS.gray700,
    lineHeight: 24,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.gray500,
    marginBottom: 12,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    borderRadius: 10,
    marginBottom: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  rowCenter: {
    flex: 1,
    minWidth: 0,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  rowMeta: {
    fontSize: 11,
    color: COLORS.gray500,
    marginTop: 2,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  amt: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  rowBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  miniBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniOk: {
    backgroundColor: COLORS.primary,
  },
  miniOkTxt: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.white,
  },
  miniKo: {
    borderWidth: 0.5,
    borderColor: COLORS.dangerLight,
    backgroundColor: COLORS.white,
  },
  miniKoTxt: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.dangerText,
  },
  moreLink: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  moreLinkTxt: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },
  bulkBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  bulkTxt: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
  },
  empty: {
    fontSize: 13,
    color: COLORS.gray500,
    textAlign: 'center',
    paddingVertical: 16,
  },
});
