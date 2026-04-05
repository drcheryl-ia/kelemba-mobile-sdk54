import type { InternalAxiosRequestConfig } from 'axios';

/**
 * URL complète pour logs / erreurs — évite `baseURL + url` quand `url` est déjà absolue
 * (sinon concaténation du type `.../apihttp://...`).
 */
export function buildRequestLogUrl(
  config: InternalAxiosRequestConfig | undefined
): string {
  if (config == null) return 'URL inconnue';
  const base = config.baseURL ?? '';
  const u = config.url ?? '';
  if (!u) return base;
  if (/^https?:\/\//i.test(u)) return u;
  const baseTrim = base.replace(/\/$/, '');
  const path = u.startsWith('/') ? u : `/${u}`;
  return `${baseTrim}${path}`;
}
