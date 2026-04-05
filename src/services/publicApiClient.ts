/**
 * Client HTTP public — aucun header Authorization (endpoints invitation/preview, etc.).
 */
import axios from 'axios';
import { ENV } from '@/config/env';

export const publicApiClient = axios.create({
  baseURL: ENV.API_URL,
  timeout: ENV.API_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});
