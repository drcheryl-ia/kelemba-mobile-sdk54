import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { ErrorBanner } from '@/components/ui';
import type { KycDocument } from '@/types/kyc.types';
import { logger } from '@/utils/logger';
import { formatKycFileSize } from '@/utils/kyc';
import { KycImageError, normalizeKycImage } from '@/utils/kycImage';

export interface KycSelfieCameraProps {
  document: KycDocument | null;
  errorMessage?: string;
  disabled?: boolean;
  onDocumentChange: (doc: KycDocument | null) => void;
}

export const KycSelfieCamera: React.FC<KycSelfieCameraProps> = ({
  document,
  errorMessage,
  disabled = false,
  onDocumentChange,
}) => {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [isPicking, setIsPicking] = useState(false);

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

    logger.error('[KYC] KycSelfieCamera: image preparation failed', {
      message: err instanceof Error ? err.message : String(err),
    });
    Alert.alert('Erreur', 'Impossible de préparer cette photo. Veuillez réessayer.');
  };

  const pickFromGallery = async () => {
    try {
      setIsPicking(true);
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission requise',
          "Veuillez autoriser l'accès à vos photos dans les paramètres de votre appareil."
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
        step: 'selfie',
        uri: result.assets[0].uri,
        mimeType: result.assets[0].mimeType,
        fileName: result.assets[0].fileName,
        fileSize: result.assets[0].fileSize ?? null,
      });

      onDocumentChange(documentToUpload);
    } catch (err: unknown) {
      handleImageError(err);
    } finally {
      setIsPicking(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator size="small" color="#1A6B3C" />
        <Text style={styles.placeholderText}>Chargement des permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Nous avons besoin de votre permission pour accéder à la caméra.
          </Text>
          <Pressable
            style={styles.permissionButton}
            onPress={requestPermission}
            disabled={disabled}
          >
            <Text style={styles.permissionButtonText}>Autoriser</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={pickFromGallery}
            disabled={disabled || isPicking}
          >
            <Text style={styles.secondaryButtonText}>Choisir dans la galerie</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current || !cameraReady || disabled) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
      });

      if (!photo?.uri) return;

      const documentToUpload = await normalizeKycImage({
        step: 'selfie',
        uri: photo.uri,
        mimeType: 'image/jpeg',
        fileName: 'selfie.jpg',
      });

      onDocumentChange(documentToUpload);
    } catch (err: unknown) {
      handleImageError(err);
    }
  };

  if (document) {
    return (
      <View style={styles.container}>
        {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
        <View style={styles.previewCard}>
          <Image source={{ uri: document.uri }} style={styles.preview} />
          <View style={styles.previewContent}>
            <Text style={styles.previewTitle}>{"Selfie prêt pour l'envoi"}</Text>
            <Text style={styles.previewMeta}>{formatKycFileSize(document.fileSize)}</Text>
            <View style={styles.previewActions}>
              <Pressable
                style={styles.retakeButton}
                onPress={() => onDocumentChange(null)}
                disabled={disabled}
              >
                <Text style={styles.retakeText}>Reprendre</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryButton}
                onPress={pickFromGallery}
                disabled={disabled || isPicking}
              >
                <Text style={styles.secondaryButtonText}>Galerie</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    );
  }

  const { width } = Dimensions.get('window');
  const size = Math.min(width - 40, 320);

  return (
    <View style={styles.container}>
      {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
      <View style={styles.cameraWrapper}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
          onCameraReady={() => setCameraReady(true)}
        />
        <View style={styles.overlay} pointerEvents="none">
          <View style={[styles.ellipse, { width: size, height: size * 1.2 }]} />
          <Text style={styles.overlayText}>
            Centrez votre visage dans le cadre
          </Text>
        </View>
        <Pressable
          style={[
            styles.captureButton,
            (!cameraReady || disabled) && styles.captureButtonDisabled,
          ]}
          onPress={handleCapture}
          disabled={!cameraReady || disabled}
        />
      </View>
      <View style={styles.actionsRow}>
        <Pressable
          style={[
            styles.secondaryButton,
            (disabled || isPicking) && styles.secondaryButtonDisabled,
          ]}
          onPress={pickFromGallery}
          disabled={disabled || isPicking}
        >
          <Text style={styles.secondaryButtonText}>Choisir dans la galerie</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  placeholder: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 20,
  },
  placeholderText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  permissionButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#1A6B3C',
    borderRadius: 8,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  container: {
    marginVertical: 16,
    gap: 12,
  },
  previewCard: {
    flexDirection: 'row',
    gap: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  preview: {
    width: 160,
    height: 200,
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
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  retakeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A6B3C',
  },
  cameraWrapper: {
    height: 400,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ellipse: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  overlayText: {
    position: 'absolute',
    bottom: 80,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  captureButton: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    borderColor: '#1A6B3C',
  },
  captureButtonDisabled: {
    opacity: 0.6,
  },
  actionsRow: {
    gap: 12,
  },
  secondaryButton: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  secondaryButtonDisabled: {
    opacity: 0.6,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A2E',
  },
});
