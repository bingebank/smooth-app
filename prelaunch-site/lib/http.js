/**
 * Small HTTP helpers shared by the Pages Functions.
 */

export const json = (data, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });

export const ok = (message, extra = {}) => json({ ok: true, message, ...extra });
export const fail = (error, status = 400) => json({ ok: false, error }, status);

/** Client IP as seen by Cloudflare. */
export const clientIp = (request) =>
  request.headers.get('cf-connecting-ip') ||
  request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
  '0.0.0.0';

/** Parse a JSON body, returning null instead of throwing. */
export async function readJson(request) {
  if (!request.headers.get('content-type')?.includes('application/json')) return null;
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : null;
  } catch {
    return null;
  }
}

/** Collapse whitespace and clamp length. */
export const clean = (value, max) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** Keep newlines (for message bodies) but clamp length. */
export const cleanMultiline = (value, max) =>
  typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim().slice(0, max) : '';

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;

export const isEmail = (value) =>
  typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value);

/**
 * Fixed-window rate limit backed by the RATE_LIMIT KV namespace.
 * Without the binding this is a no-op, so the site still works before KV is set up.
 *
 * @returns {Promise<boolean>} true when the request is allowed.
 */
export async function rateLimit(env, key, { limit = 8, windowSeconds = 600 } = {}) {
  if (!env.RATE_LIMIT) return true;
  const bucket = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSeconds)}`;
  const current = Number(await env.RATE_LIMIT.get(bucket)) || 0;
  if (current >= limit) return false;
  await env.RATE_LIMIT.put(bucket, String(current + 1), { expirationTtl: windowSeconds + 60 });
  return true;
}
