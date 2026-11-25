/**
 * Known problems and what to do about them. Every server or app error is matched to one of these by its message, so
 * the error popup can show a plain-language cause and steps, and support can use the stable ID (DB-01, NET-01 …).
 * Shared idea with RestoPOS's error catalog; this list is for the web platform.
 */
export interface KnownProblem {
  id: string;
  title: string;
  /** Who can fix it: the user themselves, the society office, or the platform team. */
  fixedBy: 'you' | 'office' | 'support';
  cause: string;
  steps: string[];
  match: RegExp;
}

export const KNOWN_PROBLEMS: KnownProblem[] = [
  {
    id: 'DB-01',
    title: 'The database is not reachable right now',
    fixedBy: 'support',
    cause: 'The database server is waking up, restarting or has a network problem.',
    steps: ['Wait a minute and try again.', 'If it keeps happening, send these details to support.'],
    match: /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|connection terminated|Connection terminated|connect ECONN|getaddrinfo|socket hang up|timeout exceeded when trying to connect|CONNECT_TIMEOUT|terminating connection/i,
  },
  {
    id: 'DB-02',
    title: 'The database usage limit has been reached',
    fixedBy: 'support',
    cause: "The hosting plan's monthly database limit (compute time or storage) is used up, so the database is paused.",
    steps: ['Saving and loading data will fail until support raises the limit or the month resets.', 'Send these details to support.'],
    match: /exceeded the (data transfer|compute time|storage) quota|quota exceeded|project size limit|compute time quota|endpoint is disabled/i,
  },
  {
    id: 'DB-03',
    title: 'The data changed while you were saving',
    fixedBy: 'you',
    cause: 'Two people changed the same record at the same moment, or a record you were using was removed.',
    steps: ['Reload the page to see the latest data.', 'Make your change again.'],
    match: /deadlock detected|could not serialize|violates foreign key constraint|duplicate key value violates unique constraint/i,
  },
  {
    id: 'DB-04',
    title: 'The database needs an update',
    fixedBy: 'support',
    cause: 'The app was updated but a database change did not finish (a table or column is missing).',
    steps: ['Send these details to support. The server applies database updates when it restarts.'],
    match: /relation ".*" does not exist|column ".*" (of relation ".*" )?does not exist|undefined column|no such (table|column)/i,
  },
  {
    id: 'NET-01',
    title: 'Cannot reach the server',
    fixedBy: 'you',
    cause: 'Your internet connection dropped, or the server is restarting.',
    steps: ['Check your internet connection.', 'Wait a few seconds and try again.', 'If others in the society have the same problem, send these details to support.'],
    match: /Network Error|Failed to fetch|NetworkError|ERR_NETWORK|ERR_CONNECTION|Load failed|ECONNABORTED/i,
  },
  {
    id: 'NET-02',
    title: 'The server took too long to answer',
    fixedBy: 'you',
    cause: 'A slow connection, or the server is busy.',
    steps: ['Try again.', 'If it keeps happening on the same screen, send these details to support.'],
    match: /timeout of \d+ms exceeded|Gateway Time-?out|504/i,
  },
  {
    id: 'STO-01',
    title: 'File upload failed',
    fixedBy: 'you',
    cause: 'The file is too large, of a type that is not allowed, or the monthly upload limit is reached.',
    steps: ['Use a smaller photo or a PDF under 5 MB.', 'Try again later if the monthly upload limit is reached.', 'Ask the office if it keeps failing.'],
    match: /upload|storage is not configured|R2|monthly (upload|storage) (limit|quota)|exceeds maximum allowed/i,
  },
  {
    id: 'AUTH-01',
    title: 'Your session has ended',
    fixedBy: 'you',
    cause: 'You were signed out (session expired or signed in elsewhere).',
    steps: ['Sign in again.'],
    match: /jwt expired|invalid token|invalid signature|Unauthorized|session expired/i,
  },
  {
    id: 'APP-01',
    title: 'This screen hit a problem',
    fixedBy: 'support',
    cause: 'A bug in the app.',
    steps: ['Try again, or reload the page.', 'If it happens again, send these details to support. Your data is safe.'],
    match: /is not a function|Cannot read propert|undefined is not|is not defined|Unexpected token|Maximum call stack|Minified React error/i,
  },
];

export function classifyError(message: string): KnownProblem | null {
  return KNOWN_PROBLEMS.find((p) => p.match.test(message)) || null;
}

/**
 * Same problem, same code: a hash of the message with numbers, ids and quoted values taken out, plus where it
 * happened (route without ids, or screen).
 */
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
