/**
 * Helpers validations espèces (organisateur).
 */
const MS_PER_DAY = 86_400_000;

/** Jours écoulés depuis la soumission (ancienneté d’attente). */
export function computeCashDaysWaiting(submittedAt: string): number {
  const t = new Date(submittedAt).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / MS_PER_DAY));
}
