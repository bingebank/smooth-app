import { json } from '../../lib/http.js';
import { turnstileEnabled } from '../../lib/captcha.js';

/**
 * Tells the page which captcha to render. Publishing the Turnstile *site* key
 * here (never the secret) means keys can be rotated in the Cloudflare dashboard
 * without rebuilding the site.
 */
export const onRequestGet = ({ env }) => json({
  turnstileSiteKey: turnstileEnabled(env) ? env.TURNSTILE_SITE_KEY : null,
  allowFallback: !turnstileEnabled(env) || env.CAPTCHA_ALLOW_FALLBACK === '1',
}, 200, { 'cache-control': 'public, max-age=300' });
