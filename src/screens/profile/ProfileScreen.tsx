import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '@/navigation/types';
import { useProfile } from '@/hooks/useProfile';
import { apiClient } from '@/api/apiClient';
import { unregisterPushDeviceBeforeLogout } from '@/api/authApi';
import { ENDPOINTS } from '@/api/endpoints';
import { authStorage, STORAGE_KEYS } from '@/storage/authStorage';
import { authEventEmitter } from '@/api/authEventEmitter';
import { clearAuth, setAccountType, selectAccountType } from '@/store/authSlice';
import { upgradeToOrganizer } from '@/api/usersApi';
import { parseApiError } from '@/api/errors/errorHandler';
import { ApiErrorCode } from '@/api/errors/errorCodes';
import { logger } from '@/utils/logger';
import { SkeletonPulse } from '@/components/common/SkeletonPulse';
import {
  ProfileHeroSection,
  ProfileStatsStrip,
  ProfileMenuSection,
  ScoreHistorySection,
  PreferencesSection,
  UpgradeToOrganiserSection,
  DangerZone,
} from '@/components/profile';
import { COLORS } from '@/theme/colors';
import type { TontineDto } from '@/api/types/api.types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Profile'>;

export const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const accountType = useSelector(selectAccountType);

  const {
    userProfile,
    scoreData,
    tontinesActive,
    tontinesCompleted,
    refetchAll,
    isAnyLoading,
  } = useProfile();

  const [language, setLanguage] = useState<'fr' | 'sango'>('fr');
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    authStorage.getItem(STORAGE_KEYS.APP_LANGUAGE).then((lang) => {
      if (lang === 'fr' || lang === 'sango') setLanguage(lang);
    });
    authStorage.getItem(STORAGE_KEYS.BIOMETRIC_ENABLED).then((v) => {
      setBiometricsEnabled(v === 'true');
    });
  }, []);

  const handleEditPress = useCallback(() => {
    Alert.alert(t('profile.editComingSoon'));
  }, [t]);

  const handleLanguageChange = useCallback(
    async (lang: 'fr' | 'sango') => {
      await authStorage.setItem(STORAGE_KEYS.APP_LANGUAGE, lang);
      i18n.changeLanguage(lang);
      setLanguage(lang);
    },
    [i18n]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
      await queryClient.invalidateQueries({ queryKey: ['score', 'me'] });
      await queryClient.invalidateQueries({ queryKey: ['tontines', 'active'] });
      await queryClient.invalidateQueries({ queryKey: ['tontines', 'completed'] });
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  const handleSeeAllScore = useCallback(() => {
    navigation.navigate('ScoreHistory');
  }, [navigation]);

  const handleUpgradeConfirm = useCallback(async () => {
    setUpgradeLoading(true);
    try {
      await upgradeToOrganizer();
      await authStorage.setItem(STORAGE_KEYS.ACCOUNT_TYPE, 'ORGANISATEUR');
      dispatch(setAccountType('ORGANISATEUR'));
      setUpgradeModalVisible(false);
      await refetchAll();
      Alert.alert(t('common.success'), t('profile.upgradeSuccess'));
    } catch (err: unknown) {
      const apiErr = parseApiError(err);
      if (apiErr.code === ApiErrorCode.KYC_NOT_VERIFIED) {
        setUpgradeModalVisible(false);
        Alert.alert(
          t('common.error'),
          t('profile.upgradeErrorKyc'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('profile.goToKyc'),
              onPress: () => navigation.navigate('KycUpload', { origin: 'profile' }),
            },
          ]
        );
      } else if (apiErr.code === ApiErrorCode.ALREADY_ORGANIZER) {
        dispatch(setAccountType('ORGANISATEUR'));
        await authStorage.setItem(STORAGE_KEYS.ACCOUNT_TYPE, 'ORGANISATEUR');
        setUpgradeModalVisible(false);
        Alert.alert(t('common.error'), t('profile.upgradeErrorAlready'));
      } else {
        Alert.alert(t('common.error'), t('profile.upgradeErrorNetwork'));
      }
    } finally {
      setUpgradeLoading(false);
    }
  }, [dispatch, navigation, refetchAll, t]);

  const handleUpgradeCancel = useCallback(() => {
    if (!upgradeLoading) {
      setUpgradeModalVisible(false);
    }
  }, [upgradeLoading]);

  const handleDownloadPdf = useCallback(async () => {
    const uid = userProfile?.data?.uid;
    if (!uid) return;
    try {
      const token = await authStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const url = ENDPOINTS.REPORTS.USER_CERTIFICATE(uid).url;
      const fileUri = FileSystem.documentDirectory + 'rapport-kelemba.pdf';
      const result = await FileSystem.downloadAsync(url, fileUri, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (result.status === 200) {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(result.uri, {
            mimeType: 'application/pdf',
            dialogTitle: t('profile.pdfTitle'),
          });
        } else {
          Alert.alert(t('common.error'), t('profile.shareNotAvailable'));
        }
      } else {
        Alert.alert(t('common.error'), t('profile.pdfError'));
      }
    } catch (err: unknown) {
      logger.error('handleDownloadPdf failed', err);
      Alert.alert(t('common.error'), t('profile.pdfError'));
    }
  }, [userProfile?.data?.uid, t]);

  const performLogout = useCallback(async () => {
    try {
      await unregisterPushDeviceBeforeLogout();
      await apiClient.post(ENDPOINTS.AUTH.LOGOUT.url);
    } catch (err: unknown) {
      logger.error('logout API failed', err);
    } finally {
      await authStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      await authStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      await authStorage.removeItem(STORAGE_KEYS.ACCOUNT_TYPE);
      dispatch(clearAuth());
      queryClient.clear();
      authEventEmitter.emit('LOGOUT');
    }
  }, [dispatch, queryClient]);

  const allTontines: TontineDto[] = [
    ...(tontinesActive.data ?? []),
    ...(tontinesCompleted.data ?? []),
  ];

  const effectiveAccountType = accountType ?? userProfile.data?.accountType;
  const languageLabel =
    language === 'fr' ? 'Français' : i18n.language === 'sango' ? 'Sängö' : 'Français';

  const skeletonPulse = 'rgba(255,255,255,0.22)' as const;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.white}
            progressViewOffset={0}
          />
        }
      >
        {isAnyLoading ? (
          <>
            <View style={styles.heroBlock}>
              <View style={styles.skeletonRow}>
                <SkeletonPulse
                  width={64}
                  height={64}
                  borderRadius={32}
                  baseColor={skeletonPulse}
                />
                <View style={styles.skeletonTextCol}>
                  <SkeletonPulse
                    width="72%"
                    height={18}
                    borderRadius={4}
                    baseColor={skeletonPulse}
                  />
                  <SkeletonPulse
                    width="48%"
                    height={12}
                    borderRadius={4}
                    baseColor={skeletonPulse}
                  />
                  <SkeletonPulse
                    width={112}
                    height={22}
                    borderRadius={20}
                    baseColor={skeletonPulse}
                  />
                </View>
              </View>
              <SkeletonPulse
                width="100%"
                height={90}
                borderRadius={12}
                baseColor={skeletonPulse}
              />
            </View>
            <View style={styles.statsStripSkeleton}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={styles.statsStripCell}>
                  <SkeletonPulse width="100%" height={52} borderRadius={0} />
                </View>
              ))}
            </View>
            <View style={[styles.bodyPad, styles.menuSkeletonWrap]}>
              {[0, 1, 2].map((i) => (
                <SkeletonPulse
                  key={i}
                  width="100%"
                  height={58}
                  borderRadius={0}
                />
              ))}
            </View>
          </>
        ) : (
          <>
            <View style={styles.heroBlock}>
              <ProfileHeroSection
                user={userProfile.data}
                score={scoreData.data}
                navigation={navigation}
                onEditProfile={handleEditPress}
              />
              <ProfileStatsStrip tontines={allTontines} score={scoreData.data} />
            </View>

            <View style={styles.bodyPad}>
              <ProfileMenuSection
                user={userProfile.data}
                navigation={navigation}
                biometricsEnabled={biometricsEnabled}
              />
              <ScoreHistorySection
                score={scoreData.data}
                tontines={allTontines}
                onSeeAll={handleSeeAllScore}
              />
              <PreferencesSection
                languageLabel={languageLabel}
                onLanguagePress={() => {
                  Alert.alert(
                    t('profile.language'),
                    undefined,
                    [
                      {
                        text: 'Français',
                        onPress: () => {
                          void handleLanguageChange('fr');
                        },
                      },
                      {
                        text: 'Sängö',
                        onPress: () => {
                          void handleLanguageChange('sango');
                        },
                      },
                      { text: t('common.cancel'), style: 'cancel' },
                    ]
                  );
                }}
                onReportsPress={handleDownloadPdf}
              />
              {effectiveAccountType === 'MEMBRE' ? (
                <UpgradeToOrganiserSection
                  onContinue={() => {
                    setUpgradeModalVisible(true);
                  }}
                />
              ) : null}
              <DangerZone onLogout={performLogout} />
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={upgradeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleUpgradeCancel}
      >
        <Pressable style={styles.modalOverlay} onPress={handleUpgradeCancel}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t('profile.upgradeModalTitle')}</Text>
            <Text style={styles.modalBody}>{t('profile.upgradeModalBody')}</Text>
            <Text style={styles.modalWarning}>{t('profile.upgradeModalWarning')}</Text>
            <View style={styles.modalButtons}>
              <Pressable
                onPress={handleUpgradeCancel}
                style={styles.modalCancelButton}
                disabled={upgradeLoading}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={handleUpgradeConfirm}
                style={[styles.modalConfirmButton, upgradeLoading && styles.buttonDisabled]}
                disabled={upgradeLoading}
              >
                {upgradeLoading ? (
                  <ActivityIndicator size="small" color="#1C1C1E" />
                ) : (
                  <Text style={styles.modalConfirmText}>
                    {t('profile.upgradeModalConfirm')}
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  scroll: {
    flex: 1,
    backgroundColor: COLORS.gray100,
  },
  scrollContent: {
    paddingBottom: 80,
    flexGrow: 1,
  },
  heroBlock: {
    backgroundColor: COLORS.primary,
    paddingBottom: 0,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 16,
    paddingHorizontal: 20,
    paddingTop: 0,
  },
  skeletonTextCol: {
    flex: 1,
    gap: 8,
    marginTop: 4,
  },
  statsStripSkeleton: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.gray200,
  },
  statsStripCell: {
    flex: 1,
    height: 52,
  },
  bodyPad: {
    backgroundColor: COLORS.gray100,
    padding: 16,
    gap: 0,
  },
  menuSkeletonWrap: {
    gap: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  modalBody: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 22,
  },
  modalWarning: {
    fontSize: 14,
    color: '#D0021B',
    fontWeight: '600',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    minHeight: 48,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F5A623',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
