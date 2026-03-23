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
import { normalizeCurrentCycle as normalizeCurrentCycleResponse } from '@/utils/currentCycleNormalizer';
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
import type { PaymentStatus } from '@/types/domain.types';
import type {
  TontineContractPreviewResponse,
  AcceptInvitationWithSignaturePayload,
  CreateJoinRequestWithSignaturePayload,
} from '@/types/contract';

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
 * Aperçu du contrat de tontine (authentifié).
 * GET /api/v1/tontines/:uid/contract-preview
 */
export const getTontineContractPreview = async (
  tontineUid: string
): Promise<TontineContractPreviewResponse> => {
  try {
    const { url } = ENDPOINTS.TONTINES.CONTRACT_PREVIEW(tontineUid);
    const response = await apiClient.get<TontineContractPreviewResponse>(url);
    return response.data;
  } catch (err: unknown) {
    const apiError = parseApiError(err);
    if (apiError.httpStatus === 404) {
      throw new ApiError(ApiErrorCode.TONTINE_NOT_FOUND, 404, apiError.message);
    }
    if (apiError.httpStatus === 403) {
      throw new ApiError(ApiErrorCode.FORBIDDEN, 403, apiError.message);
    }
    logger.error('getTontineContractPreview failed', { tontineUid });
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

function parseCyclePaymentStatus(raw: unknown): PaymentStatus | null {
  if (raw == null || raw === '') return null;
  const s = String(raw);
  const allowed: PaymentStatus[] = [
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'REFUNDED',
  ];
  return allowed.includes(s as PaymentStatus) ? (s as PaymentStatus) : null;
}

function optionalBoolean(v: unknown): boolean | undefined {
  if (v === true || v === false) return v;
  return undefined;
}

/** Date prochain versement : ne pas confondre absent API (`undefined`) et null explicite. */
function optionalNextPaymentDate(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  return String(v).split('T')[0];
}

function optionalFiniteNumber(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function optionalStringDate(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  return String(v).split('T')[0];
}

function optionalStringArray(v: unknown): string[] | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (!Array.isArray(v)) return undefined;
  return v.map((item) => String(item));
}

export function normalizeCurrentCycle(raw: Record<string, unknown>): CurrentCycle {
  return {
    uid: String(raw.uid ?? ''),
    cycleNumber: Number(raw.cycleNumber ?? 0),
    expectedDate: optionalStringDate(raw.expectedDate) ?? '',
    actualPayoutDate: optionalStringDate(raw.actualPayoutDate) ?? null,
    totalAmount:
      optionalFiniteNumber(raw.totalAmount ?? raw.totalExpected ?? raw.collectedAmount) ?? 0,
    collectedAmount: optionalFiniteNumber(raw.collectedAmount) ?? undefined,
    totalExpected: optionalFiniteNumber(raw.totalExpected) ?? undefined,
    collectionProgress: optionalFiniteNumber(raw.collectionProgress) ?? undefined,
    beneficiaryNetAmount:
      optionalFiniteNumber(raw.beneficiaryNetAmount ?? raw.netPayoutAmount) ?? undefined,
    delayedByMemberIds:
      optionalStringArray(raw.delayedByMemberIds ?? raw.delayedByMemberUids) ?? null,
    status: (raw.status ?? 'PENDING') as CurrentCycle['status'],
    beneficiaryMembershipUid:
      raw.beneficiaryMembershipUid != null
        ? String(raw.beneficiaryMembershipUid)
        : null,
  };
}

function normalizeTontineListItem(raw: Record<string, unknown>): TontineListItem {
  const cyclePaymentStatus = parseCyclePaymentStatus(
    raw.currentCyclePaymentStatus ?? raw.paymentStatus ?? raw.memberPaymentStatus
  );
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
    // Ne pas inférer hasPaymentDue depuis la seule date d’échéance : un membre (y compris
    // bénéficiaire du tour) peut avoir une échéance future tout en devant encore cotiser.
    hasPaymentDue: optionalBoolean(raw.hasPaymentDue),
    currentCyclePaymentStatus: cyclePaymentStatus,
    currentDueDate: optionalNextPaymentDate(raw.currentDueDate),
    nextDueDate: optionalNextPaymentDate(raw.nextDueDate),
    nextScheduledCycleDate: optionalNextPaymentDate(raw.nextScheduledCycleDate),
    nextPaymentDate: optionalNextPaymentDate(
      raw.nextPaymentDate ??
        raw.memberNextDueDate ??
        raw.memberPaymentDueDate
    ),
    currentCycleExpectedDate: optionalNextPaymentDate(
      (
        raw.currentCycle as
          | { expectedDate?: string }
          | null
          | undefined
      )?.expectedDate
    ),
    paymentStatus:
      cyclePaymentStatus != null
        ? cyclePaymentStatus
        : raw.paymentStatus != null
          ? String(raw.paymentStatus)
          : undefined,
    daysLeft: optionalFiniteNumber(raw.daysLeft),
    daysOverdue: optionalFiniteNumber(raw.daysOverdue),
    penaltyAmount: optionalFiniteNumber(raw.penaltyAmount),
    totalAmountDue: optionalFiniteNumber(
      raw.totalAmountDue ?? raw.totalDue ?? raw.amountDueTotal
    ),
    userSharesCount:
      optionalFiniteNumber(
        raw.userSharesCount ?? raw.sharesCount ?? raw.memberSharesCount
      ) ?? undefined,
    isCreator: Boolean(raw.isCreator),
    canInvite: Boolean(raw.canInvite),
    startDate: raw.startDate as string | undefined,
    activeMemberCount: (raw.memberCount ?? raw.activeMemberCount) as number | undefined,
    organizerName:
      raw.organizerName != null
        ? String(raw.organizerName)
        : raw.creatorName != null
          ? String(raw.creatorName)
          : raw.inviterName != null
            ? String(raw.inviterName)
            : undefined,
    invitationMessage:
      raw.invitationMessage != null
        ? String(raw.invitationMessage)
        : raw.message != null
          ? String(raw.message)
          : undefined,
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
 * @param payload Si fourni, envoie acceptedTerms, signatureName, contractVersion (et sharesCount?)
 */
export const acceptInvitation = async (
  tontineUid: string,
  sharesCount?: number,
  payload?: AcceptInvitationWithSignaturePayload
): Promise<void> => {
  try {
    const { url } = ENDPOINTS.TONTINES.MEMBERS_ACCEPT(tontineUid);
    const body = payload ?? (sharesCount != null ? { sharesCount } : {});
    await apiClient.post(url, body);
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
 * @param payload Si fourni, envoie acceptedTerms, signatureName, contractVersion (et sharesCount?)
 */
export async function createJoinRequest(
  tontineUid: string,
  sharesCount?: number,
  payload?: CreateJoinRequestWithSignaturePayload
): Promise<void> {
  const { url } = ENDPOINTS.TONTINES.JOIN_REQUESTS(tontineUid);
  const body = payload ?? { sharesCount: sharesCount ?? 1 };
  await apiClient.post(url, body);
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
    startDate:
      (raw.startDate ?? tontine.startDate) != null
        ? String(raw.startDate ?? tontine.startDate)
        : undefined,
    organizerName:
      raw.organizerName != null
        ? String(raw.organizerName)
        : raw.creatorName != null
          ? String(raw.creatorName)
          : raw.inviterName != null
            ? String(raw.inviterName)
            : undefined,
    invitationMessage:
      raw.invitationMessage != null
        ? String(raw.invitationMessage)
        : raw.message != null
          ? String(raw.message)
          : undefined,
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
 * Mettre à jour le nombre de parts d'un membre (tontine DRAFT, organisateur).
 * PATCH /api/v1/tontines/:tontineUid/members/:memberUid/shares
 * Body: { sharesCount: number } (1-5)
 */
export async function updateMemberShares(
  tontineUid: string,
  memberUid: string,
  sharesCount: number
): Promise<void> {
  const { url } = ENDPOINTS.TONTINES.MEMBER_UPDATE_SHARES(tontineUid, memberUid);
  await apiClient.patch(url, { sharesCount });
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
    const response = await apiClient.get<Record<string, unknown> | null>(url);
    // 204 No Content ou body vide = aucun cycle actif/à venir (état métier normal)
    if (response.status === 204 || response.data == null) {
      return null;
    }
    return normalizeCurrentCycleResponse(response.data);
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

/** Réponse paginée GET /api/v1/tontines/:tontineUid/members */
interface MembersApiResponse {
  items?: Array<{
    uid: string;
    userUid?: string;
    fullName?: string;
    phone?: string;
    phoneMasked?: string;
    kelembScore?: number;
    memberRole?: string;
    membershipStatus?: string;
    role?: string;
    sharesCount?: number;
    rotationOrder?: number;
    currentCyclePaymentStatus?: string | null;
    signedAt?: string | null;
    paidAmount?: number;
    [key: string]: unknown;
  }>;
  total?: number;
  tontineUid?: string;
  tontineName?: string;
  totalShares?: number;
}

/**
 * Liste des membres d'une tontine avec statut de paiement.
 * GET /api/v1/tontines/:tontineUid/members
 * La réponse est paginée : response.data.items contient le tableau.
 * Champs plats backend : memberRole, membershipStatus, userUid, fullName.
 */
export const getTontineMembers = async (
  tontineUid: string
): Promise<TontineMember[]> => {
  try {
    const { url } = ENDPOINTS.TONTINES.MEMBERS(tontineUid);
    const response = await apiClient.get<MembersApiResponse | Record<string, unknown>[]>(url);

    // Règle 1 : lire response.data.items (réponse paginée) ou fallback sur array direct (rétrocompat)
    const rawItems = Array.isArray(response.data)
      ? response.data
      : (response.data as MembersApiResponse)?.items ?? [];

    return rawItems.map((item) => {
      const raw = item as Record<string, unknown>;
      return {
        uid: String(raw.uid ?? ''),
        userUid: String(raw.userUid ?? (raw.user as { uid?: string } | undefined)?.uid ?? ''),
        fullName: String(raw.fullName ?? ''),
        phone: String(raw.phone ?? raw.phoneMasked ?? ''),
        sharesCount: Number(raw.sharesCount ?? 1),
        rotationOrder: Number(raw.rotationOrder ?? 0),
        memberRole: (raw.memberRole ?? raw.role ?? 'MEMBER') as TontineMember['memberRole'],
        membershipStatus: (raw.membershipStatus ?? raw.status ?? 'ACTIVE') as TontineMember['membershipStatus'],
        kelembScore: Number(raw.kelembScore ?? 0),
        currentCyclePaymentStatus: (raw.currentCyclePaymentStatus as TontineMember['currentCyclePaymentStatus']) ?? null,
        paidAmount: Number(raw.paidAmount ?? 0),
        signedAt: (raw.signedAt as string | null) ?? null,
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
