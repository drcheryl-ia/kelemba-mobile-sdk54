/**
 * Formateurs FCFA (XAF) — montants entiers, pas de centimes.
 */
export const formatFcfa = (amount: number): string => {
  return `${amount.toLocaleString('fr-FR')} FCFA`;
};

export const parseFcfa = (value: string): number => {
  const cleaned = value.replace(/\s|FCFA|XAF/gi, '').replace(/\s/g, '').replace(',', '.');
  return Math.round(parseFloat(cleaned) || 0);
};

/** Masque un numéro : "+236 ·· ·· XX XX" */
export const maskPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return phone;
  const last4 = digits.slice(-4);
  const prefix = digits.startsWith('236') ? '+236' : '+···';
  return `${prefix} ·· ·· ${last4.slice(0, 2)} ${last4.slice(2, 4)}`;
};

/** Affichage sécurisé d'un numéro — évite crash si undefined (pour phoneMasked) */
export const formatPhoneSafe = (value?: string | null): string => {
  if (!value || typeof value !== 'string') return 'Numéro indisponible';
  const trimmed = value.trim();
  return trimmed || 'Numéro indisponible';
};
