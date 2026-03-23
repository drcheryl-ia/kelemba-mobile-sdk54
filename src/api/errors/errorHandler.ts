import axios from 'axios';
import { ApiError } from './ApiError';
import { ApiErrorCode } from './errorCodes';
import { inferCodeFromHttpMessage } from './inferHttpErrorCode';
import { logger } from '@/utils/logger';

const SENSITIVE_FIELDS = [
  'pin',
  'password',
  'token',
  'refreshToken',
  'accessToken',
  'otp',
  'secret',
  'securityConfirmationToken',
] as const;

function maskSensitiveBody(body: Record<string, unknown>): Record<string, unknown> {
  const masked = { ...body };
  for (const field of SENSITIVE_FIELDS) {
    if (field in masked) {
      masked[field] = '***';
    }
  }
  return masked;
}

function getSafeBody(rawBody: unknown): unknown {
  if (rawBody == null) return null;
  try {
    const parsed =
      typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return maskSensitiveBody(parsed as Record<string, unknown>);
    }
    return parsed;
  } catch {
    return '[non-parsable]';
  }
}

export { inferCodeFromHttpMessage } from './inferHttpErrorCode';

export function parseApiError(err: unknown): ApiError {
  if (ApiError.isApiError(err)) return err;

  if (axios.isAxiosError(err)) {
    if (!err.response) {
      const fullUrl = err.config?.url ?? 'URL inconnue';
      const method = (err.config?.method ?? 'UNKNOWN').toUpperCase();
      const isTimeout = err.code === 'ECONNABORTED';
      logger.error(`[NETWORK] ${method} ${fullUrl} — Aucune réponse`, {
        code: err.code,
        message: err.message,
        fullUrl,
        method,
      });
      return new ApiError(
        isTimeout ? ApiErrorCode.TIMEOUT : ApiErrorCode.NETWORK_ERROR,
        0,
        err.message
      );
    }

    const status = err.response.status;
    const data = err.response.data as Record<string, unknown> | undefined;
    const rawCode = data?.code as string | undefined;

    const messageRaw = data?.message;
    const message =
      typeof messageRaw === 'string'
        ? messageRaw
        : Array.isArray(messageRaw)
          ? messageRaw.join('; ')
          : messageRaw != null && typeof messageRaw === 'object'
            ? JSON.stringify(messageRaw)
            : (err.message ?? 'Unknown error');

    let code: ApiErrorCode =
      rawCode && Object.values(ApiErrorCode).includes(rawCode as ApiErrorCode)
        ? (rawCode as ApiErrorCode)
        : mapHttpStatusToCode(status);

    const inferred = inferCodeFromHttpMessage(message, status);
    if (
      inferred &&
      (!rawCode ||
        !Object.values(ApiErrorCode).includes(rawCode as ApiErrorCode) ||
        code === ApiErrorCode.UNKNOWN ||
        code === ApiErrorCode.VALIDATION_ERROR)
    ) {
      code = inferred;
    }

    const fullUrl = err.config?.baseURL
      ? `${err.config.baseURL}${err.config.url ?? ''}`
      : (err.config?.url ?? 'URL inconnue');
    const method = (err.config?.method ?? 'UNKNOWN').toUpperCase();
    const safeBody = getSafeBody(err.config?.data);

    const validationErrors = Array.isArray(messageRaw)
      ? messageRaw
      : (data?.errors ?? data?.details ?? null);

    const requestId = (err.response.headers as Record<string, string>)?.[
      'x-request-id'
    ] ?? null;

    const startStr = (err.config?.headers as Record<string, string>)?.[
      'x-request-start'
    ];
    const duration = startStr
      ? `${Date.now() - Number(startStr)}ms`
      : null;

    logger.error(`[API ${status}] ${method} ${fullUrl}`, {
      status,
      code,
      message,
      fullUrl,
      method,
      requestBody: safeBody,
      validationErrors,
      responseBody: data,
      requestId,
      duration,
    });

    const details = (data?.details as Record<string, unknown> | undefined) ?? undefined;
    return new ApiError(code, status, message, details);
  }

  const message = err instanceof Error ? err.message : 'Unknown error';
  logger.error('[UNKNOWN ERROR]', { message, raw: String(err) });
  return new ApiError(ApiErrorCode.UNKNOWN, 0, message);
}

function mapHttpStatusToCode(status: number): ApiErrorCode {
  const map: Record<number, ApiErrorCode> = {
    400: ApiErrorCode.VALIDATION_ERROR,
    401: ApiErrorCode.TOKEN_EXPIRED,
    403: ApiErrorCode.FORBIDDEN,
    404: ApiErrorCode.NOT_FOUND,
    409: ApiErrorCode.CONFLICT,
    422: ApiErrorCode.VALIDATION_ERROR,
    429: ApiErrorCode.RATE_LIMITED,
    500: ApiErrorCode.SERVER_ERROR,
    502: ApiErrorCode.SERVER_ERROR,
    503: ApiErrorCode.PROVIDER_UNAVAILABLE,
  };
  return map[status] ?? ApiErrorCode.UNKNOWN;
}
