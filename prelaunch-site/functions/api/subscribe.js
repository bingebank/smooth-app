import { ok, fail, clientIp, readJson, clean, isEmail, rateLimit } from '../../lib/http.js';
import { verifyCaptcha } from '../../lib/captcha.js';
import { sendSubscriberWelcome, sendSignupNotification } from '../../lib/notify.js';

const PLATFORMS = new Set(['ios', 'android', 'both']);

export async function onRequestPost({ request, env }) {
  const ip = clientIp(request);

  const body = await readJson(request);
  if (!body) return fail('Malformed request.');

  // Honeypot: a real browser never fills a field it cannot see.
  // Answer exactly as we would a success, so bots learn nothing.
  if (clean(body.company, 100)) {
    return ok("You're on the list. We'll email you the moment the beta opens.");
  }

  const email = clean(body.email, 254).toLowerCase();
  const name = clean(body.name, 60);
  const platform = PLATFORMS.has(body.platform) ? body.platform : 'both';
  const source = clean(body.source, 60) || 'site';

  if (!isEmail(email)) return fail('Please enter a valid email address.');

  if (!await rateLimit(env, `sub:${ip}`, { limit: 6, windowSeconds: 600 })) {
    return fail('Too many sign-ups from this connection. Please try again later.', 429);
  }

  if (!await verifyCaptcha(env, ip, body.captcha)) {
    return fail("That verification didn't check out. Please try the question again.");
  }

  if (!env.DB) {
    console.error('subscribe: D1 binding "DB" is missing — sign-up dropped');
    return fail('Sign-ups are temporarily unavailable. Please email hello@myhealthscanner.com.', 503);
  }

  try {
    await env.DB.prepare(`
      INSERT INTO subscribers (email, name, platform, source, ip_country, user_agent, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      ON CONFLICT(email) DO UPDATE SET
        name     = COALESCE(NULLIF(excluded.name, ''), subscribers.name),
        platform = excluded.platform
    `).bind(
      email,
      name,
      platform,
      source,
      request.cf?.country || null,
      clean(request.headers.get('user-agent'), 300),
      new Date().toISOString(),
    ).run();
  } catch (error) {
    console.error('subscribe: D1 insert failed', error);
    return fail('We couldn’t save that just now. Please try again in a moment.', 500);
  }

  // Email is best-effort — the sign-up is already recorded.
  await Promise.allSettled([
    sendSubscriberWelcome(env, { email, name }),
    sendSignupNotification(env, { email, name, platform, source }),
  ]);

  return ok("You're on the list. We'll email you the moment the beta opens.");
}

/** Anything other than POST gets a straight 405 rather than the static site. */
export const onRequest = ({ request, next }) =>
  request.method === 'POST' ? next() : fail('Method not allowed.', 405);
