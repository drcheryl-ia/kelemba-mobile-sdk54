import { ApiErrorCode } from './errorCodes';

interface ErrorMessage {
  fr: string;
  sango: string;
  severity: 'error' | 'warning' | 'info';
}

export const ERROR_MESSAGES: Record<ApiErrorCode, ErrorMessage> = {
  [ApiErrorCode.INVALID_CREDENTIALS]: {
    fr: 'Numéro ou PIN incorrect. Vérifiez vos identifiants.',
    sango: 'Numéro wala PIN âla pîka. Kpékôlï tî mbênî.',
    severity: 'error',
  },
  [ApiErrorCode.ACCOUNT_SUSPENDED]: {
    fr: 'Votre compte est suspendu. Contactez le support.',
    sango: 'Compte nî a lègê. Kôlï support.',
    severity: 'error',
  },
  [ApiErrorCode.ACCOUNT_BANNED]: {
    fr: 'Votre compte a été banni suite à des violations répétées.',
    sango: 'Compte nî a gbû tî violation.',
    severity: 'error',
  },
  [ApiErrorCode.TOKEN_EXPIRED]: {
    fr: 'Session expirée. Veuillez vous reconnecter.',
    sango: 'Session a fini. Kôlï biani.',
    severity: 'warning',
  },
  [ApiErrorCode.TOKEN_INVALID]: {
    fr: 'Session invalide. Veuillez vous reconnecter.',
    sango: 'Session âla pîka. Kôlï biani.',
    severity: 'warning',
  },
  [ApiErrorCode.OTP_INVALID]: {
    fr: 'Code incorrect. Vérifiez le SMS reçu.',
    sango: 'Code âla pîka. Kpékôlï SMS.',
    severity: 'error',
  },
  [ApiErrorCode.OTP_EXPIRED]: {
    fr: 'Code expiré. Demandez un nouveau code.',
    sango: 'Code a fini. Kôlï code yângâ.',
    severity: 'warning',
  },
  [ApiErrorCode.OTP_MAX_ATTEMPTS_EXCEEDED]: {
    fr: '3 tentatives épuisées. Demandez un nouveau code.',
    sango: '3 tentatives a fini. Kôlï code yângâ.',
    severity: 'error',
  },
  [ApiErrorCode.OTP_RATE_LIMIT_EXCEEDED]: {
    fr: 'Trop de tentatives. Réessayez plus tard.',
    sango: 'Tentatives tî nzoni. Kôlï biani na ndeke.',
    severity: 'warning',
  },
  [ApiErrorCode.PHONE_ALREADY_USED]: {
    fr: 'Ce numéro est déjà associé à un compte.',
    sango: 'Numéro nî a tene compte.',
    severity: 'error',
  },
  [ApiErrorCode.CONFLICT]: {
    fr: "Cette action entre en conflit avec l'état actuel (opération déjà en cours ou ressource verrouillée). Réessayez.",
    sango: 'Action nî a yeke conflit na état. Kôlï biani.',
    severity: 'warning',
  },
  [ApiErrorCode.KYC_NOT_VERIFIED]: {
    fr: "Vérification d'identité requise avant cette action.",
    sango: 'KYC ayeke ti do tî action nî.',
    severity: 'warning',
  },
  [ApiErrorCode.ALREADY_ORGANIZER]: {
    fr: 'Votre compte est déjà de type Organisateur.',
    sango: 'Konti na yângâ a yeke Organisateur.',
    severity: 'info',
  },
  [ApiErrorCode.TONTINE_FULL]: {
    fr: 'Cette tontine a atteint le nombre maximum de membres (50).',
    sango: 'Tontine nî a tîngbi membres 50.',
    severity: 'warning',
  },
  [ApiErrorCode.TONTINE_ALREADY_MEMBER]: {
    fr: 'Vous êtes déjà membre de cette tontine.',
    sango: 'Ala membre tî tontine nî.',
    severity: 'info',
  },
  [ApiErrorCode.INVITATION_ALREADY_PROCESSED]: {
    fr: 'Invitation déjà traitée.',
    sango: 'Invitation a fa.',
    severity: 'info',
  },
  [ApiErrorCode.INVITATION_NOT_FOUND]: {
    fr: "Aucune invitation nominative trouvée. Utilisez le lien ou le QR Code pour envoyer une demande d'adhésion.",
    sango: 'Invitation âla yeke. Zîa lien wala QR Code tî sâra demande.',
    severity: 'warning',
  },
  [ApiErrorCode.INVITATION_ALREADY_PENDING]: {
    fr: 'Une invitation est déjà en attente pour cet utilisateur.',
    sango: 'Invitation a yeke gbâ tî do nî.',
    severity: 'warning',
  },
  [ApiErrorCode.USER_NOT_FOUND]: {
    fr: 'Utilisateur non inscrit sur Kelemba.',
    sango: 'Do âla yeke na Kelemba.',
    severity: 'warning',
  },
  [ApiErrorCode.INVALID_PHONE_FORMAT]: {
    fr: 'Format du numéro de téléphone invalide.',
    sango: 'Numéro tî sâra âla pîka.',
    severity: 'error',
  },
  [ApiErrorCode.ALREADY_MEMBER]: {
    fr: 'Cet utilisateur est déjà membre de cette tontine.',
    sango: 'Do nî a yeke membre tî tontine nî.',
    severity: 'info',
  },
  [ApiErrorCode.CANDIDATE_KYC_NOT_VERIFIED]: {
    fr: "L'identité du candidat n'est pas vérifiée. Demandez-lui de compléter son KYC.",
    sango: 'KYC tî candidat âla yeke. Kôlï sâra KYC.',
    severity: 'warning',
  },
  [ApiErrorCode.TONTINE_NOT_FOUND]: {
    fr: "Cette tontine n'est plus disponible.",
    sango: 'Tontine nî a yeke ala.',
    severity: 'error',
  },
  [ApiErrorCode.ROTATION_ALREADY_CHANGED]: {
    fr: "L'ordre de rotation ne peut être modifié qu'une seule fois.",
    sango: 'Ordre tî rotation a yeke modifié kêtê.',
    severity: 'warning',
  },
  [ApiErrorCode.NOT_TONTINE_CREATOR]: {
    fr: 'Seul le créateur peut effectuer cette action.',
    sango: 'Créateur peko a fa action nî.',
    severity: 'error',
  },
  [ApiErrorCode.INSUFFICIENT_MEMBERS]: {
    fr: "Pas assez de membres actifs pour cette action (minimum requis par les règles de la tontine).",
    sango: 'Membres ayeke tîngbi tî action nî.',
    severity: 'warning',
  },
  [ApiErrorCode.ALREADY_INITIALIZED]: {
    fr: 'Les cycles ont déjà été initialisés pour cette tontine.',
    sango: 'Cycles a yeke initialisé na tontine nî.',
    severity: 'info',
  },
  [ApiErrorCode.INSUFFICIENT_FUNDS]: {
    fr: 'Solde insuffisant pour effectuer ce paiement.',
    sango: 'Lï âla tîngbi tî paiement nî.',
    severity: 'error',
  },
  [ApiErrorCode.PAYMENT_FAILED]: {
    fr: 'Paiement échoué. Vérifiez votre solde Mobile Money.',
    sango: 'Paiement a gbû. Kpékôlï lï Mobile Money.',
    severity: 'error',
  },
  [ApiErrorCode.PAYMENT_DUPLICATE]: {
    fr: 'Ce paiement a déjà été effectué.',
    sango: 'Paiement nî a yeke fâ.',
    severity: 'warning',
  },
  [ApiErrorCode.PROVIDER_UNAVAILABLE]: {
    fr: 'Service Mobile Money indisponible. Réessayez dans quelques minutes.',
    sango: 'Mobile Money a yeke ala sêse. Kôlï biani na ndeke.',
    severity: 'warning',
  },
  [ApiErrorCode.NETWORK_ERROR]: {
    fr: 'Pas de connexion. Vérifiez votre réseau.',
    sango: 'Réseau âla yeke. Kpékôlï réseau nî.',
    severity: 'warning',
  },
  [ApiErrorCode.TIMEOUT]: {
    fr: 'La requête a pris trop de temps. Réessayez.',
    sango: 'Requête a yeke ndeke tî nzoni. Kôlï biani.',
    severity: 'warning',
  },
  [ApiErrorCode.SERVER_ERROR]: {
    fr: 'Erreur serveur. Nos équipes ont été notifiées.',
    sango: 'Erreur serveur. Équipe nî a yeke kôlï.',
    severity: 'error',
  },
  [ApiErrorCode.FORBIDDEN]: {
    fr: "Accès refusé. Vous n'avez pas les permissions requises.",
    sango: 'Accès a gbû. Permission âla yeke.',
    severity: 'error',
  },
  [ApiErrorCode.NOT_FOUND]: {
    fr: 'Ressource introuvable.',
    sango: 'Ressource âla yeke.',
    severity: 'error',
  },
  [ApiErrorCode.RATE_LIMITED]: {
    fr: 'Trop de tentatives. Attendez quelques minutes.',
    sango: 'Tentatives tî nzoni. Yeke ndeke na ndeke.',
    severity: 'warning',
  },
  [ApiErrorCode.VALIDATION_ERROR]: {
    fr: 'Les données envoyées sont invalides. Vérifiez les champs et réessayez.',
    sango: 'Données âla pîka. Kpékôlï na kôlï biani.',
    severity: 'error',
  },
  [ApiErrorCode.SECURITY_CONFIRMATION_REQUIRED]: {
    fr: 'Confirmation de sécurité requise avant le versement. Saisissez votre PIN.',
    sango: 'Confirmation sécurité ayeke ti do na mbongo. Biani PIN.',
    severity: 'warning',
  },
  [ApiErrorCode.SECURITY_CONFIRMATION_INVALID]: {
    fr: 'La confirmation de sécurité est invalide ou expirée. Réessayez avec votre PIN.',
    sango: 'Confirmation sécurité âla pîka wala a fini. Kôlï PIN.',
    severity: 'error',
  },
  [ApiErrorCode.UNKNOWN]: {
    fr: "Une erreur inattendue s'est produite. Réessayez.",
    sango: 'Erreur âla pîka a yeke. Kôlï biani.',
    severity: 'error',
  },
};
