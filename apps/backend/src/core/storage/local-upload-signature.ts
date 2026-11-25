import * as crypto from 'crypto';

/** HMAC for local-development upload URLs: binds the storage key, expiry, content type and size limit. */
export function signLocalUpload(secret: string, fileKey: string, expires: number, contentType: string, maxBytes: number): string {
  return crypto.createHmac('sha256', secret).update(`${fileKey}|${expires}|${contentType}|${maxBytes}`).digest('hex');
}

export function verifyLocalUpload(
  secret: string,
  params: { key?: string; exp?: string; type?: string; max?: string; sig?: string },
): { fileKey: string; contentType: string; maxBytes: number } | null {
  const { key, exp, type, max, sig } = params;
  if (!key || !exp || !type || !max || !sig) return null;
  const expires = Number(exp);
  const maxBytes = Number(max);
  if (!Number.isFinite(expires) || expires < Date.now() || !Number.isFinite(maxBytes)) return null;
  // Keys are always societies/<uuid>/<type>/<file>; refuse anything that could escape the uploads folder.
  if (!/^societies\/[0-9a-f-]{36}\/[a-z0-9_]+\/[a-z0-9._-]+$/i.test(key) || key.includes('..')) return null;
  const expected = signLocalUpload(secret, key, expires, type, maxBytes);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { fileKey: key, contentType: type, maxBytes };
}
