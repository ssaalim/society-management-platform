/**
 * Error capture for troubleshooting (same idea as RestoPOS):
 *   - every error gets a short code (E-1A2B); the same problem always gets the same code;
 *   - the server keeps its own errors under the code it returns; app crashes are reported to /support/client-errors;
 *   - the error popup shows the code, the request reference and the last few steps, ready to copy or share with support.
 */
import { API_BASE, societyHeaders, currentSocietyId } from './api/client';

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';
export const ERROR_EVENT = 'housive:error';

export interface KnownProblem {
  id: string;
  title: string;
  cause: string;
  steps: string[];
  fixedBy?: 'you' | 'office' | 'support';
}

export interface ErrorDetails {
  title: string;
  message: string;
  code: string | null;
  requestId?: string | null;
  status?: number | null;
  where?: string | null;
  help?: KnownProblem | null;
  time: string;
  page: string;
  version: string;
  society?: string | null;
  user?: string | null;
  steps: string[];
  /** A crash of the whole screen (shown on the crash page, not as a popup). */
  crash?: boolean;
}

// ---------- Recent steps ("breadcrumbs") ----------
const crumbs: string[] = [];
const clock = () => new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
export function crumb(what: string) {
  crumbs.push(`${clock()} ${what.replace(/\s+/g, ' ').slice(0, 100)}`);
  if (crumbs.length > 30) crumbs.shift();
}
export const recentSteps = () => crumbs.slice(-15);

// ---------- Codes ----------
/** Same problem, same code: hash of the message (numbers, ids and quoted text removed) and where it happened. */
export function errorCode(message: string, where = ''): string {
  const norm = (s: string) =>
    s
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
      .replace(/\d+/g, '#')
      .replace(/["'`].*?["'`]/g, '…')
      .slice(0, 200);
  const key = `${norm(message)}|${norm(where).split('?')[0]}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return `E-${((h >>> 0) % 0xffff).toString(16).toUpperCase().padStart(4, '0')}`;
}

/** Problems the app can explain without the server (mirrors the server's catalog). */
const CLIENT_PROBLEMS: (KnownProblem & { match: RegExp })[] = [
  {
    id: 'NET-01',
    title: 'Cannot reach the server',
    fixedBy: 'you',
    cause: 'Your internet connection dropped, or the server is restarting.',
    steps: ['Check your internet connection.', 'Wait a few seconds and try again.', 'If others in the society have the same problem, send these details to support.'],
    match: /Network Error|Failed to fetch|NetworkError|ERR_NETWORK|ERR_CONNECTION|Load failed/i,
  },
  {
    id: 'NET-02',
    title: 'The server took too long to answer',
    fixedBy: 'you',
    cause: 'A slow connection, or the server is busy.',
    steps: ['Try again.', 'If it keeps happening on the same screen, send these details to support.'],
    match: /timeout of \d+ms exceeded|ECONNABORTED|Gateway Time-?out/i,
  },
  {
    id: 'APP-01',
    title: 'This screen hit a problem',
    fixedBy: 'support',
    cause: 'A bug in the app.',
    steps: ['Try again, or reload the page.', 'If it happens again, send these details to support. Your data is safe.'],
    match: /./,
  },
];
export const classifyClientError = (message: string): KnownProblem | null => {
  const p = CLIENT_PROBLEMS.find((x) => x.match.test(message));
  return p ? { id: p.id, title: p.title, cause: p.cause, steps: p.steps, fixedBy: p.fixedBy } : null;
};

// ---------- Context ----------
let signedInUser: string | null = null;
/** The auth provider tells us who is signed in (shown in error reports). */
export const setDiagnosticsUser = (u: string | null) => {
  signedInUser = u;
};
const who = () => ({ user: signedInUser, society: currentSocietyId() });

export function buildDetails(p: Partial<ErrorDetails> & { message: string; title?: string }): ErrorDetails {
  const w = who();
  return {
    title: p.title || p.help?.title || 'Something went wrong',
    message: p.message,
    code: p.code ?? null,
    requestId: p.requestId ?? null,
    status: p.status ?? null,
    where: p.where ?? null,
    help: p.help ?? null,
    time: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    page: typeof location !== 'undefined' ? location.pathname : '',
    version: APP_VERSION,
    society: p.society ?? w.society,
    user: p.user ?? w.user,
    steps: p.steps ?? recentSteps(),
    crash: p.crash,
  };
}

/** The text a user copies or shares with support. */
export function detailsText(d: ErrorDetails): string {
  return [
    `Housive error report`,
    `Code: ${d.code || '—'}${d.help ? ` (${d.help.id}: ${d.help.title})` : ''}`,
    `Reference: ${d.requestId || '—'}`,
    `Message: ${d.message}`,
    d.status ? `Status: ${d.status}` : null,
    d.where ? `Where: ${d.where}` : null,
    `Page: ${d.page}`,
    `Time: ${d.time}`,
    `App version: ${d.version}`,
    d.society ? `Society: ${d.society}` : null,
    d.user ? `User: ${d.user}` : null,
    d.steps.length ? `Last steps:\n${d.steps.map((s) => `  ${s}`).join('\n')}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

// ---------- Showing and reporting ----------
const shownAt = new Map<string, number>();
/** Opens the error popup (the same code is not shown again within 10 s). */
export function showError(d: ErrorDetails) {
  if (typeof window === 'undefined') return;
  const key = d.code || d.message;
  if (Date.now() - (shownAt.get(key) || 0) < 10_000) return;
  shownAt.set(key, Date.now());
  window.dispatchEvent(new CustomEvent<ErrorDetails>(ERROR_EVENT, { detail: d }));
}

const reportedAt = new Map<string, number>();
/** Sends an app-side error to the server's error log; returns its code. Never throws. */
export async function reportClientError(err: unknown, o: { level?: 'error' | 'crash'; where?: string; context?: Record<string, unknown> } = {}): Promise<string> {
  const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err));
  const where = o.where || (typeof location !== 'undefined' ? location.pathname.replace(/\/[^/]+/, '/:society') : '');
  const code = errorCode(e.message, where);
  crumb(`ERROR ${code} ${e.message}`);
  if (Date.now() - (reportedAt.get(code) || 0) < 5_000) return code;
  reportedAt.set(code, Date.now());
  try {
    await fetch(`${API_BASE}/support/client-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...societyHeaders() },
      body: JSON.stringify({
        code,
        level: o.level || 'error',
        message: e.message.slice(0, 2000),
        stack: e.stack?.slice(0, 6000) || null,
        where,
        page: typeof location !== 'undefined' ? location.pathname : null,
        version: APP_VERSION,
        societyId: currentSocietyId(),
        steps: recentSteps(),
        context: o.context || null,
      }),
      keepalive: true,
    });
  } catch {
    /* offline: the user still sees the code */
  }
  return code;
}

let installed = false;
/** Catches what screens don't (script errors, unhandled promises) and records clicks as steps. */
export function installErrorCapture() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (ev) => {
    if (!ev.error && !ev.message) return;
    const err = ev.error || new Error(ev.message);
    void reportClientError(err, { context: { file: ev.filename, line: ev.lineno } });
  });
  window.addEventListener('unhandledrejection', (ev) => {
    // Failed API calls are already shown by the API client.
    if ((ev.reason as any)?.isAxiosError) return;
    void reportClientError(ev.reason);
  });
  window.addEventListener(
    'click',
    (ev) => {
      const el = (ev.target as HTMLElement | null)?.closest('button, a, [role=button], [role=tab], input[type=checkbox]') as HTMLElement | null;
      if (!el) return;
      const label = el.getAttribute('aria-label') || el.innerText || el.title || el.tagName;
      crumb(`click "${label.trim().slice(0, 40)}"`);
    },
    true,
  );
}
