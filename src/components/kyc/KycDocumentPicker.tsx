import React from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ErrorBanner } from '@/components/ui';
import type { KycDocument } from '@/types/kyc.types';
import { logger } from '@/utils/logger';
import { formatKycFileSize } from '@/utils/kyc';
import { KycImageError, normalizeKycImage } from '@/utils/kycImage';

export interface KycDocumentPickerProps {
  step: 'front' | 'back';
  label: string;
  hint?: string;
  document: KycDocument | null;
  errorMessage?: string;
  disabled?: boolean;
  onDocumentChange: (doc: KycDocument | null) => void;
}

export const KycDocumentPicker: React.FC<KycDocumentPickerProps> = ({
  step,
  label,
  hint,
  document,
  errorMessage,
  disabled = false,
  onDocumentChange,
}) => {
  const handleImageError = (err: unknown) => {
    if (err instanceof KycImageError) {
      if (err.code === 'INVALID_MIME') {
        Alert.alert('Erreur', "Le fichier sélectionné n'est pas une image valide.");
        return;
      }
      if (err.code === 'FILE_TOO_LARGE') {
        Alert.alert('Erreur', 'Le fichier est trop volumineux.');
        return;
      }
    }

    logger.error('[KYC] KycDocumentPicker: image normalization failed', {
      message: err instanceof Error ? err.message : String(err),
      step,
    });
    Alert.alert('Erreur', 'Impossible de lire cette image. Choisissez une autre photo.');
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission requise',
          "Veuillez autoriser l'accès à la caméra dans les paramètres de votre appareil.",
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.9,
      });

      if (result.canceled || !result.assets[0]) return;

      const documentToUpload = await normalizeKycImage({
        step,
        uri: result.assets[0].uri,
        mimeType: result.assets[0].mimeType,
        fileName: result.assets[0].fileName,
        fileSize: result.assets[0].fileSize ?? null,
      });

      onDocumentChange(documentToUpload);
    } catch (err: unknown) {
      handleImageError(err);
    }
  };

  const pickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission requise',
          "Veuillez autoriser l'accès à vos photos dans les paramètres de votre appareil.",
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.9,
      });

      if (result.canceled || !result.assets[0]) return;

      const documentToUpload = await normalizeKycImage({
        step,
        uri: result.assets[0].uri,
        mimeType: result.assets[0].mimeType,
        fileName: result.assets[0].fileName,
        fileSize: result.assets[0].fileSize ?? null,
      });

      onDocumentChange(documentToUpload);
    } catch (err: unknown) {
      handleImageError(err);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {errorMessage ? <ErrorBanner message={errorMessage} /> : null}

      {document ? (
        <View style={styles.previewCard}>
          <Image source={{ uri: document.uri }} style={styles.preview} />
          <View style={styles.previewContent}>
            <Text style={styles.previewTitle}>{"Image prête pour l'envoi"}</Text>
            <Text style={styles.previewMeta}>{formatKycFileSize(document.fileSize)}</Text>
            <View style={styles.previewActions}>
              <Pressable
                style={styles.retakeButton}
                onPress={takePhoto}
                disabled={disabled}
              >
                <Text style={styles.retakeText}>Remplacer</Text>
              </Pressable>
              <Pressable
                style={styles.removeButton}
                onPress={() => onDocumentChange(null)}
                disabled={disabled}
              >
                <Text style={styles.removeText}>Supprimer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.buttonsColumn}>
        <Pressable
          style={[styles.button, disabled && styles.buttonDisabled]}
          onPress={takePhoto}
          disabled={disabled}
        >
          <Ionicons name="camera-outline" size={24} color="#1A6B3C" />
          <Text style={styles.buttonText}>
            {document ? 'Prendre une autre photo' : 'Prendre en photo'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.button, disabled && styles.buttonDisabled]}
          onPress={pickFromGallery}
          disabled={disabled}
        >
          <Ionicons name="images-outline" size={24} color="#1A6B3C" />
          <Text style={styles.buttonText}>Choisir dans la galerie</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 6,
  },
  hint: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  preview: {
    width: 120,
    height: 160,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  previewContent: {
    flex: 1,
    gap: 10,
    paddingTop: 4,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  previewMeta: {
    fontSize: 13,
    color: '#6B7280',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  retakeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  retakeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A6B3C',
  },
  removeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  removeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D0021B',
  },
  buttonsColumn: {
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1A6B3C',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A6B3C',
  },
});
