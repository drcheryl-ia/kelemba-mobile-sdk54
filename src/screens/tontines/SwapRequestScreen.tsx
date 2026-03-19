/**
 * Écran — demande d'échange de position avec un autre membre.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
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
import { useCreateSwapRequest } from '@/hooks/useTontineRotationActions';
import { parseApiError } from '@/api/errors/errorHandler';
import { getInitials, hashToColor } from '@/utils/avatarUtils';
import type { TontineMember } from '@/types/tontine';

type Props = NativeStackScreenProps<RootStackParamList, 'SwapRequestScreen'>;

export const SwapRequestScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const { tontineUid } = route.params;
  const { t } = useTranslation();
  const userUid = useSelector((state: RootState) => selectUserUid(state));

  const { members, isLoading } = useTontineMembers(tontineUid);
  const createMutation = useCreateSwapRequest(tontineUid);

  const [selectedMember, setSelectedMember] = useState<TontineMember | null>(null);

  const myMember = members.find((m) => m.userUid === userUid);
  const otherMembers = members.filter(
    (m) => m.userUid !== userUid && m.membershipStatus === 'ACTIVE'
  );

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
              'Votre demande a été envoyée à l\'organisateur.'
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

  if (isLoading) {
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

      <View style={styles.content}>
        {myMember && (
          <View style={styles.recapBlock}>
            <Text style={styles.recapTitle}>
              {t('swapRequest.yourPosition', 'Votre position actuelle')} : #{myMember.rotationOrder}
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>
          {t('swapRequest.selectMember', 'Choisir le membre avec qui échanger')}
        </Text>

        <FlatList
          data={otherMembers}
          keyExtractor={(item) => item.uid}
          renderItem={({ item }) => {
            const isSelected = selectedMember?.uid === item.uid;
            return (
              <Pressable
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
                    #{item.rotationOrder} {item.memberRole === 'CREATOR' && '• Organisateur'}
                  </Text>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={24} color="#1A6B3C" />
                )}
              </Pressable>
            );
          }}
        />

        {selectedMember && myMember && (
          <View style={styles.recapBlock}>
            <Text style={styles.recapTitle}>
              {t('swapRequest.afterSwap', 'Après l\'échange (si approuvé)')} :
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
              (!selectedMember || createMutation.isPending) && styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!selectedMember || createMutation.isPending}
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
      </View>
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
  content: {
    flex: 1,
    padding: 20,
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
    marginBottom: 12,
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
    paddingBottom: 32,
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
