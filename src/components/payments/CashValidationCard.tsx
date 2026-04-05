import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  Linking,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/spacing';
import { formatFcfaAmount } from '@/utils/formatters';
import { computeCashDaysWaiting } from '@/utils/cashValidation';
import type { CashValidationItem } from '@/types/payments.types';

export interface CashValidationCardProps {
  item: CashValidationItem;
  onApprove: (paymentUid: string) => void;
  onReject: (paymentUid: string, reason?: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}

const AVATAR_PALETTES = [
  { bg: '#EAF3DE', fg: '#27500A' },
  { bg: '#E6F1FB', fg: '#0C447C' },
  { bg: '#EEEDFE', fg: '#3C3489' },
  { bg: '#FFF3D4', fg: '#633806' },
  { bg: '#FCEBEB', fg: '#791F1F' },
] as const;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

function extractFilenameFromUrl(url: string): string {
  try {
    const base = url.split('?')[0] ?? url;
    const last = base.split('/').pop();
    if (last != null && last.length > 0) return decodeURIComponent(last);
  } catch {
    /* ignore */
  }
  return 'Photo du reçu';
}

function getWaitingPill(daysWaiting: number): { label: string; bg: string; fg: string } {
  if (daysWaiting === 0) {
    return { label: "Aujourd'hui", bg: '#F1EFE8', fg: '#5F5E5A' };
  }
  if (daysWaiting === 1) {
    return { label: 'Hier', bg: '#F1EFE8', fg: '#5F5E5A' };
  }
  if (daysWaiting >= 2 && daysWaiting <= 3) {
    return {
      label: `Il y a ${daysWaiting} jours`,
      bg: '#FFF3D4',
      fg: '#854F0B',
    };
  }
  return {
    label: `Il y a ${daysWaiting} jours`,
    bg: '#FCEBEB',
    fg: '#A32D2D',
  };
}

function EyeIcon({ stroke }: { stroke: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function AlertTriangleIcon({ stroke }: { stroke: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export const CashValidationCard: React.FC<CashValidationCardProps> = ({
  item,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}) => {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [imageFailed, setImageFailed] = useState(false);

  const daysWaiting = computeCashDaysWaiting(item.submittedAt);
  const total = Math.round(item.totalAmount);

  const avatarPalette = useMemo(() => {
    const name = item.memberName.trim();
    const idx =
      name.length > 0 ? name.charCodeAt(0) % AVATAR_PALETTES.length : 0;
    return AVATAR_PALETTES[idx];
  }, [item.memberName]);

  const waitingPill = useMemo(() => getWaitingPill(daysWaiting), [daysWaiting]);

  const attenteColor = useMemo(() => {
    if (daysWaiting <= 1) return COLORS.gray500;
    if (daysWaiting <= 3) return COLORS.secondaryText;
    return COLORS.dangerText;
  }, [daysWaiting]);

  const openJustificatif = useCallback(() => {
    const url = item.receiptPhotoUrl;
    if (url == null || url.trim() === '') return;
    void Linking.openURL(url);
  }, [item.receiptPhotoUrl]);

  const handleRejectPress = useCallback(() => {
    setShowRejectInput(true);
    setRejectReason('');
  }, []);

  const hasProof = item.receiptPhotoUrl != null && item.receiptPhotoUrl.trim() !== '';
  const approveLabel = hasProof ? 'Valider le paiement' : 'Valider sans preuve';
  const busy = isApproving || isRejecting;

  return (
    <View style={styles.card} accessibilityRole="none">
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: avatarPalette.bg }]}>
          <Text style={[styles.avatarText, { color: avatarPalette.fg }]}>
            {getInitials(item.memberName)}
          </Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.memberName} numberOfLines={1}>
            {item.memberName}
          </Text>
          <Text style={styles.tontineLine} numberOfLines={1} ellipsizeMode="tail">
            {item.tontineName} · Cycle {item.cycleNumber}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.pillEsp}>
              <Text style={styles.pillEspText}>Espèces</Text>
            </View>
            <View
              style={[
                styles.pillWait,
                { backgroundColor: waitingPill.bg },
              ]}
            >
              <Text style={[styles.pillWaitText, { color: waitingPill.fg }]}>
                {waitingPill.label}
              </Text>
            </View>
            <Text style={styles.remisInline} numberOfLines={1} ellipsizeMode="tail">
              Remis à : {item.receiverName}
            </Text>
          </View>
        </View>
        <View style={styles.right}>
          <View style={styles.amountRow}>
            <Text style={styles.amount}>{formatFcfaAmount(total)}</Text>
            <Text style={styles.fcfa}>FCFA</Text>
          </View>
          {daysWaiting > 0 ? (
            <Text style={[styles.attente, { color: attenteColor }]}>
              Attente : {daysWaiting} j
            </Text>
          ) : null}
        </View>
      </View>

      {hasProof ? (
        <View style={styles.proofWrap}>
          <View style={styles.proofBoxGray}>
            <View style={styles.proofRow}>
              {!imageFailed ? (
                <Image
                  key={item.receiptPhotoUrl ?? ''}
                  source={{ uri: item.receiptPhotoUrl! }}
                  style={styles.thumb}
                  resizeMode="cover"
                  onError={() => {
                    setImageFailed(true);
                  }}
                />
              ) : (
                <View style={styles.thumbFallback}>
                  <Ionicons name="document-text-outline" size={18} color={COLORS.gray500} />
                </View>
              )}
              <View style={styles.proofTextCol}>
                <Text style={styles.proofHint}>Justificatif joint</Text>
                <Text style={styles.proofName} numberOfLines={1} ellipsizeMode="middle">
                  {extractFilenameFromUrl(item.receiptPhotoUrl!)}
                </Text>
                {item.latitude != null && item.longitude != null ? (
                  <Text style={styles.coords}>
                    {item.latitude.toFixed(4)}° N, {item.longitude.toFixed(4)}° E
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={openJustificatif}
                style={({ pressed }) => [styles.eyeBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Voir le justificatif"
              >
                <EyeIcon stroke={COLORS.primary} />
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.proofWrap}>
          <View style={styles.proofBoxOrange}>
            <View style={styles.proofRow}>
              <View style={styles.thumbOrange}>
                <AlertTriangleIcon stroke={COLORS.secondaryText} />
              </View>
              <View style={styles.proofTextCol}>
                <Text style={styles.noProofTitle}>Aucun justificatif joint</Text>
                <Text style={styles.noProofSub}>Valider sans preuve ?</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          onPress={() => onApprove(item.paymentUid)}
          disabled={busy}
          style={({ pressed }) => [
            styles.btnApprove,
            pressed && !busy && styles.pressed,
            busy && styles.btnDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Valider le paiement de ${item.memberName}, ${formatFcfaAmount(total)} FCFA`}
        >
          {isApproving ? (
            <ActivityIndicator color={COLORS.white} size="small" />
          ) : (
            <Text style={styles.btnApproveText}>{approveLabel}</Text>
          )}
        </Pressable>
        <Pressable
          onPress={handleRejectPress}
          disabled={busy}
          style={({ pressed }) => [
            styles.btnReject,
            pressed && !busy && styles.pressed,
            busy && styles.btnDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Refuser le paiement de ${item.memberName}`}
        >
          {isRejecting ? (
            <ActivityIndicator color={COLORS.dangerText} size="small" />
          ) : (
            <Text style={styles.btnRejectText}>Refuser</Text>
          )}
        </Pressable>
      </View>

      {showRejectInput ? (
        <View style={styles.rejectPanel}>
          <TextInput
            placeholder="Motif du refus (optionnel)"
            placeholderTextColor={COLORS.gray500}
            value={rejectReason}
            onChangeText={setRejectReason}
            style={styles.rejectInput}
            autoFocus
            multiline={false}
          />
          <View style={styles.rejectActions}>
            <Pressable
              onPress={() => {
                setShowRejectInput(false);
                setRejectReason('');
              }}
              style={({ pressed }) => [styles.rejectCancel, pressed && styles.pressed]}
            >
              <Text style={styles.rejectCancelText}>Annuler</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onReject(
                  item.paymentUid,
                  rejectReason.trim() ? rejectReason.trim() : undefined
                );
                setShowRejectInput(false);
                setRejectReason('');
              }}
              style={({ pressed }) => [styles.rejectConfirm, pressed && styles.pressed]}
            >
              <Text style={styles.rejectConfirmText}>Confirmer le refus</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    minWidth: 0,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  tontineLine: {
    fontSize: 11,
    color: COLORS.gray500,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  pillEsp: {
    backgroundColor: COLORS.secondaryBg,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: RADIUS.pill,
  },
  pillEspText: {
    fontSize: 9,
    fontWeight: '500',
    color: COLORS.secondaryText,
  },
  pillWait: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: RADIUS.pill,
  },
  pillWaitText: {
    fontSize: 9,
    fontWeight: '500',
  },
  remisInline: {
    fontSize: 10,
    color: COLORS.gray500,
    flexShrink: 1,
    minWidth: 0,
  },
  right: {
    alignItems: 'flex-end',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  amount: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.primary,
  },
  fcfa: {
    fontSize: 10,
    color: COLORS.gray500,
  },
  attente: {
    fontSize: 10,
    marginTop: 2,
  },
  proofWrap: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  proofBoxGray: {
    backgroundColor: COLORS.gray100,
    borderRadius: RADIUS.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  proofBoxOrange: {
    backgroundColor: COLORS.secondaryBg,
    borderRadius: RADIUS.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  proofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  thumb: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  thumbFallback: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: COLORS.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbOrange: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: COLORS.secondaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proofTextCol: {
    flex: 1,
    minWidth: 0,
  },
  proofHint: {
    fontSize: 10,
    color: COLORS.gray500,
  },
  proofName: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  coords: {
    fontSize: 10,
    color: COLORS.gray500,
    marginTop: 2,
  },
  noProofTitle: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.secondaryText,
  },
  noProofSub: {
    fontSize: 11,
    color: COLORS.secondaryText,
    marginTop: 2,
  },
  eyeBtn: {
    padding: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  btnApprove: {
    flex: 1,
    minHeight: 36,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnApproveText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.white,
    textAlign: 'center',
  },
  btnReject: {
    flex: 1,
    minHeight: 36,
    backgroundColor: COLORS.dangerLight,
    borderRadius: RADIUS.sm,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRejectText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.dangerText,
    textAlign: 'center',
  },
  btnDisabled: {
    opacity: 0.65,
  },
  pressed: {
    opacity: 0.9,
  },
  rejectPanel: {
    marginHorizontal: 14,
    marginBottom: 12,
    marginTop: 8,
    backgroundColor: COLORS.gray100,
    borderRadius: RADIUS.sm,
    padding: 10,
  },
  rejectInput: {
    fontSize: 12,
    color: COLORS.textPrimary,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
  },
  rejectActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  rejectCancel: {
    flex: 1,
    backgroundColor: COLORS.gray100,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  rejectCancelText: {
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  rejectConfirm: {
    flex: 1,
    backgroundColor: COLORS.danger,
    borderRadius: RADIUS.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  rejectConfirmText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.white,
  },
});
