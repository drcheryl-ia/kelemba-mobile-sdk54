/**
 * Enregistrement des erreurs console — dual-mode :
 * DEV  → envoi HTTP vers le PC (http://172.20.10.5:9999/log)
 * PROD → écriture fichier persistant sur l'appareil
 */
import * as FileSystem from 'expo-file-system';

const LOG_FILE_PATH = `${FileSystem.documentDirectory}kelemba_errors.txt`;
const MAX_FILE_SIZE = 512 * 1024; // 512 KB
const DEV_LOG_SERVER = 'http://172.20.10.5:9999/log';

// Champs sensibles à masquer — OWASP Mobile Top 10
const SENSITIVE_KEYS = ['pin', 'password', 'token', 'otp', 'secret', 'authorization'];

function sanitize(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
      k,
      SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s)) ? '***' : sanitize(v),
    ])
  );
}

function formatEntry(args: unknown[]): { message: string; stack?: string } {
  const first = args[0];
  if (first instanceof Error) {
    return { message: first.message, stack: first.stack };
  }
  const message = args
    .map((a) => (typeof a === 'object' ? JSON.stringify(sanitize(a)) : String(a)))
    .join(' ');
  return { message };
}

// ─── DEV : envoi HTTP vers le PC ─────────────────────────────────────────────

async function sendToDevServer(args: unknown[]): Promise<void> {
  try {
    const { message, stack } = formatEntry(args);
    await fetch(DEV_LOG_SERVER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        message,
        stack,
      }),
    });
  } catch {
    // Silencieux — serveur peut ne pas être démarré
  }
}

// ─── PROD : écriture fichier sur l'appareil ───────────────────────────────────

async function rotateIfNeeded(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(LOG_FILE_PATH, { size: true });
    if (
      info.exists &&
      'size' in info &&
      typeof (info as FileSystem.FileInfo & { size: number }).size === 'number' &&
      (info as FileSystem.FileInfo & { size: number }).size > MAX_FILE_SIZE
    ) {
      await FileSystem.moveAsync({
        from: LOG_FILE_PATH,
        to: LOG_FILE_PATH.replace('.txt', '.old.txt'),
      });
    }
  } catch {
    /* silencieux */
  }
}

async function writeErrorToFile(args: unknown[]): Promise<void> {
  try {
    await rotateIfNeeded();
    const { message, stack } = formatEntry(args);
    const separator = '─'.repeat(60);
    const entry = `[${new Date().toISOString()}] [ERROR] ${message}\n${
      stack ? `  Stack: ${stack}\n` : ''
    }${separator}\n`;
    const existing = await FileSystem.readAsStringAsync(LOG_FILE_PATH).catch(() => '');
    await FileSystem.writeAsStringAsync(LOG_FILE_PATH, existing + entry);
  } catch {
    /* silencieux */
  }
}

// ─── API publique ─────────────────────────────────────────────────────────────

export function getErrorLogPath(): string {
  return LOG_FILE_PATH;
}

export async function clearErrorLog(): Promise<void> {
  await FileSystem.deleteAsync(LOG_FILE_PATH, { idempotent: true });
}

/**
 * Installe l'intercepteur sur console.error.
 * Appeler UNE SEULE FOIS au démarrage dans App.tsx.
 * DEV  → envoi HTTP vers le PC
 * PROD → écriture fichier sur l'appareil
 */
export function installErrorFileLogger(): void {
  const originalError = console.error.bind(console);

  console.error = (...args: unknown[]) => {
    originalError(...args); // Préserver LogBox + Metro

    if (__DEV__) {
      void sendToDevServer(args); // → PC via HTTP
    } else {
      void writeErrorToFile(args); // → fichier appareil
    }
  };
}
