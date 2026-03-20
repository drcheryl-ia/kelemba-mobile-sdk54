/**
 * Écran — réordonnancement manuel de la rotation (drag-and-drop).
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, {
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useTontineMembers } from '@/hooks/useTontineMembers';
import { useReorderRotation } from '@/hooks/useTontineRotationActions';
import { parseApiError } from '@/api/errors/errorHandler';
import { getInitials, hashToColor } from '@/utils/avatarUtils';
import type { TontineMember } from '@/types/tontine';

type Props = NativeStackScreenProps<RootStackParamList, 'RotationReorderScreen'>;

export const RotationReorderScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const { tontineUid } = route.params;
  const { t } = useTranslation();

  const { members, isLoading } = useTontineMembers(tontineUid);
  const reorderMutation = useReorderRotation(tontineUid);

  const sortedMembers = [...members].sort((a, b) => a.rotationOrder - b.rotationOrder);
  const [localMembers, setLocalMembers] = useState<TontineMember[]>(sortedMembers);

  useEffect(() => {
    setLocalMembers(sortedMembers);
  }, [members]);

  const handleDragEnd = useCallback(
    ({ data }: { data: TontineMember[] }) => {
      setLocalMembers(data);
    },
    []
  );

  const handleSave = useCallback(() => {
    if (localMembers.length < 2) {
      Alert.alert(
        t('common.error', 'Erreur'),
        t('rotationReorder.minMembers', 'Au moins 2 membres requis.')
      );
      return;
    }

    // Toujours utiliser orderedSlotMembershipUids (format prioritaire accepté par le backend
    // pour mono ET multi-parts). orderedMemberUids est rejeté dès qu'un membre a sharesCount > 1.
    const orderedSlotMembershipUids: string[] = [];
    for (const m of localMembers) {
      const count = Math.max(1, m.sharesCount ?? 1);
      for (let i = 0; i < count; i++) {
        orderedSlotMembershipUids.push(m.uid);
      }
    }

    reorderMutation.mutate(
      { orderedSlotMembershipUids },
      {
        onSuccess: () => {
          Alert.alert(
            t('rotationReorder.successTitle', 'Ordre mis à jour'),
            t('rotationReorder.successMessage', "L'ordre de rotation a été enregistré.")
          );
          navigation.goBack();
        },
        onError: (err: unknown) => {
          const apiErr = parseApiError(err);
          if (apiErr.httpStatus === 400) {
            Alert.alert(
              t('common.error', 'Erreur'),
              apiErr.message
            );
          } else {
            Alert.alert(
              t('common.error', 'Erreur'),
              t('register.errorNetwork', 'Vérifiez votre connexion et réessayez.')
            );
          }
        },
      }
    );
  }, [localMembers, reorderMutation, navigation, t]);

  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<TontineMember>) => (
      <Pressable
        onLongPress={drag}
        style={[styles.memberRow, isActive && styles.memberRowActive]}
      >
        <Ionicons name="reorder-three" size={24} color="#9E9E9E" />
        <View
          style={[styles.avatar, { backgroundColor: hashToColor(item.fullName) }]}
        >
          <Text style={styles.avatarText}>{getInitials(item.fullName)}</Text>
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{item.fullName}</Text>
          <Text style={styles.positionText}>
            #{item.rotationOrder} {item.memberRole === 'CREATOR' && '• Organisateur'}
          </Text>
        </View>
      </Pressable>
    ),
    []
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#1A6B3C" />
          </Pressable>
          <Text style={styles.headerTitle}>
            {t('rotationReorder.title', "Modifier l'ordre")}
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
          {t('rotationReorder.title', "Modifier l'ordre")}
        </Text>
      </View>

      <Text style={styles.hint}>
        {t('rotationReorder.hint', 'Maintenez appuyé pour déplacer un membre.')}
      </Text>

      <DraggableFlatList
        data={localMembers}
        keyExtractor={(item) => item.uid}
        renderItem={renderItem}
        onDragEnd={handleDragEnd}
      />

      <View style={styles.footer}>
        <Pressable
          style={[styles.saveBtn, reorderMutation.isPending && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={reorderMutation.isPending}
          accessibilityRole="button"
        >
          {reorderMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>
                {t('rotationReorder.save', "Enregistrer l'ordre")}
              </Text>
            </>
          )}
        </Pressable>
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
  hint: {
    fontSize: 13,
    color: '#6B7280',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F7F8FA',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginVertical: 6,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  memberRowActive: {
    backgroundColor: '#E8F5EE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
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
    padding: 20,
    paddingBottom: 32,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F5A623',
    paddingVertical: 16,
    borderRadius: 12,
    minHeight: 52,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
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
