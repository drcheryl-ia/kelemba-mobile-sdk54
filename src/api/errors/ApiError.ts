import { ApiErrorCode } from './errorCodes';

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    public readonly httpStatus: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static isApiError(err: unknown): err is ApiError {
    return err instanceof ApiError;
  }
}
