/**
 * CashProofScreen — le membre fournit la preuve du paiement en espèces.
 * Affiché après "Confirmer" sur PaymentScreen (mode CASH).
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { uploadReceiptPhoto, submitCashProof } from '@/api/cashPaymentApi';
import { parseApiError } from '@/api/errors/errorHandler';
import { formatFcfa } from '@/utils/formatters';
import { logger } from '@/utils/logger';

type Props = NativeStackScreenProps<RootStackParamList, 'CashProofScreen'>;

export const CashProofScreen: React.FC<Props> = ({ navigation, route }) => {
  const { paymentUid, tontineUid, tontineName, amount } = route.params;
  const queryClient = useQueryClient();

  const [receiverName, setReceiverName] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePickPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', "Autorisez l'accès à vos photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPhotoUri(asset.uri);
      setIsUploading(true);
      try {
        const { url } = await uploadReceiptPhoto(
          asset.uri,
          asset.mimeType ?? 'image/jpeg'
        );
        setPhotoUrl(url);
      } catch (err: unknown) {
        logger.error('[CashProof] upload failed', { code: parseApiError(err).code });
        Alert.alert('Erreur', "Impossible d'envoyer la photo. Réessayez.");
        setPhotoUri(null);
      } finally {
        setIsUploading(false);
      }
    }
  }, []);

  const handleTakePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', "Autorisez l'accès à l'appareil photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPhotoUri(asset.uri);
      setIsUploading(true);
      try {
        const { url } = await uploadReceiptPhoto(
          asset.uri,
          asset.mimeType ?? 'image/jpeg'
        );
        setPhotoUrl(url);
      } catch (err: unknown) {
        logger.error('[CashProof] upload failed', { code: parseApiError(err).code });
        Alert.alert('Erreur', "Impossible d'envoyer la photo. Réessayez.");
        setPhotoUri(null);
      } finally {
        setIsUploading(false);
      }
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!receiverName.trim()) {
      Alert.alert(
        'Champ requis',
        'Indiquez le nom de la personne qui a reçu les espèces.'
      );
      return;
    }
    if (!photoUrl) {
      Alert.alert('Photo requise', 'Veuillez fournir une photo du reçu ou de la remise.');
      return;
    }
    setIsSubmitting(true);
    try {
      await submitCashProof(paymentUid, {
        receiptPhotoUrl: photoUrl,
        receiverName: receiverName.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ['cycle', 'current', tontineUid] });
      queryClient.invalidateQueries({ queryKey: ['tontines'] });
      queryClient.invalidateQueries({ queryKey: ['cash-pending', tontineUid] });
      queryClient.invalidateQueries({ queryKey: ['members', tontineUid] });
      Alert.alert('Preuve soumise ✓', "L'organisateur a été notifié et va valider votre paiement.", [
        { text: 'OK', onPress: () => navigation.popToTop() },
      ]);
    } catch (err: unknown) {
      logger.error('[CashProof] submit failed', { code: parseApiError(err).code });
      Alert.alert('Erreur', 'Impossible de soumettre la preuve. Réessayez.');
    } finally {
      setIsSubmitting(false);
    }
  }, [receiverName, photoUrl, paymentUid, tontineUid, queryClient, navigation]);

  const canSubmit =
    receiverName.trim().length >= 2 && !!photoUrl && !isUploading && !isSubmitting;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
        </Pressable>
        <Text style={s.headerTitle}>Preuve de paiement</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.amountCard}>
          <Ionicons name="cash-outline" size={28} color="#1A6B3C" />
          <View style={{ flex: 1 }}>
            <Text style={s.amountLabel}>Paiement en espèces déclaré</Text>
            <Text style={s.amountValue}>{formatFcfa(amount)}</Text>
            <Text style={s.amountSub}>{tontineName}</Text>
          </View>
          <View style={s.pendingBadge}>
            <Text style={s.pendingBadgeText}>En attente</Text>
          </View>
        </View>

        <View style={s.infoBlock}>
          <Ionicons name="information-circle-outline" size={16} color="#0055A5" />
          <Text style={s.infoText}>
            Fournissez une photo du reçu ou de la remise en main propre. L'organisateur
            validera votre paiement.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>Nom de la personne qui a reçu les espèces *</Text>
          <TextInput
            style={s.input}
            placeholder="Ex : Jean-Baptiste Moyen"
            placeholderTextColor="#9CA3AF"
            value={receiverName}
            onChangeText={setReceiverName}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={150}
          />
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>Photo du reçu ou de la remise *</Text>

          {photoUri ? (
            <View style={s.photoPreview}>
              <Image source={{ uri: photoUri }} style={s.photoImage} resizeMode="cover" />
              {isUploading && (
                <View style={s.photoOverlay}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                  <Text style={s.uploadingText}>Envoi en cours…</Text>
                </View>
              )}
              {!isUploading && (
                <Pressable style={s.changePhotoBtn} onPress={handlePickPhoto}>
                  <Ionicons name="refresh-outline" size={16} color="#1A6B3C" />
                  <Text style={s.changePhotoText}>Changer</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={s.photoButtons}>
              <Pressable style={s.photoBtn} onPress={handleTakePhoto}>
                <Ionicons name="camera-outline" size={24} color="#1A6B3C" />
                <Text style={s.photoBtnText}>Prendre une photo</Text>
              </Pressable>
              <Pressable style={s.photoBtn} onPress={handlePickPhoto}>
                <Ionicons name="image-outline" size={24} color="#1A6B3C" />
                <Text style={s.photoBtnText}>Galerie</Text>
              </Pressable>
            </View>
          )}
        </View>

        <Pressable
          style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
              <Text style={s.submitBtnText}>Soumettre la preuve</Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={s.skipBtn}
          onPress={() => navigation.popToTop()}
          accessibilityRole="button"
        >
          <Text style={s.skipBtnText}>Soumettre plus tard</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  content: { padding: 20, gap: 20, paddingBottom: 48 },
  amountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#C6E6D4',
  },
  amountLabel: { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  amountValue: { fontSize: 20, fontWeight: '800', color: '#1A6B3C' },
  amountSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pendingBadgeText: { fontSize: 11, fontWeight: '700', color: '#92400E' },
  infoBlock: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 14,
  },
  infoText: { flex: 1, fontSize: 13, color: '#1E40AF', lineHeight: 18 },
  section: { gap: 10 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1A1A2E',
  },
  photoButtons: { flexDirection: 'row', gap: 12 },
  photoBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#C6E6D4',
    paddingVertical: 20,
    minHeight: 90,
  },
  photoBtnText: { fontSize: 13, fontWeight: '600', color: '#1A6B3C' },
  photoPreview: { borderRadius: 14, overflow: 'hidden', height: 200, position: 'relative' },
  photoImage: { width: '100%', height: '100%' },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  uploadingText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  changePhotoBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  changePhotoText: { fontSize: 13, fontWeight: '600', color: '#1A6B3C' },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1A6B3C',
    borderRadius: 14,
    paddingVertical: 16,
    minHeight: 56,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  skipBtn: { alignItems: 'center', paddingVertical: 12 },
  skipBtnText: { fontSize: 14, color: '#9CA3AF' },
});
