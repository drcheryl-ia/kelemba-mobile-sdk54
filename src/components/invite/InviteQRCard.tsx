/**
 * Carte QR Code — lien d'invitation, copier, partager QR, partager WhatsApp/SMS.
 */
import React, { useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Share,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { logger } from '@/utils/logger';

export interface InviteQRCardProps {
  inviteUrl: string;
  expiresAt: string;
  tontineName?: string;
}

export const InviteQRCard: React.FC<InviteQRCardProps> = ({
  inviteUrl,
  expiresAt,
  tontineName,
}) => {
  const { t } = useTranslation();
  const qrRef = useRef<InstanceType<typeof QRCode>>(null);

  const handleCopy = async () => {
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(inviteUrl);
      Alert.alert(t('common.success'), t('inviteMembers.copy'));
    } catch {
      Share.share({ message: inviteUrl, title: t('inviteMembers.linkSection') });
    }
  };

  const handleShareQr = async () => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert(t('common.error'), t('inviteMembers.shareNotAvailable'));
        return;
      }
      qrRef.current?.toDataURL((dataUrl: string) => {
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
        const fileUri = `${FileSystem.cacheDirectory}kelemba-invitation-qr.png`;
        FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        })
          .then(() =>
            Sharing.shareAsync(fileUri, {
              mimeType: 'image/png',
              dialogTitle: t('inviteMembers.shareQrDialogTitle'),
              UTI: 'public.png',
            })
          )
          .catch((err) => {
            logger.error('InviteQRCard shareQr failed', err);
            Alert.alert(t('common.error'), t('inviteMembers.shareQrError'));
          });
      });
    } catch (err) {
      logger.error('InviteQRCard shareQr failed', err);
      Alert.alert(t('common.error'), t('inviteMembers.shareNotAvailable'));
    }
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      tontineName
        ? `${t('inviteMembers.linkSection')} "${tontineName}" : ${inviteUrl}`
        : inviteUrl
    );
    const url = `https://wa.me/?text=${text}`;
    Linking.openURL(url).catch(() => Share.share({ message: inviteUrl }));
  };

  const handleShareSms = () => {
    const url = Platform.select({
      ios: `sms:?body=${encodeURIComponent(inviteUrl)}`,
      android: `sms:?body=${encodeURIComponent(inviteUrl)}`,
      default: `sms:?body=${encodeURIComponent(inviteUrl)}`,
    });
    Linking.openURL(url ?? `sms:?body=${encodeURIComponent(inviteUrl)}`).catch(() =>
      Share.share({ message: inviteUrl })
    );
  };

  const formatExpiry = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{t('inviteMembers.linkSection')}</Text>
      {tontineName && (
        <Text style={styles.tontineName} numberOfLines={1}>
          {tontineName}
        </Text>
      )}
      <View style={styles.qrWrapper}>
        <QRCode
          ref={qrRef}
          value={inviteUrl}
          size={180}
          color="#1A6B3C"
          backgroundColor="#FFFFFF"
        />
      </View>
      <Text style={styles.expires}>
        {t('inviteMembers.expiresAt')} : {formatExpiry(expiresAt)}
      </Text>
      <View style={styles.buttons}>
        <Pressable style={styles.btn} onPress={handleCopy}>
          <Ionicons name="copy-outline" size={20} color="#1A6B3C" />
          <Text style={styles.btnText}>{t('inviteMembers.copy')}</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={handleShareQr}>
          <Ionicons name="share-outline" size={20} color="#1A6B3C" />
          <Text style={styles.btnText}>{t('inviteMembers.shareQrCode')}</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={handleShareWhatsApp}>
          <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
          <Text style={styles.btnText}>{t('inviteMembers.shareWhatsApp')}</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={handleShareSms}>
          <Ionicons name="chatbubble-outline" size={20} color="#1A6B3C" />
          <Text style={styles.btnText}>{t('inviteMembers.shareSms')}</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  tontineName: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
  },
  expires: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 16,
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A6B3C',
  },
});
