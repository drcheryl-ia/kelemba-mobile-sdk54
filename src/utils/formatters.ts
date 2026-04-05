const fcfaFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'decimal',
  maximumFractionDigits: 0,
});

function formatFcfaNumber(amount: number): string {
  return fcfaFormatter.format(Math.round(amount));
}

/**
 * Formate un entier FCFA avec espace insécable comme séparateur de milliers.
 * Ex: 10000 → "10 000 FCFA" · 500 → "500 FCFA"
 * Jamais de décimaux — montants FCFA sont des entiers.
 * Tolère null/undefined / NaN (réponses API partielles).
 */
export function formatFcfa(amount: number | null | undefined): string {
  if (amount == null) return '—';
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return '—';
  return `${formatFcfaNumber(n)} FCFA`;
}

/**
 * Formate un entier FCFA sans l'unité (pour les affichages en 2 lignes).
 * Ex: 10000 → "10 000"
 */
export function formatFcfaAmount(amount: number): string {
  if (!Number.isFinite(amount)) return '—';
  return formatFcfaNumber(amount);
}

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

/** Date longue (ex: "19 mars 2026") */
export const formatDateLong = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

/** Affichage sécurisé d'un numéro — évite crash si undefined (pour phoneMasked) */
export const formatPhoneSafe = (value?: string | null): string => {
  if (!value || typeof value !== 'string') return 'Numéro indisponible';
  const trimmed = value.trim();
  return trimmed || 'Numéro indisponible';
};

/** Progression cycle : fraction 0–1 ou pourcentage 0–100 → 0–100 pour barre / affichage. */
export function toProgressPct(fraction: number | null | undefined): number {
  if (fraction == null || !Number.isFinite(Number(fraction))) return 0;
  const n = Number(fraction);
  if (n <= 1) return Math.min(100, Math.round(n * 100));
  return Math.min(100, Math.round(n));
}
