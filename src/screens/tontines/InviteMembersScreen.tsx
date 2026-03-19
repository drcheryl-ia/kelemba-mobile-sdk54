/**
 * Écran d'invitation de membres — lien/QR + invitation directe par téléphone.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Share,
  Linking,
  ActivityIndicator,
  Alert,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useInviteLink } from '@/hooks/useInviteLink';
import { useUserLookup } from '@/hooks/useUserLookup';
import { useSendInvitations } from '@/hooks/useSendInvitations';
import { parseApiError, getErrorMessageForCode } from '@/api/errors';
import { ApiErrorCode } from '@/api/errors/errorCodes';
import { logger } from '@/utils/logger';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import type { UserLookupResult } from '@/types/invite';

const PHONE_REGEX = /^\+236\d{8}$/;

type Props = NativeStackScreenProps<RootStackParamList, 'InviteMembers'>;

export const InviteMembersScreen: React.FC<Props> = ({ route }) => {
  const { tontineUid, tontineName = '' } = route.params;
  const { t, i18n } = useTranslation();
  const { data: inviteLinkData, isLoading } = useInviteLink(tontineUid);

  const [phoneInput, setPhoneInput] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const {
    user: lookedUpUser,
    isLoading: lookupLoading,
    isError: lookupError,
    isNotFound: lookupNotFound,
    error: lookupErrorObj,
  } = useUserLookup(searchPhone);

  const sendInvitations = useSendInvitations({
    tontineUid,
    onSuccess: () => {
      setSearchPhone('');
      setPhoneInput('');
    },
  });

  const qrRef = useRef<React.ElementRef<typeof ViewShot> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const isValidPhone = PHONE_REGEX.test(phoneInput.trim());
  const hasSearched = searchPhone.length > 0;
  const showLookupResult = hasSearched && !lookupLoading;
  const showLookupEmpty = hasSearched && !lookupLoading && lookupNotFound;
  const lookupErrorMessage =
    lookupError && lookupErrorObj
      ? getErrorMessageForCode(
          parseApiError(lookupErrorObj),
          i18n.language === 'sango' ? 'sango' : 'fr'
        )
      : null;

  const handleSearch = useCallback(() => {
    const trimmed = phoneInput.trim();
    if (!trimmed) return;
    if (!PHONE_REGEX.test(trimmed)) {
      return;
    }
    setSearchPhone(trimmed);
  }, [phoneInput]);

  const handleInviteUser = useCallback(
    (_u: UserLookupResult) => {
      sendInvitations.mutate(
        {
          phone: searchPhone,
          sharesCount: 1,
        },
        {
          onSuccess: () => {
            Alert.alert(
              t('inviteMembers.invitationSentTitle', 'Invitation envoyée'),
              t(
                'inviteMembers.invitationSentMessage',
                "Invitation envoyée. Le membre doit encore l'accepter pour rejoindre la tontine."
              )
            );
          },
          onError: (err: Error) => {
            const apiErr = parseApiError(err);
            const msg = getErrorMessageForCode(apiErr, i18n.language === 'sango' ? 'sango' : 'fr');
            if (apiErr.code === ApiErrorCode.ALREADY_MEMBER) {
              Alert.alert(
                t('inviteMembers.errorAlreadyMemberTitle', 'Déjà membre'),
                msg
              );
            } else if (apiErr.code === ApiErrorCode.INVITATION_ALREADY_PENDING) {
              Alert.alert(
                t('inviteMembers.errorPendingTitle', 'Invitation en attente'),
                msg
              );
            } else if (apiErr.code === ApiErrorCode.CANDIDATE_KYC_NOT_VERIFIED) {
              Alert.alert(
                t('inviteMembers.errorKycTitle', 'KYC requis'),
                msg
              );
            } else if (apiErr.code === ApiErrorCode.TONTINE_FULL) {
              Alert.alert(
                t('inviteMembers.errorFullTitle', 'Tontine pleine'),
                msg
              );
            } else if (apiErr.code === ApiErrorCode.INVALID_PHONE_FORMAT) {
              Alert.alert(
                t('inviteMembers.phoneFormatHint', 'Format invalide'),
                msg
              );
            } else {
              Alert.alert(t('common.error'), msg);
            }
          },
        }
      );
    },
    [sendInvitations, t, i18n, searchPhone]
  );

  const handleCopy = useCallback(async () => {
    if (!inviteLinkData?.inviteUrl) return;
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(inviteLinkData.inviteUrl);
      Alert.alert('', t('inviteMembers.copySuccess'));
    } catch {
      logger.error('[InviteMembers] Clipboard failed');
      Share.share({
        message: inviteLinkData.inviteUrl,
        title: tontineName,
      });
    }
  }, [inviteLinkData, tontineName, t]);

  const handleDownloadQr = useCallback(async () => {
    if (!inviteLinkData?.inviteUrl || isSaving) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission requise',
          "Veuillez autoriser l'accès à votre galerie dans les paramètres.",
          [{ text: 'OK' }]
        );
        return;
      }

      const uri = await captureRef(qrRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      const asset = await MediaLibrary.createAssetAsync(uri);
      await MediaLibrary.createAlbumAsync('Kelemba', asset, false);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('[InviteMembers] handleDownloadQr failed', { message });
      Alert.alert(
        'Erreur',
        "Impossible d'enregistrer le QR code. Réessayez."
      );
    } finally {
      setIsSaving(false);
    }
  }, [inviteLinkData, isSaving]);

  const handleWhatsApp = useCallback(() => {
    if (!inviteLinkData?.inviteUrl) return;
    const message = `Rejoignez ma tontine "${tontineName}" sur Kelemba :\n${inviteLinkData.inviteUrl}`;
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}`).catch(() =>
      Share.share({ message, title: tontineName })
    );
  }, [inviteLinkData, tontineName]);

  const handleSms = useCallback(() => {
    if (!inviteLinkData?.inviteUrl) return;
    const message = `Rejoignez ma tontine "${tontineName}" sur Kelemba :\n${inviteLinkData.inviteUrl}`;
    Linking.openURL(`sms:?body=${encodeURIComponent(message)}`).catch(() =>
      Share.share({ message, title: tontineName })
    );
  }, [inviteLinkData, tontineName]);

  const handleShare = useCallback(() => {
    if (!inviteLinkData?.inviteUrl) return;
    const message = `Rejoignez ma tontine "${tontineName}" sur Kelemba :\n${inviteLinkData.inviteUrl}`;
    Share.share({ message, title: tontineName });
  }, [inviteLinkData, tontineName]);

  const truncatedUrl = inviteLinkData?.inviteUrl
    ? inviteLinkData.inviteUrl.length > 40
      ? inviteLinkData.inviteUrl.slice(0, 38) + '…'
      : inviteLinkData.inviteUrl
    : '';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.tontineName}>{tontineName}</Text>
          <Text style={styles.subtitle}>{t('inviteMembers.shareSubtitle')}</Text>
        </View>

        {/* ── Bloc B : Invitation directe par téléphone ── */}
        <View style={styles.phoneSection}>
          <Text style={styles.sectionTitle}>
            {t('inviteMembers.phoneSection', 'Invitation directe par téléphone')}
          </Text>
          <View style={styles.phoneRow}>
            <TextInput
              style={[
                styles.phoneInput,
                !isValidPhone && phoneInput.length > 0 && styles.phoneInputError,
              ]}
              placeholder={t('inviteMembers.phonePlaceholder', '+236 XX XX XX XX')}
              placeholderTextColor="#9CA3AF"
              value={phoneInput}
              onChangeText={(v) => {
                setPhoneInput(v);
                setSearchPhone('');
              }}
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={14}
              editable={!sendInvitations.isPending}
              accessibilityLabel={t('inviteMembers.phonePlaceholder')}
            />
            <Pressable
              style={[
                styles.searchBtn,
                (!isValidPhone || lookupLoading) && styles.searchBtnDisabled,
              ]}
              onPress={handleSearch}
              disabled={!isValidPhone || lookupLoading}
              accessibilityRole="button"
              accessibilityLabel={t('inviteMembers.search', 'Rechercher')}
            >
              {lookupLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.searchBtnText}>
                  {t('inviteMembers.search', 'Rechercher')}
                </Text>
              )}
            </Pressable>
          </View>
          {phoneInput.length > 0 && !isValidPhone && (
            <Text style={styles.phoneHint}>
              {t('inviteMembers.phoneFormatHint', 'Format : +236 suivi de 8 chiffres')}
            </Text>
          )}

          {showLookupEmpty && (
            <View style={styles.lookupEmpty}>
              <Ionicons name="person-outline" size={32} color="#9CA3AF" />
              <Text style={styles.lookupEmptyText}>
                {t('inviteMembers.notOnKelemba', "Cette personne n'est pas inscrite sur Kelemba")}
              </Text>
              <Text style={styles.lookupEmptySub}>
                {t('inviteMembers.shareLinkHint', 'Partagez le lien ou le QR Code ci-dessous.')}
              </Text>
            </View>
          )}

          {lookupError && !lookupNotFound && lookupErrorMessage && (
            <View style={styles.lookupError}>
              <Ionicons name="alert-circle-outline" size={24} color="#D0021B" />
              <Text style={styles.lookupErrorText}>{lookupErrorMessage}</Text>
            </View>
          )}

          {showLookupResult && lookedUpUser && (
            <View style={styles.userCard}>
              <View style={styles.userCardHeader}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {typeof lookedUpUser.fullName === 'string' && lookedUpUser.fullName.length > 0
                      ? lookedUpUser.fullName.charAt(0).toUpperCase()
                      : '?'}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>
                    {typeof lookedUpUser.fullName === 'string' ? lookedUpUser.fullName : '—'}
                  </Text>
                  <Text style={styles.userPhone}>
                    {typeof lookedUpUser.phoneMasked === 'string'
                      ? lookedUpUser.phoneMasked
                      : t('inviteMembers.phoneUnavailable', 'Numéro indisponible')}
                  </Text>
                </View>
              </View>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>
                  {t('inviteMembers.scoreKelemba', 'Score Kelemba')}
                </Text>
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreValue}>
                    {typeof lookedUpUser.kelembScore === 'number'
                      ? lookedUpUser.kelembScore
                      : 0}
                  </Text>
                </View>
              </View>
              {lookedUpUser.kycStatus && (
                <View style={styles.kycBadge}>
                  <Ionicons
                    name={
                      lookedUpUser.kycStatus === 'VERIFIED'
                        ? 'checkmark-circle'
                        : 'time-outline'
                    }
                    size={14}
                    color={lookedUpUser.kycStatus === 'VERIFIED' ? '#1A6B3C' : '#F5A623'}
                  />
                  <Text style={styles.kycBadgeText}>
                    {lookedUpUser.kycStatus === 'VERIFIED'
                      ? t('inviteMembers.kycVerified', 'KYC vérifié')
                      : t('inviteMembers.kycPending', 'KYC en attente')}
                  </Text>
                </View>
              )}
              <Pressable
                style={[
                  styles.inviteBtn,
                  sendInvitations.isPending && styles.inviteBtnDisabled,
                ]}
                onPress={() => handleInviteUser(lookedUpUser)}
                disabled={sendInvitations.isPending}
                accessibilityRole="button"
                accessibilityLabel={t('inviteMembers.inviteButton', 'Inviter')}
              >
                {sendInvitations.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="person-add" size={18} color="#FFFFFF" />
                    <Text style={styles.inviteBtnText}>
                      {t('inviteMembers.inviteButton', 'Inviter')}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
        </View>

        {/* ── Bloc A : Lien / QR ── */}
        <Text style={styles.sectionTitle}>
          {t('inviteMembers.linkSection', "Lien d'invitation")}
        </Text>
        <View style={styles.qrCard}>
          {isLoading ? (
            <View style={styles.qrPlaceholder}>
              <ActivityIndicator size="large" color="#1A6B3C" />
            </View>
          ) : inviteLinkData?.inviteUrl ? (
            <>
              <ViewShot
                ref={qrRef}
                options={{ format: 'png', quality: 1 }}
                style={styles.qrWrapper}
              >
                <QRCode
                  value={inviteLinkData.inviteUrl}
                  size={200}
                  color="#1A6B3C"
                  backgroundColor="#FFFFFF"
                />
              </ViewShot>
              <Text style={styles.qrHint}>{t('inviteMembers.qrHint')}</Text>

              <Pressable
                style={[
                  styles.downloadBtn,
                  isSaving && styles.downloadBtnDisabled,
                  saveSuccess && styles.downloadBtnSuccess,
                ]}
                onPress={handleDownloadQr}
                disabled={isSaving}
                accessibilityRole="button"
                accessibilityLabel="Télécharger le QR code"
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : saveSuccess ? (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.downloadBtnText}>
                      Enregistré dans la galerie !
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="download-outline" size={18} color="#1A6B3C" />
                    <Text style={styles.downloadBtnTextDefault}>
                      Télécharger le QR Code
                    </Text>
                  </>
                )}
              </Pressable>
            </>
          ) : (
            <View style={styles.qrPlaceholder}>
              <Ionicons name="alert-circle-outline" size={36} color="#D0021B" />
              <Text style={styles.qrError}>{t('inviteMembers.linkError')}</Text>
            </View>
          )}
        </View>

        {inviteLinkData?.inviteUrl ? (
          <View style={styles.linkRow}>
            <Text style={styles.linkText} numberOfLines={1}>
              {truncatedUrl}
            </Text>
            <Pressable
              style={styles.copyBtn}
              onPress={handleCopy}
              accessibilityRole="button"
              accessibilityLabel={t('inviteMembers.copyButton')}
            >
              <Ionicons name="copy-outline" size={18} color="#1A6B3C" />
              <Text style={styles.copyBtnText}>{t('inviteMembers.copyButton')}</Text>
            </Pressable>
          </View>
        ) : null}

        {inviteLinkData?.inviteUrl ? (
          <View style={styles.shareSection}>
            <Text style={styles.shareSectionTitle}>{t('inviteMembers.shareSectionTitle')}</Text>
            <View style={styles.shareRow}>
              <Pressable
                style={styles.shareBtn}
                onPress={handleWhatsApp}
                accessibilityRole="button"
                accessibilityLabel={t('inviteMembers.shareWhatsApp')}
              >
                <View style={[styles.shareBtnIcon, { backgroundColor: '#E8F8EE' }]}>
                  <Ionicons name="logo-whatsapp" size={26} color="#25D366" />
                </View>
                <Text style={styles.shareBtnLabel}>{t('inviteMembers.shareWhatsApp')}</Text>
              </Pressable>
              <Pressable
                style={styles.shareBtn}
                onPress={handleSms}
                accessibilityRole="button"
                accessibilityLabel={t('inviteMembers.shareSms')}
              >
                <View style={[styles.shareBtnIcon, { backgroundColor: '#EBF2FF' }]}>
                  <Ionicons name="chatbubble-outline" size={26} color="#0055A5" />
                </View>
                <Text style={styles.shareBtnLabel}>{t('inviteMembers.shareSms')}</Text>
              </Pressable>
              <Pressable
                style={styles.shareBtn}
                onPress={handleShare}
                accessibilityRole="button"
                accessibilityLabel={t('inviteMembers.shareOthers')}
              >
                <View style={[styles.shareBtnIcon, { backgroundColor: '#F5F5F5' }]}>
                  <Ionicons name="share-social-outline" size={26} color="#555555" />
                </View>
                <Text style={styles.shareBtnLabel}>{t('inviteMembers.shareOthers')}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 20,
  },
  header: {
    gap: 6,
  },
  tontineName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  phoneSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
    gap: 12,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  phoneInput: {
    flex: 1,
    height: 44,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#1A1A2E',
  },
  phoneInputError: {
    borderColor: '#D0021B',
  },
  phoneHint: {
    fontSize: 12,
    color: '#D0021B',
  },
  searchBtn: {
    paddingHorizontal: 18,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A6B3C',
    borderRadius: 10,
    minWidth: 100,
  },
  searchBtnDisabled: {
    opacity: 0.5,
  },
  searchBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  lookupEmpty: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  lookupEmptyText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
  },
  lookupEmptySub: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  lookupError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
  },
  lookupErrorText: {
    fontSize: 14,
    color: '#D0021B',
    flex: 1,
  },
  userCard: {
    backgroundColor: '#F0F9F4',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#C8E6C9',
    gap: 12,
  },
  userCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A6B3C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  userPhone: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  scoreBadge: {
    backgroundColor: '#1A6B3C',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  kycBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kycBadgeText: {
    fontSize: 13,
    color: '#6B7280',
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#1A6B3C',
    borderRadius: 10,
  },
  inviteBtnDisabled: {
    opacity: 0.7,
  },
  inviteBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  qrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
    gap: 16,
  },
  qrWrapper: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  qrHint: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },
  qrPlaceholder: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  qrError: {
    fontSize: 14,
    color: '#D0021B',
    textAlign: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  linkText: {
    flex: 1,
    fontSize: 13,
    color: '#444',
    fontFamily: 'monospace',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#EAF3EC',
    borderRadius: 8,
    minHeight: 36,
  },
  copyBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A6B3C',
  },
  shareSection: {
    gap: 14,
  },
  shareSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  shareRow: {
    flexDirection: 'row',
    gap: 16,
  },
  shareBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  shareBtnIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnLabel: {
    fontSize: 12,
    color: '#444',
    fontWeight: '500',
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#1A6B3C',
    backgroundColor: '#F0F9F4',
    minHeight: 44,
    alignSelf: 'center',
    minWidth: 220,
  },
  downloadBtnDisabled: {
    opacity: 0.6,
  },
  downloadBtnSuccess: {
    backgroundColor: '#1A6B3C',
    borderColor: '#1A6B3C',
  },
  downloadBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  downloadBtnTextDefault: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A6B3C',
  },
});
