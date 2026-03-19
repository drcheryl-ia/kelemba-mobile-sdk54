/**
 * Carte de résultat de recherche utilisateur — affichage, parts, ajout, score/KYC.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { getInitials, hashToColor } from '@/utils/avatarUtils';
import { formatPhoneSafe } from '@/utils/formatters';
import type { UserLookupResult } from '@/types/invite';

export interface UserLookupCardProps {
  user?: UserLookupResult | null;
  isNotFound: boolean;
  isLoading: boolean;
  sharesCount: number;
  onSharesChange: (n: number) => void;
  onAdd: () => void;
  onInviteSms?: () => void;
  onConfirmLowScore?: () => void;
}

const MIN_PARTS = 1;
const MAX_PARTS = 5;

export const UserLookupCard: React.FC<UserLookupCardProps> = ({
  user,
  isNotFound,
  isLoading,
  sharesCount,
  onSharesChange,
  onAdd,
  onInviteSms,
  onConfirmLowScore,
}) => {
  const { t } = useTranslation();
  const [lowScoreModalVisible, setLowScoreModalVisible] = useState(false);

  const handleAdd = () => {
    if (user && user.kelembScore < 300 && !lowScoreModalVisible) {
      setLowScoreModalVisible(true);
      return;
    }
    onAdd();
    setLowScoreModalVisible(false);
  };

  const handleConfirmAnyway = () => {
    setLowScoreModalVisible(false);
    onConfirmLowScore?.();
    onAdd();
  };

  if (isLoading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color="#1A6B3C" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (isNotFound) {
    return (
      <View style={styles.card}>
        <View style={styles.notFoundIcon}>
          <Ionicons name="person-outline" size={40} color="#9E9E9E" />
        </View>
        <Text style={styles.notFoundTitle}>{t('inviteMembers.notOnKelemba')}</Text>
        <Text style={styles.notFoundSubtitle}>{t('inviteMembers.sendInviteSms')}</Text>
        <View style={styles.partsRow}>
          <Text style={styles.partsLabel}>{t('inviteMembers.parts')}</Text>
          <View style={styles.partsStepper}>
            <Pressable
              onPress={() => onSharesChange(Math.max(MIN_PARTS, sharesCount - 1))}
              style={styles.stepperBtn}
              disabled={sharesCount <= MIN_PARTS}
            >
              <Ionicons name="remove" size={20} color={sharesCount <= MIN_PARTS ? '#9E9E9E' : '#1A6B3C'} />
            </Pressable>
            <Text style={styles.partsValue}>{sharesCount}</Text>
            <Pressable
              onPress={() => onSharesChange(Math.min(MAX_PARTS, sharesCount + 1))}
              style={styles.stepperBtn}
              disabled={sharesCount >= MAX_PARTS}
            >
              <Ionicons name="add" size={20} color={sharesCount >= MAX_PARTS ? '#9E9E9E' : '#1A6B3C'} />
            </Pressable>
          </View>
        </View>
        {onInviteSms && (
          <Pressable style={styles.addBtn} onPress={onInviteSms}>
            <Text style={styles.addBtnText}>{t('inviteMembers.sendInviteSms')}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (!user) return null;

  const isLowScore = user.kelembScore < 300;
  const isKycVerified = user.kycStatus === 'VERIFIED';

  const getScoreLabel = () => {
    if (user.kelembScore >= 700) return t('inviteMembers.scoreFiable');
    if (user.kelembScore >= 500) return t('inviteMembers.scoreMoyen');
    if (user.kelembScore >= 300) return t('inviteMembers.scorePrudence');
    return t('inviteMembers.scoreRisque');
  };

  return (
    <View style={styles.card}>
      {isLowScore && (
        <View style={styles.lowScoreBanner}>
          <Ionicons name="warning" size={20} color="#FFFFFF" />
          <Text style={styles.lowScoreText}>{t('inviteMembers.lowScoreWarning')}</Text>
        </View>
      )}
      <View style={styles.userRow}>
        <View style={[styles.avatar, { backgroundColor: hashToColor(user.fullName ?? '') }]}>
          <Text style={styles.avatarText}>{getInitials(user.fullName ?? '')}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.fullName ?? '—'}</Text>
          <Text style={styles.userPhone}>{formatPhoneSafe(user.phoneMasked)}</Text>
          <View style={styles.badges}>
            <View style={[styles.badge, styles.scoreBadge]}>
              <Text style={styles.badgeText}>{user.kelembScore} — {getScoreLabel()}</Text>
            </View>
            <View style={[styles.badge, isKycVerified ? styles.kycVerified : styles.kycPending]}>
              <Text style={styles.badgeText}>
                {isKycVerified ? t('inviteMembers.kycVerified') : t('inviteMembers.kycPending')}
              </Text>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.partsRow}>
        <Text style={styles.partsLabel}>{t('inviteMembers.parts')}</Text>
        <View style={styles.partsStepper}>
          <Pressable
            onPress={() => onSharesChange(Math.max(MIN_PARTS, sharesCount - 1))}
            style={styles.stepperBtn}
            disabled={sharesCount <= MIN_PARTS}
          >
            <Ionicons name="remove" size={20} color={sharesCount <= MIN_PARTS ? '#9E9E9E' : '#1A6B3C'} />
          </Pressable>
          <Text style={styles.partsValue}>{sharesCount}</Text>
          <Pressable
            onPress={() => onSharesChange(Math.min(MAX_PARTS, sharesCount + 1))}
            style={styles.stepperBtn}
            disabled={sharesCount >= MAX_PARTS}
          >
            <Ionicons name="add" size={20} color={sharesCount >= MAX_PARTS ? '#9E9E9E' : '#1A6B3C'} />
          </Pressable>
        </View>
      </View>
      <Pressable style={styles.addBtn} onPress={handleAdd}>
        <Text style={styles.addBtnText}>{t('inviteMembers.addToList')}</Text>
      </Pressable>

      <Modal
        visible={lowScoreModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLowScoreModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setLowScoreModalVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t('inviteMembers.lowScoreWarning')}</Text>
            <Text style={styles.modalBody}>
              {t('inviteMembers.confirmLowScoreBody', "Voulez-vous l'ajouter malgré tout ?")}
            </Text>
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setLowScoreModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>{t('inviteMembers.cancel')}</Text>
              </Pressable>
              <Pressable style={styles.modalConfirmBtn} onPress={handleConfirmAnyway}>
                <Text style={styles.modalConfirmText}>{t('inviteMembers.confirmAnyway')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  notFoundIcon: {
    alignItems: 'center',
    marginBottom: 12,
  },
  notFoundTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 8,
  },
  notFoundSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  lowScoreBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#D0021B',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  lowScoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  scoreBadge: {
    backgroundColor: '#E8F5E9',
  },
  kycVerified: {
    backgroundColor: '#E8F5E9',
  },
  kycPending: {
    backgroundColor: '#EEEEEE',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  partsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  partsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  partsStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  partsValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    minWidth: 24,
    textAlign: 'center',
  },
  addBtn: {
    backgroundColor: '#1A6B3C',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  addBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  modalBody: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#D0021B',
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
