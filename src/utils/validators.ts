import { MIN_PART_AMOUNT_FCFA } from './constants';

/**
 * Validation des montants — minimum 500 FCFA par part (CLAUDE.md).
 */
export const isValidPartAmount = (amount: number): boolean => {
  return Number.isInteger(amount) && amount >= MIN_PART_AMOUNT_FCFA;
};

/**
 * Validation PIN 6 chiffres.
 */
export const isValidPin = (pin: string): boolean => {
  return /^\d{6}$/.test(pin);
};

/**
 * Normalise un numéro RCA au format +236XXXXXXXX.
 * @throws Error si format invalide
 */
export function normalizeRcPhone(input: string): string {
  const digits = input.replace(/\D/g, '');

  if (digits.length === 8) {
    return `+236${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('236')) {
    return `+${digits}`;
  }

  if (input.startsWith('+236') && /^\+236\d{8}$/.test(input.replace(/\s/g, ''))) {
    return input.replace(/\s/g, '');
  }

  throw new Error('Numéro RCA invalide. Format attendu : +236 suivi de 8 chiffres.');
}

/**
 * Validation UUID v4.
 */
export const isValidUuid = (id: string): boolean => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};
