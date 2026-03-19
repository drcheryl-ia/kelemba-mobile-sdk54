/**
 * Types API — contrats backend NestJS.
 */

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResponse {
  user: { id: string; phone: string; status: string; kycStatus: string; kelembaScore: number };
  tokens: AuthTokens;
}
