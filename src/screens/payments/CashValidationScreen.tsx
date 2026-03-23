/**
 * CashValidationScreen — l'organisateur valide ou refuse les paiements espèces.
 */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import {
  getCashPendingRequests,
  validateCashPayment,
  type CashPendingItem,
} from '@/api/cashPaymentApi';
import { formatFcfa } from '@/utils/formatters';
import { useSelector } from 'react-redux';
import { selectUserUid } from '@/store/authSlice';
import { useTontines } from '@/hooks/useTontines';
import { getOrganizerTontineUids } from '@/hooks/useOrganizerCashPending';

type Props = NativeStackScreenProps<RootStackParamList, 'CashValidationScreen'>;

function formatDate(str: string): string {
  const d = new Date(str);
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const CashValidationScreen: React.FC<Props> = ({ navigation, route }) => {
  const { tontineUid, tontineName } = route.params;
  const queryClient = useQueryClient();
  const currentUserUid = useSelector(selectUserUid);
  const { tontines, isLoading: tontinesLoading } = useTontines({
    includeInvitations: false,
  });
  const organizerUids = useMemo(
    () => getOrganizerTontineUids(tontines),
    [tontines]
  );
  const isOrganizerOfThisTontine = organizerUids.has(tontineUid);

  useEffect(() => {
    if (tontinesLoading) return;
    if (!isOrganizerOfThisTontine) {
      Alert.alert(
        'Accès réservé',
        'La validation des paiements espèces est réservée aux organisateurs de cette tontine.'
      );
      navigation.replace('MainTabs', { screen: 'Payments' });
    }
  }, [tontinesLoading, isOrganizerOfThisTontine, navigation]);

  const [selectedItem, setSelectedItem] = useState<CashPendingItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [photoZoomed, setPhotoZoomed] = useState(false);
  const [zoomItem, setZoomItem] = useState<CashPendingItem | null>(null);

  const { data: requests = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['cash-pending', tontineUid],
    queryFn: () => getCashPendingRequests(tontineUid),
    staleTime: 30_000,
    enabled: !tontinesLoading && isOrganizerOfThisTontine,
  });

  const pendingOnly = useMemo(
    () =>
      requests
        .filter((r) => r.status === 'PENDING_REVIEW')
        .filter((r) => !currentUserUid || r.member.uid !== currentUserUid),
    [requests, currentUserUid]
  );

  const validateMutation = useMutation({
    mutationFn: ({
      paymentUid,
      action,
      reason,
    }: {
      paymentUid: string;
      action: 'APPROVE' | 'REJECT';
      reason?: string;
    }) => validateCashPayment(paymentUid, action, reason),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['cash-pending', tontineUid] });
      queryClient.invalidateQueries({ queryKey: ['payments', 'cash', 'organizer'] });
      queryClient.invalidateQueries({ queryKey: ['payments', 'history'] });
      queryClient.invalidateQueries({ queryKey: ['payments', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['cycle', 'current', tontineUid] });
      queryClient.invalidateQueries({ queryKey: ['members', tontineUid] });
      queryClient.invalidateQueries({ queryKey: ['tontines'] });
      setSelectedItem(null);
      setShowRejectModal(false);
      Alert.alert(
        vars.action === 'APPROVE' ? 'Paiement validé ✓' : 'Paiement refusé',
        vars.action === 'APPROVE'
          ? 'Le paiement a été confirmé et le montant collecté mis à jour.'
          : 'Le membre a été notifié du refus.'
      );
    },
    onError: () => Alert.alert('Erreur', 'Impossible de traiter la demande. Réessayez.'),
  });

  const handleApprove = useCallback(
    (item: CashPendingItem) => {
      Alert.alert(
        'Valider le paiement',
        `Confirmer la réception de ${formatFcfa(item.payment.amount)} en espèces de ${item.member.fullName} ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Valider',
            onPress: () =>
              validateMutation.mutate({ paymentUid: item.payment.uid, action: 'APPROVE' }),
          },
        ]
      );
    },
    [validateMutation]
  );

  const handleRejectConfirm = useCallback(() => {
    if (!selectedItem) return;
    if (!rejectReason.trim()) {
      Alert.alert('Motif requis', 'Indiquez la raison du refus.');
      return;
    }
    validateMutation.mutate({
      paymentUid: selectedItem.payment.uid,
      action: 'REJECT',
      reason: rejectReason.trim(),
    });
  }, [selectedItem, rejectReason, validateMutation]);

  const openPhotoZoom = useCallback((item: CashPendingItem) => {
    setZoomItem(item);
    setPhotoZoomed(true);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: CashPendingItem }) => (
      <View style={s.card}>
        <View style={s.cardHeader}>
          <View style={s.memberRow}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{item.member.fullName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.memberName}>{item.member.fullName}</Text>
              <Text style={s.submittedAt}>{formatDate(item.submittedAt)}</Text>
            </View>
            <View style={s.amountBadge}>
              <Text style={s.amountBadgeText}>{formatFcfa(item.payment.amount)}</Text>
            </View>
          </View>
        </View>

        <View style={s.infoRow}>
          <Ionicons name="person-outline" size={14} color="#6B7280" />
          <Text style={s.infoText}>
            Remis à : <Text style={s.infoValue}>{item.receiverName}</Text>
          </Text>
        </View>

        <View style={s.infoRow}>
          <Ionicons name="refresh-outline" size={14} color="#6B7280" />
          <Text style={s.infoText}>
            Cycle {item.cycle.cycleNumber} — {item.cycle.expectedDate.slice(0, 10)}
          </Text>
        </View>

        {item.receiptPhotoUrl ? (
          <Pressable onPress={() => openPhotoZoom(item)}>
            <Image
              source={{ uri: item.receiptPhotoUrl }}
              style={s.receiptThumb}
              resizeMode="cover"
            />
            <Text style={s.viewPhotoHint}>Appuyer pour agrandir</Text>
          </Pressable>
        ) : (
          <View style={s.noPhoto}>
            <Ionicons name="image-outline" size={20} color="#9CA3AF" />
            <Text style={s.noPhotoText}>Aucune photo fournie</Text>
          </View>
        )}

        <View style={s.actions}>
          <Pressable
            style={[s.rejectBtn, validateMutation.isPending && s.btnDisabled]}
            onPress={() => {
              setSelectedItem(item);
              setShowRejectModal(true);
            }}
            disabled={validateMutation.isPending}
          >
            <Ionicons name="close-circle-outline" size={18} color="#D0021B" />
            <Text style={s.rejectBtnText}>Refuser</Text>
          </Pressable>
          <Pressable
            style={[s.approveBtn, validateMutation.isPending && s.btnDisabled]}
            onPress={() => handleApprove(item)}
            disabled={validateMutation.isPending}
          >
            {validateMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                <Text style={s.approveBtnText}>Valider</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    ),
    [handleApprove, openPhotoZoom, validateMutation.isPending]
  );

  if (tontinesLoading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.loadingCenter}>
          <ActivityIndicator size="large" color="#1A6B3C" />
        </View>
      </SafeAreaView>
    );
  }

  if (!isOrganizerOfThisTontine) {
    return null;
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color="#1A6B3C" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Paiements espèces</Text>
          <Text style={s.headerSub}>{tontineName}</Text>
        </View>
        {pendingOnly.length > 0 && (
          <View style={s.countBadge}>
            <Text style={s.countBadgeText}>{pendingOnly.length}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={pendingOnly}
        keyExtractor={(item) => item.uid}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor="#1A6B3C" />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={s.listEmptyCenter}>
              <ActivityIndicator size="large" color="#1A6B3C" />
            </View>
          ) : (
            <View style={s.listEmptyCenter}>
              <Ionicons name="checkmark-done-circle-outline" size={64} color="#1A6B3C" />
              <Text style={s.emptyText}>Aucun paiement en attente</Text>
              <Text style={s.emptySub}>Tous les paiements espèces ont été traités.</Text>
            </View>
          )
        }
      />

      <Modal visible={showRejectModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Motif du refus</Text>
            <Text style={s.modalSub}>
              {selectedItem?.member.fullName} —{' '}
              {selectedItem ? formatFcfa(selectedItem.payment.amount) : ''}
            </Text>
            <TextInput
              style={s.modalInput}
              placeholder="Ex : Montant incorrect, reçu illisible…"
              placeholderTextColor="#9CA3AF"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
              maxLength={500}
            />
            <View style={s.modalActions}>
              <Pressable
                style={s.modalCancelBtn}
                onPress={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
              >
                <Text style={s.modalCancelText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={[s.modalRejectBtn, !rejectReason.trim() && s.btnDisabled]}
                onPress={handleRejectConfirm}
                disabled={!rejectReason.trim() || validateMutation.isPending}
              >
                {validateMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={s.modalRejectText}>Confirmer le refus</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={photoZoomed} transparent animationType="fade">
        <Pressable
          style={s.photoModal}
          onPress={() => {
            setPhotoZoomed(false);
            setZoomItem(null);
          }}
        >
          {zoomItem?.receiptPhotoUrl && (
            <Image
              source={{ uri: zoomItem.receiptPhotoUrl }}
              style={s.photoFull}
              resizeMode="contain"
            />
          )}
          <Text style={s.photoModalHint}>Appuyer pour fermer</Text>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F4F6' },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1C1C1E' },
  headerSub: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D0021B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countBadgeText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  list: { padding: 16, paddingBottom: 40, gap: 12 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {},
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A6B3C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  memberName: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  submittedAt: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  amountBadge: {
    backgroundColor: '#E8F5EE',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  amountBadgeText: { fontSize: 14, fontWeight: '800', color: '#1A6B3C' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 13, color: '#6B7280' },
  infoValue: { fontWeight: '600', color: '#1C1C1E' },
  receiptThumb: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  viewPhotoHint: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 4 },
  noPhoto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  noPhotoText: { fontSize: 13, color: '#9CA3AF' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: '#D0021B',
    borderRadius: 12,
    paddingVertical: 12,
    minHeight: 48,
  },
  rejectBtnText: { fontSize: 14, fontWeight: '700', color: '#D0021B' },
  approveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1A6B3C',
    borderRadius: 12,
    paddingVertical: 12,
    minHeight: 48,
  },
  approveBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  btnDisabled: { opacity: 0.5 },
  listEmptyCenter: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  emptySub: { fontSize: 14, color: '#6B7280', textAlign: 'center', paddingHorizontal: 32 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1C1C1E' },
  modalSub: { fontSize: 14, color: '#6B7280', marginTop: -8 },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    padding: 14,
    fontSize: 14,
    color: '#1C1C1E',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 52,
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  modalRejectBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D0021B',
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 52,
  },
  modalRejectText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  photoModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoFull: { width: '100%', height: '80%' },
  photoModalHint: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 16 },
});
