import axios from 'axios';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Don't open the error popup for this request (the caller handles failures itself). */
    skipErrorPopup?: boolean;
  }
}

/**
 * API clients.
 *
 * - apiClient: society workspaces (/<society-slug>/...). Sends the society session token and the society named by
 *   the current URL as x-tenant-id. The society is taken from the URL on every request, never from shared storage,
 *   so two tabs on two societies can't leak into each other, and a URL can only resolve to a society the user
 *   belongs to (the server checks membership again on every request).
 * - platformClient: the platform console (/platform). Uses its own platform-scoped token and sends no society.
 */
let apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1').trim().replace(/\/+$/, '');
if (!apiBase.endsWith('/api/v1')) {
  apiBase = `${apiBase}/api/v1`;
}

export const PLATFORM_TOKEN_KEY = 'platform_token';

/** Top-level paths that are not society slugs. */
const RESERVED_ROOTS = new Set(['', 'login', 'platform', 'admin', '_next', 'api']);

let societyIdsBySlug: Record<string, string> = {};

/** Called by the auth provider whenever memberships load, so URL slugs can be mapped to society ids. */
export function setSocietyDirectory(memberships: { societySlug: string; societyId: string }[]) {
  societyIdsBySlug = Object.fromEntries(memberships.map((m) => [m.societySlug, m.societyId]));
}

/** The society slug in the current URL (/<slug>/...), or null outside a society workspace. */
export function currentSocietySlug(pathname?: string): string | null {
  const path = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  const first = path.split('/')[1] || '';
  return RESERVED_ROOTS.has(first) ? null : decodeURIComponent(first);
}

/** The id of the society named by the current URL, if the user belongs to it. */
export function currentSocietyId(): string | null {
  const slug = currentSocietySlug();
  return slug ? societyIdsBySlug[slug] ?? null : null;
}

/** The API base URL (…/api/v1), for requests made without axios (e.g. streamed responses). */
export const API_BASE = apiBase;

/** The headers apiClient sends: the session token and the society named by the current URL. */
export function societyHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof window === 'undefined') return headers;
  const token = localStorage.getItem('auth_token') || localStorage.getItem('dev_token');
  if (token) headers.Authorization = `Bearer ${token}`;
  const societyId = currentSocietyId();
  if (societyId) headers['x-tenant-id'] = societyId;
  return headers;
}

export const apiClient = axios.create({
  baseURL: apiBase,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('dev_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        // Legacy dev mode sent a raw user id; dev login now returns a signed JWT, which goes in Authorization only.
        const devToken = localStorage.getItem('dev_token');
        if (devToken && !devToken.includes('.')) {
          config.headers['x-dev-user-id'] = devToken;
        }
      }

      const societyId = currentSocietyId();
      if (societyId) {
        config.headers['x-tenant-id'] = societyId;
      } else {
        delete config.headers['x-tenant-id'];
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

/**
 * Server faults (5xx) and network failures open the error popup with the server's code, reference and help, so the
 * user can share it with support. Expected messages (4xx: validation, permissions) stay with the page that asked.
 * A request can opt out with `{ skipErrorPopup: true }` in its config.
 */
function popupOnFault(error: any) {
  if (typeof window === 'undefined' || error?.config?.skipErrorPopup || axios.isCancel(error)) return;
  const res = error?.response;
  const where = `${String(error?.config?.method || 'get').toUpperCase()} ${String(error?.config?.url || '').split('?')[0]}`;
  import('../diagnostics').then(({ buildDetails, classifyClientError, errorCode, showError }) => {
    if (!res) {
      const message = error?.message || 'Network Error';
      showError(buildDetails({ message, code: errorCode(message, where), where, help: classifyClientError(message) }));
      return;
    }
    if (res.status < 500) return;
    const data = res.data || {};
    showError(
      buildDetails({
        message: data.message || `The server could not complete this (${res.status}).`,
        code: data.errorCode || errorCode(String(data.message || res.status), where),
        requestId: data.requestId || null,
        status: res.status,
        where,
        help: data.help || null,
      }),
    );
  });
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    popupOnFault(error);
    return Promise.reject(error);
  },
);

export const platformClient = axios.create({
  baseURL: apiBase,
  headers: {
    'Content-Type': 'application/json',
  },
});

platformClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(PLATFORM_TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

platformClient.interceptors.response.use(
  (response) => response,
  (error) => {
    popupOnFault(error);
    // An expired or revoked platform session goes back to the platform sign-in page.
    const status = error.response?.status;
    if ((status === 401 || status === 403) && typeof window !== 'undefined' && !window.location.pathname.startsWith('/platform/login')) {
      localStorage.removeItem(PLATFORM_TOKEN_KEY);
      window.location.href = '/platform/login';
    }
    return Promise.reject(error);
  },
);

export default apiClient;
