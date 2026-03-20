/**
 * TontineActivationPanel
 * Panneau affiché dans TontineDetailsScreen quand isDraft && isCreator.
 *
 * Corrections v4 :
 *  - Affiche TOUS les membres (ACTIVE + PENDING) — le filtre ACTIVE seul
 *    causait une liste vide en DRAFT.
 *  - La validation "canActivate" vérifie uniquement les membres ACTIVE.
 *  - Le stepper de parts utilise ENDPOINTS.TONTINES.MEMBER_UPDATE_SHARES
 *    via apiClient (endpoint présent dans endpoints.ts).
 *  - updateMemberShares n'est plus importé depuis tontinesApi (inexistant).
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/types';
import type { RootState } from '@/store/store';
import { selectUserUid } from '@/store/authSlice';
import { initializeCycles, shuffleRotation } from '@/api/tontinesApi';
import { apiClient } from '@/api/apiClient';
import { ENDPOINTS } from '@/api/endpoints';
import { parseApiError } from '@/api/errors/errorHandler';
import { logger } from '@/utils/logger';
import { formatFcfa } from '@/utils/formatters';
import { getInitials, hashToColor } from '@/utils/avatarUtils';
import type { TontineMember } from '@/types/tontine';

const SHARES_MIN = 1;
const SHARES_MAX = 5;

export type TontineActivationPhase = 'DRAFT' | 'BETWEEN_ROUNDS';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TontineInfo {
  name: string;
  amountPerShare: number;
  frequency: string;
  startDate: string;
  totalCycles: number;
  rules?: {
    rotationType?: string;
    rotationMode?: string;
    [key: string]: unknown;
  };
  rotationMode?: string;
}

export interface TontineActivationPanelProps {
  tontine: TontineInfo;
  tontineUid: string;
  members: TontineMember[];
  membersLoading: boolean;
  navigation: NativeStackNavigationProp<RootStackParamList>;
  onSuccess: () => void;
  showToast: (msg: string, severity: 'error' | 'warning' | 'info') => void;
  /** DRAFT = première activation ; BETWEEN_ROUNDS = nouvelle rotation */
  activationPhase?: TontineActivationPhase;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveRotationMode(tontine: TontineInfo): 'MANUAL' | 'RANDOM' | 'ARRIVAL' {
  const raw =
    tontine.rotationMode ??
    tontine.rules?.rotationMode ??
    tontine.rules?.rotationType ??
    'ARRIVAL';
  const up = String(raw).toUpperCase();
  if (up === 'MANUAL' || up === 'RANDOM') return up;
  return 'ARRIVAL';
}

const FREQUENCY_LABELS: Record<string, string> = {
  DAILY: 'Quotidienne',
  WEEKLY: 'Hebdomadaire',
  BIWEEKLY: 'Bimensuelle',
  MONTHLY: 'Mensuelle',
};

function formatDateShort(dateStr: string): string {
  const part = (dateStr ?? '').split('T')[0];
  const [y, m, d] = part.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const TontineActivationPanel: React.FC<TontineActivationPanelProps> = ({
  tontine,
  tontineUid,
  members,
  membersLoading,
  navigation,
  onSuccess,
  showToast,
  activationPhase = 'DRAFT',
}) => {
  const { t } = useTranslation();
  const isBetweenRounds = activationPhase === 'BETWEEN_ROUNDS';
  const nextRotationNumber = tontine.totalCycles + 1;
  const userUid = useSelector((state: RootState) => selectUserUid(state));
  const queryClient = useQueryClient();

  // members et membersLoading viennent des props (TontineDetailsScreen)
  // useTontineMembers n'est plus appelé ici pour éviter le double fetch

  const rotationMode = resolveRotationMode(tontine);
  const isManual = rotationMode === 'MANUAL';
  const isRandom = rotationMode === 'RANDOM';

  // ── CORRECTION PRINCIPALE ─────────────────────────────────────────────────
  // On affiche TOUS les membres non expulsés/partis, triés par rotationOrder.
  // En DRAFT, le filtre ACTIVE seul causait une liste vide car les membres
  // peuvent être exposés différemment selon le hook/endpoint.
  const displayMembers = useMemo(
    () =>
      [...members]
        .filter(
          (m) =>
            m.membershipStatus !== 'LEFT' && m.membershipStatus !== 'EXPELLED'
        )
        .sort((a, b) => (a.rotationOrder ?? 0) - (b.rotationOrder ?? 0)),
    [members]
  );

  // Seuls les membres ACTIVE comptent pour la condition d'activation
  const activeOnlyMembers = useMemo(
    () => displayMembers.filter((m) => m.membershipStatus === 'ACTIVE'),
    [displayMembers]
  );

  // ── État local des parts ──────────────────────────────────────────────────
  const [localShares, setLocalShares] = useState<Record<string, number>>({});
  const [isActivating, setIsActivating] = useState(false);
  const [savingSharesFor, setSavingSharesFor] = useState<string | null>(null);

  const getSharesForMember = useCallback(
    (m: TontineMember): number =>
      localShares[m.uid] ??
      Math.max(SHARES_MIN, Math.min(SHARES_MAX, m.sharesCount ?? 1)),
    [localShares]
  );

  const totalParts = useMemo(
    () => displayMembers.reduce((s, m) => s + getSharesForMember(m), 0),
    [displayMembers, getSharesForMember, localShares]
  );

  const handleSetShares = useCallback(
    async (member: TontineMember, newValue: number) => {
      const clamped = Math.max(SHARES_MIN, Math.min(SHARES_MAX, newValue));
      // Mise à jour optimiste locale immédiate
      setLocalShares((prev) => ({ ...prev, [member.uid]: clamped }));

      try {
        setSavingSharesFor(member.uid);
        const ep = ENDPOINTS.TONTINES.MEMBER_UPDATE_SHARES(tontineUid, member.uid);
        await apiClient.request({
          method: ep.method,
          url: ep.url,
          data: { sharesCount: clamped },
        });
        // Actualise la liste des membres (parts) pour RotationReorderScreen et le panneau
        await queryClient.invalidateQueries({
          queryKey: ['members', tontineUid],
        });
      } catch (err: unknown) {
        // Rollback en cas d'erreur
        setLocalShares((prev) => ({
          ...prev,
          [member.uid]: member.sharesCount ?? 1,
        }));
        const apiErr = parseApiError(err);
        if (apiErr.httpStatus === 404) {
          showToast(
            t(
              'tontineActivation.sharesUpdateNotSupported',
              "La modification des parts n'est pas encore disponible."
            ),
            'error'
          );
        } else {
          showToast(
            t(
              'tontineActivation.sharesUpdateError',
              'Erreur lors de la mise à jour des parts.'
            ),
            'error'
          );
          logger.error('TontineActivationPanel: updateShares failed', {
            code: apiErr.code,
            memberUid: member.uid,
          });
        }
      } finally {
        setSavingSharesFor(null);
      }
    },
    [tontineUid, showToast, t, queryClient]
  );

  // ── Modifier l'ordre de rotation ──────────────────────────────────────────
  const handleEditRotation = useCallback(() => {
    (navigation as { navigate: (name: string, params: object) => void }).navigate(
      'RotationReorderScreen',
      { tontineUid }
    );
  }, [navigation, tontineUid]);

  // ── Activation ────────────────────────────────────────────────────────────
  const handleActivate = useCallback(() => {
    if (isActivating) return;

    if (activeOnlyMembers.length < 2) {
      showToast(
        t(
          'tontineActivation.minActiveMembers',
          'Il faut au moins 2 membres actifs pour démarrer.'
        ),
        'error'
      );
      return;
    }

    Alert.alert(
      isBetweenRounds
        ? t(
            'tontineActivation.launchRotationTitle',
            'Lancer la rotation {{n}} ?',
            { n: nextRotationNumber }
          )
        : t('tontineActivation.activateConfirmTitle', 'Démarrer la tontine ?'),
      isBetweenRounds
        ? t(
            'tontineActivation.launchRotationMessage',
            'Une nouvelle série de cycles sera créée. Les membres et parts actuels seront conservés.'
          )
        : t(
            'tontineActivation.activateConfirmMessage',
            'Les cycles seront créés et la tontine passera en statut Actif. Cette action est irréversible.'
          ),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: isBetweenRounds
            ? t('tontineActivation.launchRotationConfirm', 'Lancer')
            : t('tontineActivation.activate', 'Activer'),
          style: 'default',
          onPress: async () => {
            setIsActivating(true);
            try {
              // RANDOM → tirage au sort avant initialisation
              if (isRandom) {
                await shuffleRotation(tontineUid);
              }

              // Initialiser les cycles → POST /api/v1/cycles/initialize/{tontineUid}
              await initializeCycles(tontineUid);

              queryClient.invalidateQueries({ queryKey: ['tontines'] });
              queryClient.invalidateQueries({ queryKey: ['tontine', tontineUid] });
              queryClient.invalidateQueries({ queryKey: ['members', tontineUid] });
              queryClient.invalidateQueries({
                queryKey: ['cycle', 'current', tontineUid],
              });
              queryClient.invalidateQueries({
                queryKey: ['report', tontineUid],
              });
              queryClient.invalidateQueries({
                queryKey: ['tontineRotation', tontineUid],
              });

              showToast(
                isBetweenRounds
                  ? t(
                      'tontineActivation.launchRotationSuccess',
                      'Nouvelle rotation lancée !'
                    )
                  : t(
                      'tontineActivation.activateSuccess',
                      'Tontine activée avec succès !'
                    ),
                'info'
              );
              onSuccess();
            } catch (err: unknown) {
              const apiErr = parseApiError(err);
              if (apiErr.httpStatus === 400) {
                showToast(
                  t(
                    'tontineActivation.minActiveMembers',
                    'Pas assez de membres actifs (minimum 2).'
                  ),
                  'error'
                );
              } else if (apiErr.httpStatus === 403) {
                showToast(
                  t(
                    'tontineActivation.creatorOnly',
                    'Seul le créateur peut activer la tontine.'
                  ),
                  'error'
                );
              } else if (apiErr.httpStatus === 409) {
                // Cycles déjà initialisés → considérer comme succès
                showToast(
                  t(
                    'tontineActivation.cyclesAlreadyInit',
                    'Les cycles sont déjà initialisés.'
                  ),
                  'warning'
                );
                onSuccess();
              } else {
                showToast(
                  t(
                    'tontineActivation.activateError',
                    "Erreur lors de l'activation. Réessayez."
                  ),
                  'error'
                );
                logger.error('TontineActivationPanel: activate failed', {
                  code: apiErr.code,
                  status: apiErr.httpStatus,
                });
              }
            } finally {
              setIsActivating(false);
            }
          },
        },
      ]
    );
  }, [
    isActivating,
    activeOnlyMembers.length,
    isRandom,
    tontineUid,
    queryClient,
    showToast,
    onSuccess,
    t,
    isBetweenRounds,
    nextRotationNumber,
  ]);

  // ── Rendu d'un item ───────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item, index }: { item: TontineMember; index: number }) => {
      const isYou = userUid != null && item.userUid === userUid;
      const isOrganizer = item.memberRole === 'CREATOR';
      const isPending = item.membershipStatus === 'PENDING';
      const shares = getSharesForMember(item);
      const isSaving = savingSharesFor === item.uid;

      return (
        <View style={[styles.memberRow, isPending && styles.memberRowPending]}>
          {/* Avatar */}
          <View
            style={[
              styles.avatar,
              { backgroundColor: hashToColor(item.fullName) },
              isPending && styles.avatarPending,
            ]}
          >
            <Text style={styles.avatarText}>{getInitials(item.fullName)}</Text>
          </View>

          {/* Infos */}
          <View style={styles.memberInfo}>
            <View style={styles.memberNameRow}>
              <Text style={styles.memberName} numberOfLines={1}>
                {item.fullName}
              </Text>
              {isOrganizer && (
                <View style={[styles.pill, styles.pillOrganizer]}>
                  <Text style={styles.pillText}>
                    {t('tontineList.organizer', 'Organisateur')}
                  </Text>
                </View>
              )}
              {isYou && (
                <View style={[styles.pill, styles.pillYou]}>
                  <Text style={styles.pillText}>
                    {t('tontineActivation.you', 'Vous')}
                  </Text>
                </View>
              )}
              {isPending && (
                <View style={[styles.pill, styles.pillPending]}>
                  <Text style={styles.pillText}>
                    {t('tontineActivation.pending', 'En attente')}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.positionText}>
              {t('tontineActivation.position', 'Position')} #{index + 1}
            </Text>
          </View>

          {/* Stepper parts */}
          <View style={styles.sharesStepper}>
            {isSaving ? (
              <ActivityIndicator
                size="small"
                color="#1A6B3C"
                style={styles.stepperLoader}
              />
            ) : (
              <>
                <Pressable
                  style={[
                    styles.stepperBtn,
                    (shares <= SHARES_MIN || isActivating) &&
                      styles.stepperBtnDisabled,
                  ]}
                  onPress={() => handleSetShares(item, shares - 1)}
                  disabled={shares <= SHARES_MIN || isActivating}
                  accessibilityRole="button"
                  accessibilityLabel="Retirer une part"
                >
                  <Ionicons
                    name="remove"
                    size={16}
                    color={shares <= SHARES_MIN ? '#9CA3AF' : '#1C1C1E'}
                  />
                </Pressable>
                <Text style={styles.sharesValue}>{shares}</Text>
                <Pressable
                  style={[
                    styles.stepperBtn,
                    (shares >= SHARES_MAX || isActivating) &&
                      styles.stepperBtnDisabled,
                  ]}
                  onPress={() => handleSetShares(item, shares + 1)}
                  disabled={shares >= SHARES_MAX || isActivating}
                  accessibilityRole="button"
                  accessibilityLabel="Ajouter une part"
                >
                  <Ionicons
                    name="add"
                    size={16}
                    color={shares >= SHARES_MAX ? '#9CA3AF' : '#1C1C1E'}
                  />
                </Pressable>
              </>
            )}
          </View>
        </View>
      );
    },
    [
      userUid,
      getSharesForMember,
      savingSharesFor,
      isActivating,
      handleSetShares,
      t,
    ]
  );

  // ── Chargement ────────────────────────────────────────────────────────────
  if (membersLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A6B3C" />
        <Text style={styles.loadingText}>
          {t('tontineActivation.loadingMembers', 'Chargement des membres…')}
        </Text>
      </View>
    );
  }

  const canActivate = activeOnlyMembers.length >= 2 && !isActivating;

  // ── Rendu principal ───────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* ── Résumé tontine ── */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Ionicons name="wallet-outline" size={16} color="#1A6B3C" />
          <Text style={styles.summaryValue}>
            {formatFcfa(tontine.amountPerShare)} / part
            {'  ·  '}
            {FREQUENCY_LABELS[tontine.frequency] ?? tontine.frequency}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Ionicons
            name={isBetweenRounds ? 'checkmark-done-outline' : 'calendar-outline'}
            size={16}
            color="#6B7280"
          />
          <Text style={styles.summarySub}>
            {isBetweenRounds
              ? t(
                  'tontineActivation.previousRotationSummary',
                  'Rotation {{n}} terminée',
                  { n: tontine.totalCycles }
                )
              : t('tontineActivation.startDate', 'Démarrage prévu le {{date}}', {
                  date: formatDateShort(tontine.startDate),
                })}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Ionicons name="people-outline" size={16} color="#6B7280" />
          <Text style={styles.summarySub}>
            {activeOnlyMembers.length}{' '}
            {t('tontineActivation.membersActive', 'membre(s) actif(s)')}
            {'  ·  '}
            {totalParts} {t('tontineActivation.partsTotal', 'part(s) au total')}
          </Text>
        </View>
      </View>

      {/* ── Bannière mode rotation ── */}
      <View style={styles.infoBanner}>
        <Ionicons
          name="information-circle-outline"
          size={17}
          color="#92400E"
        />
        <Text style={styles.infoBannerText}>
          {isManual
            ? t(
                'tontineActivation.bannerManual',
                "Utilisez le bouton ci-dessous pour modifier l'ordre de rotation."
              )
            : isRandom
            ? t(
                'tontineActivation.bannerRandom',
                "L'ordre sera attribué aléatoirement à l'activation."
              )
            : t(
                'tontineActivation.bannerArrival',
                "L'ordre de rotation suit l'ordre d'arrivée des membres."
              )}
        </Text>
      </View>

      {isBetweenRounds ? (
        <View style={styles.betweenRoundsInfo}>
          <Ionicons name="information-circle-outline" size={18} color="#1A6B3C" />
          <Text style={styles.betweenRoundsInfoText}>
            {t(
              'tontineActivation.betweenRoundsPartsHint',
              'Les membres et parts restent inchangés. Vous pouvez modifier les parts avant de lancer.'
            )}
          </Text>
        </View>
      ) : null}

      {/* ── Bouton Modifier l'ordre ── */}
      <Pressable
        style={[
          styles.editRotationBtn,
          isActivating && styles.editRotationBtnDisabled,
        ]}
        onPress={handleEditRotation}
        disabled={isActivating}
        accessibilityRole="button"
      >
        <Ionicons name="reorder-three" size={22} color="#1A6B3C" />
        <Text style={styles.editRotationText}>
          {t('tontineActivation.editRotation', "Modifier l'ordre de rotation")}
        </Text>
        <Ionicons name="chevron-forward" size={20} color="#1A6B3C" />
      </Pressable>

      {/* ── Label section membres ── */}
      <Text style={styles.sharesNote}>
        {isBetweenRounds
          ? t(
              'tontineActivation.sharesNoteBetweenRounds',
              'Parts (1–5) · Ajustez avant de lancer la prochaine rotation'
            )
          : t(
              'tontineActivation.sharesNote',
              "Parts (1–5) · Modifiez avant d'activer"
            )}
      </Text>

      {/* ── Liste membres ── */}
      {displayMembers.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyStateText}>
            {t(
              'tontineActivation.emptyMembers',
              "Aucun membre pour l'instant. Invitez des membres via le lien ou le QR code."
            )}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayMembers}
          keyExtractor={(item) => item.uid}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Footer ── */}
      <View style={styles.footer}>
        {!canActivate && displayMembers.length > 0 && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning-outline" size={15} color="#92400E" />
            <Text style={styles.warningText}>
              {activeOnlyMembers.length < 2
                ? t(
                    'tontineActivation.needMoreMembers',
                    `${activeOnlyMembers.length} membre(s) actif(s) — minimum 2 requis pour démarrer.`
                  )
                : t('tontineActivation.saving', 'Traitement en cours…')}
            </Text>
          </View>
        )}

        <Pressable
          style={[
            styles.activateBtn,
            !canActivate && styles.activateBtnDisabled,
          ]}
          onPress={handleActivate}
          disabled={!canActivate}
          accessibilityRole="button"
          accessibilityLabel={
            isBetweenRounds
              ? t(
                  'tontineActivation.launchNextRotationA11y',
                  'Lancer la rotation {{n}}',
                  { n: nextRotationNumber }
                )
              : t('tontineActivation.activate', 'Activer la tontine')
          }
        >
          {isActivating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
              <Text style={styles.activateBtnText}>
                {isBetweenRounds
                  ? t(
                      'tontineActivation.launchNextRotation',
                      'Lancer la rotation {{n}}',
                      { n: nextRotationNumber }
                    )
                  : t('tontineActivation.activate', 'Activer la tontine')}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  summarySub: {
    fontSize: 13,
    color: '#6B7280',
  },
  betweenRoundsInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    backgroundColor: '#E8F5EE',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C8E6D0',
  },
  betweenRoundsInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#1A3C2E',
    lineHeight: 18,
    fontWeight: '500',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF8E7',
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 10,
    padding: 12,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
  editRotationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#E8F5EE',
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#1A6B3C',
  },
  editRotationBtnDisabled: {
    opacity: 0.5,
  },
  editRotationText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1A6B3C',
  },
  sharesNote: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  memberRowPending: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPending: {
    opacity: 0.55,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  memberInfo: {
    flex: 1,
    gap: 3,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    flexShrink: 1,
  },
  positionText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  pill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pillOrganizer: { backgroundColor: '#1A6B3C' },
  pillYou: { backgroundColor: '#0055A5' },
  pillPending: { backgroundColor: '#9CA3AF' },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sharesStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepperLoader: {
    width: 80,
    height: 30,
  },
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  stepperBtnDisabled: {
    opacity: 0.4,
  },
  sharesValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
    minWidth: 22,
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 10,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF8E7',
    borderRadius: 10,
    padding: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
  activateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1A6B3C',
    paddingVertical: 16,
    borderRadius: 28,
    minHeight: 56,
  },
  activateBtnDisabled: {
    opacity: 0.45,
  },
  activateBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
