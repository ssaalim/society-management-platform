import { Platform } from 'react-native';

/**
 * The society API. Set EXPO_PUBLIC_API_URL for real builds; in development the Android emulator reaches the
 * computer's localhost as 10.0.2.2.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:4001/api/v1' : 'http://localhost:4001/api/v1');

let token: string | null = null;
let societyId: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setSession(t: string | null, society: string | null) {
  token = t;
  societyId = society;
}
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

/** Calls the API and returns `data` from the `{ success, data }` envelope. Errors carry the server's message. */
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (societyId) headers['x-tenant-id'] = societyId;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method: opts.method || 'GET', headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
  } catch {
    throw new ApiError('No connection. Check your internet and try again.', 0, 'NET-01');
  }
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    if (res.status === 401 && token) onUnauthorized?.();
    const details = Array.isArray(json?.errors) && json.errors.length ? json.errors.map((e: any) => e.message).join(' ') : null;
    const msg = details || (Array.isArray(json?.message) ? json.message.join(' ') : json?.message) || 'Something went wrong. Please try again.';
    throw new ApiError(json?.errorCode ? `${msg} (code ${json.errorCode})` : msg, res.status, json?.errorCode);
  }
  return json?.data as T;
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');
