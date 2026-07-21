import { t } from './i18n';

export const ERROR_CODES = [
  'MODEL_REQUEST_FAILED',
  'API_KEY_MISSING',
  'INVALID_MODEL_CONFIG',
  'NETWORK_ERROR',
  'REQUEST_TIMEOUT',
  'REQUEST_IDLE_TIMEOUT',
  'EMPTY_MODEL_RESPONSE',
  'STREAM_UNAVAILABLE',
  'UNSUPPORTED_PREFERENCE',
  'SETTINGS_SAVE_FAILED',
  'EXTENSION_RELOADED'
] as const;

export type ErrorCode = typeof ERROR_CODES[number];

export interface ErrorResponse {
  ok: false;
  errorCode: ErrorCode;
  errorDetails?: string;
  cancelled?: boolean;
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}

export function getLocalizedError(errorCode: unknown, details?: unknown): string {
  const code = isErrorCode(errorCode) ? errorCode : 'MODEL_REQUEST_FAILED';
  const detail = String(details || '').trim();
  const messageKey = `error_${code.toLowerCase()}`;
  return detail ? t(`${messageKey}_with_details`, detail) : t(messageKey);
}
