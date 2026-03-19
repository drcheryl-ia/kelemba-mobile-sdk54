/**
 * Utilitaires avatar — initiales et couleur par hash.
 */

const AVATAR_COLORS = [
  '#1A6B3C',
  '#F5A623',
  '#0055A5',
  '#9E9E9E',
  '#6B7280',
  '#D0021B',
];

function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function getInitials(name: string): string {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function hashToColor(seed: string): string {
  if (!seed || typeof seed !== 'string') return AVATAR_COLORS[0];
  const idx = simpleHash(seed) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}
