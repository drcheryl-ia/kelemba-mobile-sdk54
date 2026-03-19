/**
 * Saisie invitation — coller un lien ou scanner un QR Code.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';

const UUID_REGEX =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Extrait l'UUID d'une URL ou d'une chaîne brute */
export function extractTontineUidFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(UUID_REGEX);
  return match ? match[0] : null;
}

export interface InvitationInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onScanned: (uid: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

export const InvitationInput: React.FC<InvitationInputProps> = ({
  value,
  onChangeText,
  onScanned,
  isLoading = false,
  error = null,
}) => {
  const { t } = useTranslation();
  const [showQrModal, setShowQrModal] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);

  const handleScanFromGallery = useCallback(async () => {
    setScanLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
      });
      if (result.canceled || !result.assets[0]?.uri) {
        setScanLoading(false);
        return;
      }
      const scanResults = await Camera.scanFromURLAsync(result.assets[0].uri, [
        'qr',
      ]);
      if (scanResults.length > 0 && scanResults[0].data) {
        const uid = extractTontineUidFromInput(scanResults[0].data);
        if (uid) {
          setShowQrModal(false);
          onChangeText(scanResults[0].data);
          onScanned(uid);
        } else {
          Alert.alert(
            t('common.error'),
            t('register.errorTontineNotFound')
          );
        }
      } else {
        Alert.alert(
          t('common.error'),
          t('register.errorTontineNotFound')
        );
      }
    } catch {
      Alert.alert(t('common.error'), t('register.errorNetwork'));
    } finally {
      setScanLoading(false);
    }
  }, [onChangeText, onScanned, t]);

  const handlePasteSubmit = useCallback(() => {
    const uid = extractTontineUidFromInput(value);
    if (uid) {
      onScanned(uid);
    }
  }, [value, onScanned]);

  const openQrModal = useCallback(() => {
    setShowQrModal(true);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('register.invitationPasteLabel')}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={t('register.invitationPastePlaceholder')}
          placeholderTextColor="#9CA3AF"
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          onPress={handlePasteSubmit}
          style={[styles.fetchButton, isLoading && styles.fetchButtonDisabled]}
          disabled={isLoading || !value.trim()}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="search" size={20} color="#FFFFFF" />
          )}
        </Pressable>
      </View>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>ou</Text>
        <View style={styles.dividerLine} />
      </View>

      <Pressable
        onPress={openQrModal}
        style={({ pressed }) => [styles.qrButton, pressed && styles.pressed]}
      >
        <Ionicons name="qr-code-outline" size={24} color="#1A6B3C" />
        <Text style={styles.qrButtonText}>{t('register.invitationScanQr')}</Text>
      </Pressable>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        visible={showQrModal}
        animationType="slide"
        onRequestClose={() => setShowQrModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowQrModal(false)} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.modalTitle}>{t('register.invitationScanQr')}</Text>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.modalBodyText}>
              {t('register.invitationScanFromGallery')}
            </Text>
            <Pressable
              onPress={handleScanFromGallery}
              style={[styles.scanButton, scanLoading && styles.scanButtonDisabled]}
              disabled={scanLoading}
            >
              {scanLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="image-outline" size={24} color="#FFFFFF" />
                  <Text style={styles.scanButtonText}>
                    {t('register.invitationScanQr')}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    minHeight: 56,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1E',
    paddingVertical: 12,
  },
  fetchButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1A6B3C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fetchButtonDisabled: {
    opacity: 0.6,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 14,
    color: '#9CA3AF',
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1A6B3C',
    minHeight: 48,
  },
  pressed: {
    opacity: 0.8,
  },
  qrButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A6B3C',
  },
  errorText: {
    fontSize: 13,
    color: '#D0021B',
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  closeButton: {
    padding: 8,
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalBody: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  modalBodyText: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    backgroundColor: '#1A6B3C',
    borderRadius: 12,
    minHeight: 48,
  },
  scanButtonDisabled: {
    opacity: 0.6,
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
