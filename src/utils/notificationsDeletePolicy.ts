/**
 * Politique suppression — notifications
 *
 * Le contrat OpenAPI du projet (api-contract.json) n’expose pas d’endpoint DELETE
 * pour une notification utilisateur. Toute suppression « réelle » devra appeler
 * un futur endpoint (ex. DELETE /api/v1/notifications/{uid}) une fois disponible.
 *
 * L’UI mobile peut masquer localement une ligne (session) pour le confort utilisateur ;
 * ce masquage ne supprime rien côté serveur.
 */
export const NOTIFICATION_DELETE_API_AVAILABLE = false;
