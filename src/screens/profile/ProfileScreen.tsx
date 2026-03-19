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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '@/navigation/types';
import { useProfile } from '@/hooks/useProfile';
import { apiClient } from '@/api/apiClient';
import { ENDPOINTS } from '@/api/endpoints';
import { authStorage, STORAGE_KEYS } from '@/storage/authStorage';
import { authEventEmitter } from '@/api/authEventEmitter';
import { clearAuth, setAccountType, selectAccountType } from '@/store/authSlice';
import { upgradeToOrganizer } from '@/api/usersApi';
import { parseApiError } from '@/api/errors/errorHandler';
import { ApiErrorCode } from '@/api/errors/errorCodes';
import { logger } from '@/utils/logger';
import {
  ProfileHeader,
  ProfileScoreCard,
  ProfileStatsRow,
  ProfileSettings,
} from '@/components/profile';
import type { TontineDto } from '@/api/types/api.types';
import type { KycStatus } from '@/types/user.types';
import {
  KYC_STATUS_LABEL_KEYS,
  KYC_STATUS_MESSAGE_KEYS,
  KYC_STATUS_SEVERITY,
} from '@/utils/kyc';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Profile'>;

function computeTotalCotise(
  active: TontineDto[],
  completed: TontineDto[]
): number {
  const all = [...active, ...completed];
  return all.reduce(
    (sum, t) => sum + (t.amountPerShare ?? 0) * (t.totalCycles ?? 0),
    0
  );
}

function getKycBannerColors(status: KycStatus): {
  backgroundColor: string;
  borderColor: string;
  titleColor: string;
  bodyColor: string;
} {
  const severity = KYC_STATUS_SEVERITY[status];

  if (severity === 'error') {
    return {
      backgroundColor: '#FEE2E2',
      borderColor: '#FCA5A5',
      titleColor: '#B91C1C',
      bodyColor: '#991B1B',
    };
  }

  if (severity === 'info') {
    return {
      backgroundColor: '#E0F2FE',
      borderColor: '#7DD3FC',
      titleColor: '#075985',
      bodyColor: '#0369A1',
    };
  }

  return {
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
    titleColor: '#C2410C',
    bodyColor: '#9A3412',
  };
}

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
  } = useProfile();

  const [language, setLanguage] = useState<'fr' | 'sango'>('fr');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  useEffect(() => {
    authStorage.getItem(STORAGE_KEYS.APP_LANGUAGE).then((lang) => {
      if (lang === 'fr' || lang === 'sango') setLanguage(lang);
    });
    authStorage.getItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED).then((v) => {
      setNotificationsEnabled(v !== 'false');
    });
    authStorage.getItem(STORAGE_KEYS.BIOMETRIC_ENABLED).then((v) => {
      setBiometricsEnabled(v === 'true');
    });
  }, []);

  const titleText =
    i18n.language === 'sango' ? t('profile.titleSango') : t('profile.title');

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

  const handleNotificationsChange = useCallback(async (value: boolean) => {
    await authStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, String(value));
    setNotificationsEnabled(value);
  }, []);

  const handleBiometricsChange = useCallback(async (value: boolean) => {
    await authStorage.setItem(STORAGE_KEYS.BIOMETRIC_ENABLED, String(value));
    setBiometricsEnabled(value);
  }, []);

  const handleSecurityPress = useCallback(() => {
    navigation.navigate('ChangePin');
  }, [navigation]);

  const handleImproveScorePress = useCallback(() => {
    navigation.navigate('ScoreHistory');
  }, [navigation]);

  const handleKycBannerPress = useCallback(() => {
    navigation.navigate('KycUpload', { origin: 'profile' });
  }, [navigation]);

  const handleUpgradePress = useCallback(() => {
    setUpgradeModalVisible(true);
  }, []);

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

  const handleLogout = useCallback(async () => {
    Alert.alert(
      t('profile.logoutConfirmTitle'),
      t('profile.logoutConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.logout'),
          style: 'destructive',
          onPress: async () => {
            try {
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
          },
        },
      ]
    );
  }, [dispatch, queryClient, t]);

  const totalCotise = computeTotalCotise(
    tontinesActive.data ?? [],
    tontinesCompleted.data ?? []
  );
  const score = scoreData.data?.currentScore ?? 0;
  const currentKycStatus = userProfile?.data?.kycStatus ?? null;
  const kycBannerColors =
    currentKycStatus != null ? getKycBannerColors(currentKycStatus) : null;
  const kycBannerTitle =
    currentKycStatus != null ? t(KYC_STATUS_LABEL_KEYS[currentKycStatus]) : null;
  const kycBannerMessage =
    currentKycStatus != null ? t(KYC_STATUS_MESSAGE_KEYS[currentKycStatus]) : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>← {titleText}</Text>
        <Pressable onPress={handleEditPress} hitSlop={8}>
          <Ionicons name="pencil-outline" size={24} color="#1A1A2E" />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {score === 0 && (
          <View style={styles.kycBanner}>
            <Text style={styles.kycBannerText}>
              {t('profile.scoreZeroWarning')}
            </Text>
          </View>
        )}

        {userProfile?.data?.kycStatus !== 'VERIFIED' && userProfile?.data && (
          <Pressable
            style={[
              styles.kycBannerCard,
              {
                backgroundColor: kycBannerColors?.backgroundColor,
                borderColor: kycBannerColors?.borderColor,
              },
            ]}
            onPress={handleKycBannerPress}
          >
            <Text
              style={[
                styles.kycBannerTitle,
                { color: kycBannerColors?.titleColor },
              ]}
            >
              {kycBannerTitle}
            </Text>
            <Text
              style={[
                styles.kycBannerBody,
                { color: kycBannerColors?.bodyColor },
              ]}
            >
              {kycBannerMessage ?? t('profile.kycPending')}
            </Text>
          </Pressable>
        )}

        <ProfileHeader
          profile={userProfile.data}
          isLoading={userProfile.isLoading}
        />

        {(accountType ?? userProfile.data?.accountType) && (
          <View style={styles.accountTypeSection}>
            <View
              style={[
                styles.accountTypeBadge,
                (accountType ?? userProfile.data?.accountType) === 'ORGANISATEUR'
                  ? styles.badgeOrganizer
                  : styles.badgeMember,
              ]}
            >
              <Text
                style={[
                  styles.accountTypeBadgeText,
                  (accountType ?? userProfile.data?.accountType) === 'ORGANISATEUR'
                    ? styles.badgeTextOrganizer
                    : styles.badgeTextMember,
                ]}
              >
                {(accountType ?? userProfile.data?.accountType) === 'ORGANISATEUR'
                  ? t('profile.accountTypeBadgeOrganizer')
                  : t('profile.accountTypeBadgeMember')}
              </Text>
            </View>
            {(accountType ?? userProfile.data?.accountType) === 'MEMBRE' && (
              <Pressable
                onPress={handleUpgradePress}
                style={styles.upgradeButton}
              >
                <Ionicons name="arrow-up-circle-outline" size={22} color="#F5A623" />
                <Text style={styles.upgradeButtonText}>
                  {t('profile.upgradeButton')}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        <ProfileScoreCard
          userProfile={userProfile.data}
          scoreData={scoreData.data}
          isLoading={scoreData.isLoading}
          onImproveScorePress={handleImproveScorePress}
        />

        <ProfileStatsRow
          totalCotise={totalCotise}
          tontinesTerminees={tontinesCompleted.total}
          tontinesActives={tontinesActive.total}
          isLoading={tontinesActive.isLoading && tontinesCompleted.isLoading}
        />

        <ProfileSettings
          language={language}
          onLanguageChange={handleLanguageChange}
          notificationsEnabled={notificationsEnabled}
          onNotificationsChange={handleNotificationsChange}
          biometricsEnabled={biometricsEnabled}
          onBiometricsChange={handleBiometricsChange}
          onSecurityPress={handleSecurityPress}
        />

        <Pressable style={styles.pdfButton} onPress={handleDownloadPdf}>
          <Ionicons name="document-text-outline" size={22} color="#1A6B3C" />
          <Text style={styles.pdfButtonText}>{t('profile.downloadPdf')}</Text>
        </Pressable>

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#D0021B" />
          <Text style={styles.logoutButtonText}>{t('profile.logout')}</Text>
        </Pressable>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // 64 tab height + 20 margin + 16 safe area
  },
  kycBanner: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
  },
  kycBannerText: {
    fontSize: 14,
    color: '#D0021B',
    textAlign: 'center',
  },
  kycBannerCard: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  kycBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  kycBannerBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 24,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1A6B3C',
  },
  pdfButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A6B3C',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D0021B',
  },
  logoutButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#D0021B',
  },
  accountTypeSection: {
    marginHorizontal: 20,
    marginTop: 16,
    gap: 12,
  },
  accountTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeMember: {
    backgroundColor: '#1A6B3C',
  },
  badgeOrganizer: {
    backgroundColor: '#F5A623',
  },
  accountTypeBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  badgeTextMember: {
    color: '#FFFFFF',
  },
  badgeTextOrganizer: {
    color: '#1C1C1E',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F5A623',
    minHeight: 48,
  },
  upgradeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F5A623',
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
