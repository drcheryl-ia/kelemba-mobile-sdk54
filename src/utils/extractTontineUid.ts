/**
 * Extrait l’UID tontine depuis un lien d’invitation, un deep link ou un UUID seul.
 */
export function extractTontineUid(input: string): string | null {
  const patterns = [
    /kelemba\.app\/join\/([0-9a-f-]{36})/i,
    /kelemba:\/\/join\/([0-9a-f-]{36})/i,
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
  ];
  const trimmed = input.trim();
  for (const p of patterns) {
    const m = trimmed.match(p);
    if (m) return m[1];
  }
  return null;
}
