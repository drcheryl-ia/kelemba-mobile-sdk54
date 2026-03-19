/**
 * API Tontines — prévisualisation, création, initialisation cycles.
 */
import axios from 'axios';
import { ENV } from '@/config/env';
import { apiClient } from './apiClient';
import { ENDPOINTS } from './endpoints';
import { parseApiError } from './errors/errorHandler';
import { ApiError } from './errors/ApiError';
import { ApiErrorCode } from './errors/errorCodes';
import { logger } from '@/utils/logger';
import type {
  TontinePreview,
  TontineDto,
  CreateTontineDto,
  PaginatedResponse,
} from './types/api.types';
import type {
  TontineListItem,
  TontineDetail,
  CurrentCycle,
  TontineMember,
  TontineReportSummary,
  RotationSwapRequest,
  ReorderRotationPayload,
  CreateSwapRequestPayload,
  DecideSwapRequestPayload,
} from '@/types/tontine';
import type {
  InviteLinkResponse,
  SendInvitationsResponse,
} from '@/types/invite';
import { normalizeRcPhone } from '@/utils/validators';
import type { TontineRotationResponse } from '@/types/rotation';
import type { TontineType } from '@/types/savings.types';

/** Client sans intercepteur auth — pour GET preview invitation */
const unauthenticatedClient = axios.create({
  baseURL: ENV.API_URL,
  timeout: ENV.API_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

/**
 * Prévisualisation d'une tontine via lien d'invitation (non authentifié).
 * GET /api/v1/tontines/invitation/:tontineUid/preview
 */
export const getTontinePreview = async (
  tontineUid: string
): Promise<TontinePreview> => {
  try {
    const { url } = ENDPOINTS.TONTINES.INVITATION_PREVIEW(tontineUid);
    const response = await unauthenticatedClient.get<TontinePreview>(url);
    return response.data;
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    if (apiError.httpStatus === 404) {
      throw new ApiError(ApiErrorCode.TONTINE_NOT_FOUND, 404, apiError.message);
    }
    logger.error('getTontinePreview failed');
    throw apiError;
  }
};

/**
 * Créer une tontine (authentifié, KYC vérifié, ORGANISATEUR).
 * POST /api/v1/tontines
 */
export const createTontine = async (
  payload: CreateTontineDto
): Promise<TontineDto> => {
  try {
    const { url } = ENDPOINTS.TONTINES.CREATE;
    const response = await apiClient.post<TontineDto>(url, payload);
    return response.data;
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    logger.error('createTontine failed', { payload: { name: payload.name } });
    throw apiError;
  }
};

/**
 * Initialiser les cycles d'une tontine.
 * POST /api/v1/cycles/initialize/:tontineUid
 * À appeler au démarrage (depuis TontineDetailsScreen), pas à la création.
 */
export const initializeCycles = async (
  tontineUid: string
): Promise<void> => {
  try {
    const { url } = ENDPOINTS.CYCLES.INITIALIZE(tontineUid);
    await apiClient.post(url);
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    if (apiError.httpStatus === 400) {
      logger.warn('initializeCycles — pas assez de membres actifs', { tontineUid });
      throw new ApiError(
        ApiErrorCode.INSUFFICIENT_MEMBERS,
        400,
        'Pas assez de membres actifs pour initialiser les cycles.',
      );
    }
    if (apiError.httpStatus === 409) {
      logger.warn('initializeCycles — cycles déjà initialisés', { tontineUid });
      throw new ApiError(
        ApiErrorCode.ALREADY_INITIALIZED,
        409,
        'Les cycles ont déjà été initialisés.',
      );
    }
    logger.error('initializeCycles failed', { tontineUid });
    throw apiError;
  }
};

function normalizeTontineListItem(raw: Record<string, unknown>): TontineListItem {
  // ⚠️ NE PAS confondre : AccountType (global) vs MemberRole (dans une tontine)
  return {
    uid: (raw.tontineUid ?? raw.uid) as string,
    name: (raw.tontineName ?? raw.name) as string,
    status: (raw.tontineStatus ?? raw.status) as TontineListItem['status'],
    type: (raw.type ?? 'ROTATIVE') as TontineType,
    amountPerShare: Number(raw.amountPerShare),
    frequency: raw.frequency as TontineListItem['frequency'],
    totalCycles: Number(raw.totalCycles),
    currentCycle:
      raw.currentCycle != null
        ? typeof raw.currentCycle === 'object' && 'cycleNumber' in raw.currentCycle
          ? (raw.currentCycle as { cycleNumber: number }).cycleNumber
          : Number(raw.currentCycle)
        : null,
    membershipRole: (raw.userRole ?? raw.membershipRole) as TontineListItem['membershipRole'],
    // membershipStatus absent du contrat API MyTontineItemDto → dériver depuis userRole
    // CREATOR et MEMBER actifs = ACTIVE ; le backend filtre déjà les PENDING
    membershipStatus: (
      raw.membershipStatus ?? 'ACTIVE'
    ) as TontineListItem['membershipStatus'],
    hasPaymentDue: Boolean(raw.hasPaymentDue),
    nextPaymentDate: (raw.nextPaymentDate ?? null) as string | null,
    isCreator: Boolean(raw.isCreator),
    canInvite: Boolean(raw.canInvite),
    startDate: raw.startDate as string | undefined,
    activeMemberCount: (raw.memberCount ?? raw.activeMemberCount) as number | undefined,
    invitationOrigin:
      raw.requiresOrganizerApproval === true
        ? ('JOIN_REQUEST' as const)
        : raw.origin === 'JOIN_REQUEST' || raw.invitationOrigin === 'JOIN_REQUEST'
          ? ('JOIN_REQUEST' as const)
          : raw.origin === 'INVITE' || raw.invitationOrigin === 'INVITE' || raw.origin === 'INVITATION' || raw.invitationOrigin === 'INVITATION'
            ? ('INVITE' as const)
            : undefined,
  };
}

/**
 * Liste des tontines de l'utilisateur connecté.
 * GET /api/v1/tontines/me
 */
export const getTontines = async (): Promise<TontineListItem[]> => {
  try {
    const { url } = ENDPOINTS.TONTINES.MY_TONTINES;
    const response = await apiClient.get<
      | PaginatedResponse<Record<string, unknown>>
      | Record<string, unknown>[]
      | { tontines: Record<string, unknown>[] }
      | { data: Record<string, unknown>[] }
    >(url);
    const raw = Array.isArray(response.data)
      ? response.data
      : (response.data as Record<string, unknown>)?.tontines ??
        (response.data as Record<string, unknown>)?.data ??
        [];
    return (Array.isArray(raw) ? raw : []).map((item) =>
      normalizeTontineListItem(item as Record<string, unknown>)
    );
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    logger.error('getTontines failed');
    throw apiError;
  }
};

/**
 * Accepter une invitation à une tontine.
 * POST /api/v1/tontines/:tontineUid/members/accept
 */
export const acceptInvitation = async (
  tontineUid: string,
  sharesCount?: number
): Promise<void> => {
  try {
    const { url } = ENDPOINTS.TONTINES.MEMBERS_ACCEPT(tontineUid);
    await apiClient.post(url, sharesCount != null ? { sharesCount } : {});
  } catch (err: unknown) {
    const apiErr = parseApiError(err);

    // 409 INVITATION_ALREADY_PROCESSED — comportement backend normal,
    // la membership est déjà ACTIVE. Ne pas logger, relancer pour
    // que l'écran rafraîchisse silencieusement.
    if (apiErr.code === ApiErrorCode.INVITATION_ALREADY_PROCESSED) {
      throw err;
    }

    // Toute autre erreur — logger avant de relancer
    logger.error('[Kelemba] acceptInvitation failed', { tontineUid });
    throw err;
  }
};

/**
 * Créer une demande d'adhésion via lien/QR partagé.
 * POST /api/v1/tontines/:tontineUid/join-requests
 */
export async function createJoinRequest(
  tontineUid: string,
  sharesCount?: number
): Promise<void> {
  const { url } = ENDPOINTS.TONTINES.JOIN_REQUESTS(tontineUid);
  await apiClient.post(url, { sharesCount: sharesCount ?? 1 });
}

/**
 * Rejoindre une tontine via lien/QR partagé (demande d'adhésion).
 * Appelle join-requests, pas members/accept (réservé aux invitations nominatives).
 */
export async function joinTontineByLink(tontineUid: string): Promise<void> {
  try {
    await createJoinRequest(tontineUid);
  } catch (err: unknown) {
    const apiErr = parseApiError(err);
    logger.error('[Kelemba] joinTontineByLink failed', {
      tontineUid,
      code: apiErr.code,
      httpStatus: apiErr.httpStatus,
    });
    throw err;
  }
}

/**
 * Refuser une invitation nominative à une tontine.
 * POST /api/v1/tontines/:tontineUid/members/reject
 * Ne pas confondre avec rejectMemberByOrganizer (flux join-request organisateur).
 */
export const rejectInvitation = async (tontineUid: string): Promise<void> => {
  try {
    const { url } = ENDPOINTS.TONTINES.MEMBERS_REJECT(tontineUid);
    await apiClient.post(url);
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    logger.error('rejectInvitation failed', { tontineUid });
    throw apiError;
  }
};

/** Alias sémantique — refus d'une invitation nominative par l'invité */
export const declineTontineInvitation = rejectInvitation;

/** Payload unitaire attendu par POST /members/invite */
export interface InviteMemberPayload {
  phone: string;
  sharesCount?: number;
}

/**
 * Inviter un membre par téléphone (flux nominatif).
 * POST /v1/tontines/:uid/members/invite
 * Backend attend { phone, sharesCount } — pas de bulk.
 */
export const inviteMemberByPhone = async (
  tontineUid: string,
  payload: InviteMemberPayload
): Promise<SendInvitationsResponse> => {
  try {
    const normalizedPhone = normalizeRcPhone(payload.phone);
    const body: { phone: string; sharesCount: number } = {
      phone: normalizedPhone,
      sharesCount: payload.sharesCount ?? 1,
    };
    const { url } = ENDPOINTS.TONTINES.MEMBERS_INVITE(tontineUid);
    const response = await apiClient.post<SendInvitationsResponse>(url, body);
    return response.data;
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Numéro RCA invalide')) {
      throw new ApiError(ApiErrorCode.INVALID_PHONE_FORMAT, 400, err.message);
    }
    const apiError = parseApiError(err);
    logger.error('inviteMemberByPhone failed', { tontineUid });
    throw apiError;
  }
};

/**
 * Invitations nominatives reçues par l'utilisateur connecté.
 * GET /api/v1/tontines/invitations/received
 * À accepter via acceptInvitation ou refuser via rejectInvitation.
 * Retourne TontineListItem[] avec invitationOrigin = INVITE.
 */
export const getReceivedInvitations = async (): Promise<TontineListItem[]> => {
  try {
    const { url } = ENDPOINTS.TONTINES.INVITATIONS_RECEIVED;
    const response = await apiClient.get<
      | Record<string, unknown>[]
      | { invitations?: Record<string, unknown>[] }
      | { data?: Record<string, unknown>[] }
    >(url);
    const raw = Array.isArray(response.data)
      ? response.data
      : (response.data as { invitations?: unknown[] })?.invitations ??
        (response.data as { data?: unknown[] })?.data ??
        [];
    const items = Array.isArray(raw) ? raw : [];
    return items.map((item) =>
      mapReceivedInvitationToListItem(item as Record<string, unknown>)
    );
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    logger.error('getReceivedInvitations failed');
    throw apiError;
  }
};

/** Map réponse backend invitations/received → TontineListItem (invitationOrigin = INVITE) */
function mapReceivedInvitationToListItem(
  raw: Record<string, unknown>
): TontineListItem {
  const tontine = (raw.tontine ?? raw) as Record<string, unknown>;
  // Priorité tontine.uid : accept/reject attendent tontineUid dans l'URL, pas membership.uid
  const uid = (tontine.uid ?? raw.tontineUid ?? raw.uid) as string;
  return {
    uid: uid || '',
    name: (raw.tontineName ?? tontine.name ?? raw.name ?? '') as string,
    status: (raw.tontineStatus ?? tontine.status ?? raw.status ?? 'ACTIVE') as TontineListItem['status'],
    type: (raw.type ?? tontine.type ?? 'ROTATIVE') as TontineListItem['type'],
    amountPerShare: Number(raw.amountPerShare ?? tontine.amountPerShare ?? 0),
    frequency: (raw.frequency ?? tontine.frequency ?? 'MONTHLY') as TontineListItem['frequency'],
    totalCycles: Number(raw.totalCycles ?? tontine.totalCycles ?? 0),
    currentCycle: null,
    membershipRole: 'MEMBER',
    membershipStatus: 'PENDING',
    hasPaymentDue: false,
    nextPaymentDate: null,
    invitationOrigin: 'INVITE',
  };
}

/**
 * Organisateur approuve une demande d'adhésion PENDING.
 * PATCH /api/v1/tontines/:tontineUid/members/:memberUid/approve
 */
export async function approveMember(
  tontineUid: string,
  memberUid: string
): Promise<void> {
  try {
    const ep = ENDPOINTS.TONTINES.MEMBER_APPROVE(tontineUid, memberUid);
    await apiClient.patch(ep.url);
  } catch (err: unknown) {
    const apiErr = parseApiError(err);
    if (apiErr.code === ApiErrorCode.INVITATION_ALREADY_PROCESSED) {
      return;
    }
    logger.error('[Kelemba] approveMember failed', { tontineUid, memberUid });
    throw err;
  }
}

/**
 * Organisateur refuse une demande d'adhésion PENDING.
 * PATCH /api/v1/tontines/:tontineUid/members/:memberUid/reject
 */
export async function rejectMemberByOrganizer(
  tontineUid: string,
  memberUid: string
): Promise<void> {
  try {
    const ep = ENDPOINTS.TONTINES.MEMBER_REJECT_BY_ORGANIZER(tontineUid, memberUid);
    await apiClient.patch(ep.url);
  } catch (err: unknown) {
    logger.error('[Kelemba] rejectMemberByOrganizer failed', { tontineUid, memberUid });
    throw err;
  }
}

/**
 * Refuser une demande d'adhésion en attente (organisateur).
 * PATCH /api/v1/tontines/:tontineUid/members/:memberUid/reject
 * Délègue à rejectMemberByOrganizer — flux join-request uniquement.
 */
export const rejectPendingMemberRequest = (
  tontineUid: string,
  memberUid: string
): Promise<void> => rejectMemberByOrganizer(tontineUid, memberUid);

/**
 * Détail complet d'une tontine.
 * GET /api/v1/tontines/:uid
 */
export const getTontineDetails = async (
  tontineUid: string
): Promise<TontineDetail> => {
  try {
    const { url } = ENDPOINTS.TONTINES.BY_ID(tontineUid);
    const response = await apiClient.get<TontineDetail>(url);
    return response.data;
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    logger.error('getTontineDetails failed', { tontineUid });
    throw apiError;
  }
};

/**
 * Cycle actif d'une tontine.
 * GET /api/v1/cycles/current/:tontineUid
 * @returns CurrentCycle ou null si aucun cycle actif/à venir (204) ou tontine introuvable (404)
 */
export const getCurrentCycle = async (
  tontineUid: string
): Promise<CurrentCycle | null> => {
  try {
    const { url } = ENDPOINTS.CYCLES.CURRENT(tontineUid);
    const response = await apiClient.get<CurrentCycle>(url);
    // 204 No Content ou body vide = aucun cycle actif/à venir (état métier normal)
    if (response.status === 204 || response.data == null) {
      return null;
    }
    return response.data;
  } catch (err: unknown) {
    // 404 = tontine introuvable OU (rétrocompat) aucun cycle actif — traiter comme état vide
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null;
    }
    const apiError = parseApiError(err);
    logger.error('getCurrentCycle failed', { tontineUid });
    throw apiError;
  }
};

/**
 * Liste des membres d'une tontine avec statut de paiement.
 * GET /api/v1/tontines/:tontineUid/members
 * Normalise role→memberRole et user.uid→userUid (backend vs type TontineMember).
 */
export const getTontineMembers = async (
  tontineUid: string
): Promise<TontineMember[]> => {
  try {
    const { url } = ENDPOINTS.TONTINES.MEMBERS(tontineUid);
    const response = await apiClient.get<Record<string, unknown>[]>(url);
    const raw = Array.isArray(response.data) ? response.data : [];
    return raw.map((item) => {
      const base = item as unknown as TontineMember;
      return {
        ...base,
        memberRole: (item.role ?? item.memberRole ?? base.memberRole) as TontineMember['memberRole'],
        userUid: (
          (item.user as { uid?: string } | undefined)?.uid ?? item.userUid ?? base.userUid
        ) as string,
      };
    });
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    logger.error('getTontineMembers failed', { tontineUid });
    throw apiError;
  }
};

/**
 * Lien d'invitation pour une tontine.
 * GET /api/v1/tontines/:tontineUid/invite-link
 */
export const getInviteLink = async (
  tontineUid: string
): Promise<InviteLinkResponse> => {
  try {
    const { url } = ENDPOINTS.TONTINES.INVITE_LINK(tontineUid);
    const response = await apiClient.get<InviteLinkResponse>(url);
    return response.data;
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    logger.error('getInviteLink failed', { tontineUid });
    throw apiError;
  }
};

/**
 * @deprecated Le backend attend { phone, sharesCount }. Utiliser inviteMemberByPhone.
 * Envoyer une invitation (un seul membre).
 */
export const sendInvitations = async (
  tontineUid: string,
  payload: { phone: string; sharesCount?: number }
): Promise<SendInvitationsResponse> => {
  return inviteMemberByPhone(tontineUid, payload);
};

/**
 * Rotation complète d'une tontine.
 * GET /api/v1/tontines/:tontineUid/rotation
 */
export const getTontineRotation = async (
  tontineUid: string
): Promise<TontineRotationResponse> => {
  try {
    const { url } = ENDPOINTS.TONTINES.ROTATION(tontineUid);
    const response = await apiClient.get<TontineRotationResponse>(url);
    return response.data;
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    logger.error('getTontineRotation failed', { tontineUid });
    throw apiError;
  }
};

/**
 * Tirage au sort de l'ordre de rotation.
 * POST /api/v1/tontines/:tontineUid/rotation/shuffle
 */
export const shuffleRotation = async (tontineUid: string): Promise<void> => {
  try {
    const { url } = ENDPOINTS.TONTINES.ROTATION_SHUFFLE(tontineUid);
    await apiClient.post(url);
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    logger.error('shuffleRotation failed', { tontineUid });
    throw apiError;
  }
};

/**
 * Réordonnancement manuel de la rotation.
 * PATCH /api/v1/tontines/:tontineUid/rotation/reorder
 */
export const reorderRotation = async (
  tontineUid: string,
  payload: ReorderRotationPayload
): Promise<void> => {
  try {
    const { url } = ENDPOINTS.TONTINES.ROTATION_REORDER(tontineUid);
    await apiClient.patch(url, payload);
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    logger.error('reorderRotation failed', { tontineUid });
    throw apiError;
  }
};

/**
 * Lister les demandes d'échange de position.
 * GET /api/v1/tontines/:tontineUid/rotation/swap-requests
 */
export const getSwapRequests = async (
  tontineUid: string
): Promise<RotationSwapRequest[]> => {
  try {
    const { url } = ENDPOINTS.TONTINES.SWAP_REQUESTS(tontineUid);
    const response = await apiClient.get<RotationSwapRequest[]>(url);
    return Array.isArray(response.data) ? response.data : [];
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    logger.error('getSwapRequests failed', { tontineUid });
    throw apiError;
  }
};

/**
 * Créer une demande d'échange de position.
 * POST /api/v1/tontines/:tontineUid/rotation/swap-requests
 */
export const createSwapRequest = async (
  tontineUid: string,
  payload: CreateSwapRequestPayload
): Promise<RotationSwapRequest> => {
  try {
    const { url } = ENDPOINTS.TONTINES.SWAP_REQUESTS_CREATE(tontineUid);
    const response = await apiClient.post<RotationSwapRequest>(url, payload);
    return response.data;
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    logger.error('createSwapRequest failed', { tontineUid });
    throw apiError;
  }
};

/**
 * Approuver ou refuser une demande d'échange.
 * PATCH /api/v1/tontines/:tontineUid/rotation/swap-requests/:requestUid
 */
export const decideSwapRequest = async (
  tontineUid: string,
  requestUid: string,
  payload: DecideSwapRequestPayload
): Promise<void> => {
  try {
    const { url } = ENDPOINTS.TONTINES.SWAP_REQUEST_DECIDE(tontineUid, requestUid);
    await apiClient.patch(url, payload);
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    logger.error('decideSwapRequest failed', { tontineUid, requestUid });
    throw apiError;
  }
};

/**
 * Rapport complet d'une tontine (timeline rotation).
 * GET /api/v1/reports/tontines/:uid/summary
 */
export const getTontineReport = async (
  tontineUid: string
): Promise<TontineReportSummary> => {
  try {
    const { url } = ENDPOINTS.REPORTS.TONTINE_SUMMARY(tontineUid);
    const response = await apiClient.get<TontineReportSummary>(url);
    return response.data;
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    logger.error('getTontineReport failed', { tontineUid });
    throw apiError;
  }
};
