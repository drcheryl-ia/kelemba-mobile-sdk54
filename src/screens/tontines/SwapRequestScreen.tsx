/**
 * Écran — demande d'échange de position avec un autre membre.
 * Liste filtrée : membres n'ayant pas encore perçu toutes leurs cagnottes + vue des positions.
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';
import { selectUserUid } from '@/store/authSlice';
import { useTontineMembers } from '@/hooks/useTontineMembers';
import { useTontineDetails } from '@/hooks/useTontineDetails';
import { useTontineRotation } from '@/hooks/useTontineRotation';
import { useCreateSwapRequest } from '@/hooks/useTontineRotationActions';
import { parseApiError } from '@/api/errors/errorHandler';
import { getInitials, hashToColor } from '@/utils/avatarUtils';
import type { TontineMember } from '@/types/tontine';
import { memberHasPendingBeneficiaryPayout } from '@/utils/homePayoutScheduleFromRotation';

type Props = NativeStackScreenProps<RootStackParamList, 'SwapRequestScreen'>;

export const SwapRequestScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const { tontineUid } = route.params;
  const { t } = useTranslation();
  const userUid = useSelector((state: RootState) => selectUserUid(state));

  const { tontine } = useTontineDetails(tontineUid);
  const { members, isLoading: membersLoading } = useTontineMembers(tontineUid);
  const rotationQueryEnabled =
    Boolean(tontineUid && tontine && tontine.status !== 'DRAFT');
  const {
    rotationList,
    memberCount: rotationMemberCount,
    isLoading: rotationLoading,
    isError: rotationError,
  } = useTontineRotation(tontineUid, { enabled: rotationQueryEnabled });

  const createMutation = useCreateSwapRequest(tontineUid);

  const [selectedMember, setSelectedMember] = useState<TontineMember | null>(null);

  const myMember = members.find((m) => m.userUid === userUid);
  const otherMembers = useMemo(
    () =>
      members.filter(
        (m) => m.userUid !== userUid && m.membershipStatus === 'ACTIVE'
      ),
    [members, userUid]
  );

  const membersSortedByPosition = useMemo(
    () => [...members].sort((a, b) => a.rotationOrder - b.rotationOrder),
    [members]
  );

  const eligibleOtherMembers = useMemo(() => {
    if (!rotationQueryEnabled) return otherMembers;
    if (rotationLoading) return [];
    if (rotationError || rotationList.length === 0) return otherMembers;
    return otherMembers.filter((m) =>
      memberHasPendingBeneficiaryPayout(m.userUid, rotationList)
    );
  }, [
    otherMembers,
    rotationList,
    rotationLoading,
    rotationError,
    rotationQueryEnabled,
  ]);

  useEffect(() => {
    if (
      selectedMember != null &&
      !eligibleOtherMembers.some((m) => m.uid === selectedMember.uid)
    ) {
      setSelectedMember(null);
    }
  }, [eligibleOtherMembers, selectedMember]);

  const handleSubmit = () => {
    if (!selectedMember) return;

    createMutation.mutate(
      { targetMemberUid: selectedMember.uid },
      {
        onSuccess: () => {
          Alert.alert(
            t('swapRequest.successTitle', 'Demande envoyée'),
            t(
              'swapRequest.successMessage',
              "Votre demande a été envoyée à l'organisateur."
            ),
            [{ text: t('common.ok'), onPress: () => navigation.goBack() }]
          );
        },
        onError: (err: unknown) => {
          const apiErr = parseApiError(err);
          if (apiErr.httpStatus === 409) {
            Alert.alert(
              t('swapRequest.error409Title', 'Demande existante'),
              t(
                'swapRequest.error409Message',
                'Vous avez déjà une demande en attente.'
              )
            );
          } else if (apiErr.httpStatus === 400) {
            Alert.alert(t('common.error', 'Erreur'), apiErr.message);
          } else {
            Alert.alert(
              t('common.error', 'Erreur'),
              t('register.errorNetwork', 'Vérifiez votre connexion et réessayez.')
            );
          }
        },
      }
    );
  };

  const loading =
    membersLoading || (rotationQueryEnabled && rotationLoading);

  if (membersLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#1A6B3C" />
          </Pressable>
          <Text style={styles.headerTitle}>
            {t('swapRequest.title', 'Demander un échange')}
          </Text>
        </View>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#1A6B3C" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color="#1A6B3C" />
        </Pressable>
        <Text style={styles.headerTitle}>
          {t('swapRequest.title', 'Demander un échange')}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {myMember && (
          <View style={styles.recapBlock}>
            <Text style={styles.recapTitle}>
              {t('swapRequest.yourPosition', 'Votre position actuelle')} : #
              {myMember.rotationOrder}
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>
          {t('swapRequest.positionsTitle', 'Ordre de rotation (positions)')}
        </Text>
        <Text style={styles.hintText}>
          {t(
            'swapRequest.positionsHint',
            'Chaque numéro correspond à une place dans la file. Un échange permute votre position avec celle du membre choisi.'
          )}
        </Text>
        <View style={styles.positionsWrap}>
          {membersSortedByPosition
            .filter((m) => m.membershipStatus === 'ACTIVE')
            .map((m) => {
              const isYou = m.userUid === userUid;
              return (
                <View
                  key={m.uid}
                  style={[styles.positionChip, isYou && styles.positionChipYou]}
                >
                  <Text style={styles.positionChipNum}>#{m.rotationOrder}</Text>
                  <Text style={styles.positionChipName} numberOfLines={1}>
                    {isYou
                      ? t('swapRequest.you', 'Vous')
                      : m.fullName}
                  </Text>
                </View>
              );
            })}
        </View>
        {rotationMemberCount > 0 ? (
          <Text style={styles.metaLine}>
            {t('swapRequest.positionsMeta', {
              count: rotationMemberCount,
              defaultValue: '{{count}} position(s) dans la rotation',
            })}
          </Text>
        ) : null}

        {rotationQueryEnabled && rotationError ? (
          <View style={styles.warnBanner}>
            <Ionicons name="warning-outline" size={18} color="#92400E" />
            <Text style={styles.warnBannerText}>
              {t(
                'swapRequest.rotationUnavailable',
                'Impossible de charger la rotation. Tous les membres actifs sont proposés.'
              )}
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>
          {t(
            'swapRequest.eligibleTitle',
            'Membres avec cagnotte(s) encore à venir'
          )}
        </Text>
        <Text style={styles.hintText}>
          {t(
            'swapRequest.eligibleHint',
            'Seuls les membres qui n’ont pas encore reçu toutes leurs cagnottes peuvent être choisis pour un échange.'
          )}
        </Text>

        {rotationQueryEnabled && rotationLoading ? (
          <View style={styles.rotationLoadingRow}>
            <ActivityIndicator size="small" color="#1A6B3C" />
            <Text style={styles.rotationLoadingText}>
              {t('swapRequest.rotationLoading', 'Chargement de la rotation…')}
            </Text>
          </View>
        ) : eligibleOtherMembers.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              {t(
                'swapRequest.eligibleEmpty',
                'Aucun autre membre n’est disponible pour un échange.'
              )}
            </Text>
          </View>
        ) : (
          eligibleOtherMembers.map((item) => {
            const isSelected = selectedMember?.uid === item.uid;
            return (
              <Pressable
                key={item.uid}
                style={[styles.memberRow, isSelected && styles.memberRowSelected]}
                onPress={() => setSelectedMember(isSelected ? null : item)}
              >
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: hashToColor(item.fullName) },
                  ]}
                >
                  <Text style={styles.avatarText}>{getInitials(item.fullName)}</Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{item.fullName}</Text>
                  <Text style={styles.positionText}>
                    #{item.rotationOrder}{' '}
                    {item.memberRole === 'CREATOR'
                      ? `• ${t('tontineList.organizer', 'Organisateur')}`
                      : ''}
                  </Text>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={24} color="#1A6B3C" />
                )}
              </Pressable>
            );
          })
        )}

        {selectedMember && myMember && (
          <View style={styles.recapBlock}>
            <Text style={styles.recapTitle}>
              {t('swapRequest.afterSwap', "Après l'échange (si approuvé)")} :
            </Text>
            <Text style={styles.recapText}>
              {t('swapRequest.youTo', 'Vous')} → #{selectedMember.rotationOrder}
            </Text>
            <Text style={styles.recapText}>
              {selectedMember.fullName} → #{myMember.rotationOrder}
            </Text>
          </View>
        )}

        <View style={styles.footer}>
          <Pressable
            style={[
              styles.submitBtn,
              (!selectedMember || createMutation.isPending || loading) &&
                styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!selectedMember || createMutation.isPending || loading}
            accessibilityRole="button"
          >
            {createMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#FFFFFF" />
                <Text style={styles.submitBtnText}>
                  {t('swapRequest.submit', 'Envoyer la demande')}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  recapBlock: {
    backgroundColor: '#E8F5EE',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  recapTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A6B3C',
    marginBottom: 8,
  },
  recapText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  hintText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 12,
  },
  positionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  positionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxWidth: '100%',
  },
  positionChipYou: {
    borderColor: '#1A6B3C',
    backgroundColor: '#F0FDF4',
  },
  positionChipNum: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A6B3C',
  },
  positionChipName: {
    fontSize: 13,
    color: '#374151',
    flexShrink: 1,
    maxWidth: 140,
  },
  metaLine: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 16,
  },
  rotationLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  rotationLoadingText: {
    fontSize: 13,
    color: '#6B7280',
  },
  warnBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 16,
  },
  warnBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  emptyBox: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  memberRowSelected: {
    borderWidth: 2,
    borderColor: '#1A6B3C',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  positionText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  footer: {
    marginTop: 16,
    paddingBottom: 16,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1A6B3C',
    paddingVertical: 16,
    borderRadius: 12,
    minHeight: 52,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
