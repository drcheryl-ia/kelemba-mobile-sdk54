/**
 * Wrapper logger — actif en __DEV__, erreurs toujours loggées.
 * En production : meta masqué pour les erreurs.
 * console.error déclenche l'intercepteur installErrorFileLogger() pour écriture fichier.
 */
import { getErrorLogPath } from './errorFileLogger';

const isDev = __DEV__;

/* eslint-disable no-console */
export const logger = {
  info: (msg: string, meta?: unknown): void => {
    if (isDev) console.info(`[Kelemba] ${msg}`, meta ?? '');
  },
  warn: (msg: string, meta?: unknown): void => {
    if (isDev) console.warn(`[Kelemba] ${msg}`, meta ?? '');
  },
  error: (msg: string, meta?: unknown): void => {
    const details =
      meta !== undefined
        ? isDev
          ? meta
          : '[details hidden in production]'
        : '';
    if (details !== '') {
      console.error(`[Kelemba] ${msg}`, details);
    } else {
      console.error(`[Kelemba] ${msg}`);
    }
  },
  debug: (msg: string, meta?: unknown): void => {
    if (isDev) console.debug(`[Kelemba] ${msg}`, meta ?? '');
  },
};
/* eslint-enable no-console */

export { getErrorLogPath };
