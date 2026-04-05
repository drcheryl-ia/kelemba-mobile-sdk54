import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/navigation/types';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';
import { getTontinePreview } from '@/api/tontinesApi';
import { ApiError } from '@/api/errors/ApiError';
import { extractTontineUid } from '@/utils/extractTontineUid';
import { formatFcfa } from '@/utils/formatters';
import { frequencyReadable } from '@/utils/tontineFrequencyShort';
import { logger } from '@/utils/logger';
import type { TontinePreviewDto } from '@/types/tontine.types';

type Props = NativeStackScreenProps<AuthStackParamList, 'JoinTontine'>;

function IconLink(): React.ReactElement {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
        stroke={COLORS.gray500}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
        stroke={COLORS.gray500}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconQr(): React.ReactElement {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"
        stroke={COLORS.primary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7 12h.01M12 12h.01M17 12h.01M7 16h.01M12 16h.01M17 16h.01"
        stroke={COLORS.primary}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function IconCheck(): React.ReactElement {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 6L9 17l-5-5"
        stroke={COLORS.white}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconInfo(): React.ReactElement {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
        stroke={COLORS.secondaryText}
        strokeWidth={2}
      />
      <Path
        d="M12 16v-4M12 8h.01"
        stroke={COLORS.secondaryText}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function JoinTontineHeader({
  onBack,
}: {
  onBack: () => void;
}): React.ReactElement {
  return (
    <View style={joinHeaderStyles.wrap}>
      <View style={joinHeaderStyles.row}>
        <Pressable
          onPress={onBack}
          style={joinHeaderStyles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </Pressable>
        <Text style={joinHeaderStyles.title}>Rejoindre une tontine</Text>
      </View>
      <View style={joinHeaderStyles.context}>
        <Text style={joinHeaderStyles.contextTitle}>Vous êtes invité(e)</Text>
        <Text style={joinHeaderStyles.contextBody}>
          Collez le lien d&apos;invitation ou scannez le QR Code reçu de
          l&apos;organisatrice
        </Text>
      </View>
    </View>
  );
}

const joinHeaderStyles = StyleSheet.create({
  wrap: {
    backgroundColor: '#1A6B3C',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.white,
  },
  context: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  contextTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.white,
    marginBottom: 2,
  },
  contextBody: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 15.4,
  },
});

const labelUpper = StyleSheet.create({
  text: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: COLORS.gray500,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
});

function JoinInputSection({
  linkInput,
  setLinkInput,
  error,
  isLoading,
  onResolve,
  onOpenScanner,
}: {
  linkInput: string;
  setLinkInput: (s: string) => void;
  error: string | null;
  isLoading: boolean;
  onResolve: () => void;
  onOpenScanner: () => void;
}): React.ReactElement {
  const disabled = linkInput.trim() === '';
  return (
    <View>
      <View style={inputStyles.card}>
        <Text style={labelUpper.text}>Coller le lien</Text>
        <View style={inputStyles.inputRow}>
          <IconLink />
          <TextInput
            style={inputStyles.input}
            placeholder="https://kelemba.app/join/..."
            placeholderTextColor={COLORS.gray500}
            value={linkInput}
            onChangeText={setLinkInput}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          {linkInput.length > 0 ? (
            <Pressable
              onPress={() => setLinkInput('')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Effacer le champ"
            >
              <Ionicons name="close-circle" size={22} color={COLORS.gray500} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={onResolve}
          disabled={disabled || isLoading}
          accessibilityRole="button"
          accessibilityLabel="Charger la tontine"
          accessibilityState={{ disabled: disabled || isLoading }}
          style={({ pressed }) => [
            inputStyles.primaryBtn,
            (disabled || isLoading) && inputStyles.primaryBtnDisabled,
            pressed && !disabled && !isLoading && { opacity: 0.9 },
          ]}
        >
          {isLoading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={inputStyles.primaryBtnText}>Charger la tontine</Text>
          )}
        </Pressable>
        {error ? (
          <Text style={inputStyles.errorText}>{error}</Text>
        ) : null}
      </View>

      <View style={inputStyles.dividerRow}>
        <View style={inputStyles.dividerLine} />
        <Text style={inputStyles.dividerText}>ou</Text>
        <View style={inputStyles.dividerLine} />
      </View>

      <View style={inputStyles.card}>
        <Text style={labelUpper.text}>Scanner un QR Code</Text>
        <Pressable
          onPress={onOpenScanner}
          style={({ pressed }) => [
            inputStyles.qrBtn,
            pressed && { opacity: 0.92 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Scanner un QR Code d'invitation"
        >
          <View style={inputStyles.qrIconWrap}>
            <IconQr />
          </View>
          <View style={inputStyles.qrTextCol}>
            <Text style={inputStyles.qrTitle}>Scanner le QR Code</Text>
            <Text style={inputStyles.qrSub}>
              Pointez l&apos;appareil photo vers le code
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.gray200} />
        </Pressable>
      </View>
    </View>
  );
}

const inputStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    padding: 16,
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.gray100,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
    padding: 0,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 44,
  },
  primaryBtnDisabled: {
    opacity: 0.55,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.white,
  },
  errorText: {
    fontSize: 11,
    color: COLORS.dangerText,
    marginTop: 6,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.gray200,
  },
  dividerText: {
    fontSize: 12,
    color: COLORS.gray500,
    textTransform: 'lowercase',
  },
  qrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.gray100,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  qrIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrTextCol: {
    flex: 1,
  },
  qrTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  qrSub: {
    fontSize: 11,
    color: COLORS.gray500,
    marginTop: 2,
  },
});

function DetailRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <View style={previewStyles.detailRow}>
      <Text style={previewStyles.detailLabel}>{label}</Text>
      <Text style={previewStyles.detailValue}>{value}</Text>
    </View>
  );
}

function JoinPreviewSection({
  preview,
  onContinue,
  onPickOther,
}: {
  preview: TontinePreviewDto;
  onContinue: () => void;
  onPickOther: () => void;
}): React.ReactElement {
  const rules = preview.rules;
  const maxCap =
    preview.maxMemberCount ?? rules?.maxSharesPerMember ?? undefined;
  const pot = preview.amountPerShare * preview.memberCount;
  const penaltyLine =
    rules?.penaltyRate != null && rules.gracePeriodDays != null
      ? `${rules.penaltyRate}% / jour · ${rules.gracePeriodDays} j grâce`
      : '—';
  const minScoreLine =
    rules?.minScoreRequired != null
      ? `${rules.minScoreRequired} pts Kelemba`
      : '—';
  const scoreDisplay =
    preview.creatorKelembScore != null
      ? String(preview.creatorKelembScore)
      : rules?.minScoreRequired != null
        ? `min. ${rules.minScoreRequired}`
        : '—';

  return (
    <View>
      <View style={previewStyles.successBanner}>
        <View style={previewStyles.successCircle}>
          <IconCheck />
        </View>
        <View style={previewStyles.successTextCol}>
          <Text style={previewStyles.successName}>{preview.name}</Text>
          <Text style={previewStyles.successMeta}>
            Organisée par {preview.creatorName ?? 'N/A'} · Score {scoreDisplay}
          </Text>
        </View>
      </View>

      <View style={previewStyles.detailCard}>
        <Text style={labelUpper.text}>Détails de la tontine</Text>
        <DetailRow
          label="Part"
          value={`${frequencyReadable(preview.frequency)} / ${formatFcfa(preview.amountPerShare)}`}
        />
        <DetailRow label="Cagnotte par cycle" value={formatFcfa(pot)} />
        <DetailRow
          label="Membres actuels"
          value={
            maxCap != null
              ? `${preview.memberCount} / ${maxCap}`
              : String(preview.memberCount)
          }
        />
        <DetailRow
          label="Cycles prévus"
          value={String(preview.totalCycles)}
        />
        <DetailRow label="Pénalité retard" value={penaltyLine} />
        <DetailRow label="Score minimum" value={minScoreLine} />

        <View style={previewStyles.noteBox}>
          <IconInfo />
          <Text style={previewStyles.noteText}>
            En cliquant sur Suivant, vous créerez un compte Membre et enverrez
            une demande d&apos;adhésion à cette tontine.
          </Text>
        </View>
      </View>

      <Pressable
        onPress={onContinue}
        style={({ pressed }) => [
          previewStyles.ctaPrimary,
          pressed && { opacity: 0.92 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Suivant, créer mon compte membre"
      >
        <Text style={previewStyles.ctaPrimaryText}>
          Suivant — Créer mon compte →
        </Text>
      </Pressable>

      <Pressable
        onPress={onPickOther}
        style={({ pressed }) => [
          previewStyles.ctaSecondary,
          pressed && { opacity: 0.92 },
        ]}
        accessibilityRole="button"
      >
        <Text style={previewStyles.ctaSecondaryText}>
          Choisir une autre tontine
        </Text>
      </Pressable>
    </View>
  );
}

const previewStyles = StyleSheet.create({
  successBanner: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  successCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTextCol: {
    flex: 1,
  },
  successName: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primaryDark,
    marginBottom: 2,
  },
  successMeta: {
    fontSize: 11,
    color: COLORS.primaryDark,
  },
  detailCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    padding: 16,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  detailLabel: {
    flex: 1,
    fontSize: 12,
    color: COLORS.gray500,
  },
  detailValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textPrimary,
    textAlign: 'right',
  },
  noteBox: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'flex-start',
    backgroundColor: COLORS.secondaryBg,
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.secondaryText,
    lineHeight: 15.4,
  },
  ctaPrimary: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  ctaPrimaryText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.white,
  },
  ctaSecondary: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    width: '100%',
  },
  ctaSecondaryText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.gray700,
  },
});

export const JoinTontineScreen: React.FC<Props> = ({ navigation, route }) => {
  const initialToken = route.params?.token;
  const [linkInput, setLinkInput] = useState(initialToken ? `https://kelemba.app/join/${initialToken}` : '');
  const [resolvedUid, setResolvedUid] = useState<string | null>(null);
  const [preview, setPreview] = useState<TontinePreviewDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const scanHandledRef = useRef(false);
  const autoResolveDoneRef = useRef(false);
  const [permission, requestPermission] = useCameraPermissions();

  const resolveWithUid = useCallback(async (uid: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const data = (await getTontinePreview(uid)) as TontinePreviewDto;
      setPreview(data);
      setResolvedUid(uid);
    } catch (err: unknown) {
      if (ApiError.isApiError(err) && err.httpStatus === 404) {
        setError('Tontine introuvable. Vérifiez le lien.');
      } else {
        setError('Erreur de chargement. Vérifiez votre connexion.');
      }
      logger.error('JoinTontine resolve error', {
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleResolveLink = useCallback(async () => {
    const uid = extractTontineUid(linkInput);
    if (!uid) {
      setError('Lien invalide. Vérifiez et réessayez.');
      return;
    }
    await resolveWithUid(uid);
  }, [linkInput, resolveWithUid]);

  const handleOpenScanner = useCallback(async () => {
    if (Platform.OS === 'web') {
      Alert.alert(
        'Scanner non disponible',
        'Collez manuellement le lien d’invitation reçu par SMS ou WhatsApp.',
        [{ text: 'OK' }]
      );
      return;
    }
    const perm =
      permission?.granted === true
        ? permission
        : await requestPermission();
    if (!perm.granted) {
      Alert.alert(
        'Scanner non disponible',
        'Collez manuellement le lien d’invitation reçu par SMS ou WhatsApp.',
        [{ text: 'OK' }]
      );
      return;
    }
    scanHandledRef.current = false;
    setIsScannerOpen(true);
  }, [permission, requestPermission]);

  const onBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (scanHandledRef.current) return;
      const uid = extractTontineUid(result.data);
      if (!uid) {
        scanHandledRef.current = true;
        setIsScannerOpen(false);
        setError('QR code invalide. Réessayez ou collez le lien.');
        return;
      }
      scanHandledRef.current = true;
      setIsScannerOpen(false);
      setLinkInput(result.data);
      void resolveWithUid(uid);
    },
    [resolveWithUid]
  );

  const closeScanner = useCallback(() => {
    setIsScannerOpen(false);
  }, []);

  const onContinueRegister = useCallback(() => {
    if (!resolvedUid || !preview) return;
    navigation.navigate('Register', {
      mode: 'MEMBRE',
      tontineUid: resolvedUid,
      tontineName: preview.name,
      tontineInviteLinkToken: resolvedUid,
    });
  }, [navigation, preview, resolvedUid]);

  const onPickOther = useCallback(() => {
    setPreview(null);
    setResolvedUid(null);
    setLinkInput('');
    setError(null);
  }, []);

  useEffect(() => {
    if (!initialToken || autoResolveDoneRef.current) return;
    autoResolveDoneRef.current = true;
    void resolveWithUid(initialToken);
  }, [initialToken, resolveWithUid]);

  return (
    <SafeAreaView style={screenStyles.safe} edges={['top']}>
      <JoinTontineHeader onBack={() => navigation.goBack()} />
      <ScrollView
        style={screenStyles.scroll}
        contentContainerStyle={screenStyles.scrollContent}
      >
        {!preview ? (
          <JoinInputSection
            linkInput={linkInput}
            setLinkInput={setLinkInput}
            error={error}
            isLoading={isLoading}
            onResolve={() => void handleResolveLink()}
            onOpenScanner={() => void handleOpenScanner()}
          />
        ) : (
          <JoinPreviewSection
            preview={preview}
            onContinue={onContinueRegister}
            onPickOther={onPickOther}
          />
        )}
      </ScrollView>

      <Modal
        visible={isScannerOpen}
        animationType="slide"
        onRequestClose={closeScanner}
      >
        <View style={screenStyles.modalRoot}>
          <Pressable
            onPress={closeScanner}
            style={screenStyles.modalClose}
            accessibilityRole="button"
            accessibilityLabel="Fermer le scanner"
          >
            <Ionicons name="close" size={32} color={COLORS.white} />
          </Pressable>
          {permission?.granted ? (
            <CameraView
              style={screenStyles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={onBarcodeScanned}
            />
          ) : (
            <View style={screenStyles.cameraFallback}>
              <Text style={screenStyles.cameraFallbackText}>
                Autorisez la caméra pour scanner.
              </Text>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const screenStyles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#1A6B3C',
  },
  scroll: {
    flex: 1,
    backgroundColor: COLORS.gray100,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalClose: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 2,
    padding: 8,
  },
  camera: {
    flex: 1,
  },
  cameraFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  cameraFallbackText: {
    color: COLORS.white,
    textAlign: 'center',
    fontSize: 14,
  },
});
