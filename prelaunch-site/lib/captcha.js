/**
 * CAPTCHA verification.
 *
 * Two modes, picked automatically:
 *
 *  1. Cloudflare Turnstile — used whenever TURNSTILE_SITE_KEY and
 *     TURNSTILE_SECRET_KEY are set. This is the real captcha: free,
 *     unlimited, privacy-friendly, and usually invisible to the user.
 *
 *  2. A server-signed arithmetic challenge — the zero-setup fallback so the
 *     forms work the moment the site is deployed. Be clear-eyed about what
 *     this is: a speed bump. It stops drive-by spam bots (they have to fetch
 *     a token, wait, and solve), not a determined attacker. Turn on Turnstile
 *     before you start driving real traffic.
 *
 * Either way the check happens here, on the server. The browser never gets to
 * decide whether it passed.
 */

const enc = new TextEncoder();

/** Fallback only — see DEPLOY.md step 4. Set CAPTCHA_SECRET in production. */
const DEV_SECRET = 'my-health-scanner-dev-secret-set-CAPTCHA_SECRET-in-production';

const TOKEN_TTL_MS = 10 * 60 * 1000; // challenge expires after 10 minutes
const MIN_SOLVE_MS = 1200;           // humans do not answer in under ~1.2s

export const turnstileEnabled = (env) =>
  Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY);

/* ---------------------------------------------------------------- crypto */

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
}

const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function sign(secret, message) {
  return b64url(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(message)));
}

/** Constant-time string compare, so signatures can't be guessed a byte at a time. */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const secretOf = (env) => env.CAPTCHA_SECRET || DEV_SECRET;

/* ------------------------------------------------- fallback challenge */

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

const randomInt = (min, max) => {
  const span = max - min + 1;
  return min + (crypto.getRandomValues(new Uint32Array(1))[0] % span);
};

/**
 * Build a fresh arithmetic challenge.
 * @returns {Promise<{question: string, token: string}>}
 */
export async function issueChallenge(env, ip) {
  const a = randomInt(2, 12);
  const b = randomInt(1, 9);
  const plus = randomInt(0, 1) === 1;

  // Keep subtraction non-negative.
  const [x, y] = plus ? [a, b] : [Math.max(a, b), Math.min(a, b)];
  const answer = plus ? x + y : x - y;
  const question = plus
    ? `What is ${NUMBER_WORDS[x] || x} plus ${y}?`
    : `What is ${NUMBER_WORDS[x] || x} minus ${y}?`;

  const nonce = b64url(crypto.getRandomValues(new Uint8Array(12)));
  const payload = [
    nonce,
    Date.now(),
    await sign(secretOf(env), `answer:${nonce}:${answer}:${ip}`),
  ].join('.');

  return { question, token: `${payload}.${await sign(secretOf(env), payload)}` };
}

async function verifyChallenge(env, ip, token, answer) {
  if (typeof token !== 'string' || typeof answer !== 'string') return false;

  const parts = token.split('.');
  if (parts.length !== 4) return false;
  const [nonce, issuedAt, answerMac, signature] = parts;

  // The token must be ours and unmodified.
  const expected = await sign(secretOf(env), `${nonce}.${issuedAt}.${answerMac}`);
  if (!timingSafeEqual(signature, expected)) return false;

  // ...and fresh, but not impossibly fresh.
  const age = Date.now() - Number(issuedAt);
  if (!Number.isFinite(age) || age < MIN_SOLVE_MS || age > TOKEN_TTL_MS) return false;

  // ...and issued to this client.
  const submitted = answer.trim().replace(/[^\d-]/g, '');
  if (!submitted) return false;
  const expectedAnswerMac = await sign(secretOf(env), `answer:${nonce}:${Number(submitted)}:${ip}`);
  if (!timingSafeEqual(answerMac, expectedAnswerMac)) return false;

  // ...and used only once, when we have KV to remember that.
  if (env.RATE_LIMIT) {
    const key = `captcha:${nonce}`;
    if (await env.RATE_LIMIT.get(key)) return false;
    await env.RATE_LIMIT.put(key, '1', { expirationTtl: Math.ceil(TOKEN_TTL_MS / 1000) });
  }

  return true;
}

/* ------------------------------------------------------------ turnstile */

async function verifyTurnstile(env, ip, token) {
  if (typeof token !== 'string' || !token) return false;

  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET_KEY);
  form.append('response', token);
  form.append('remoteip', ip);

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

/* --------------------------------------------------------------- public */

/**
 * Verify whichever captcha the page used.
 *
 * Once Turnstile is configured it is the only accepted proof, so a bot cannot
 * downgrade itself to the weaker arithmetic path. Set CAPTCHA_ALLOW_FALLBACK=1
 * only if you need to keep serving visitors whose browsers block Turnstile,
 * and understand that it re-opens the weaker path for everyone.
 *
 * @param {object} env  Pages environment bindings.
 * @param {string} ip   Client IP.
 * @param {{token?: string, answer?: string}} proof  The `captcha` object from the request body.
 */
export async function verifyCaptcha(env, ip, proof) {
  if (!proof || typeof proof !== 'object') return false;

  if (!turnstileEnabled(env)) {
    return verifyChallenge(env, ip, proof.token, proof.answer);
  }
  if (typeof proof.answer === 'string') {
    return env.CAPTCHA_ALLOW_FALLBACK === '1'
      ? verifyChallenge(env, ip, proof.token, proof.answer)
      : false;
  }
  return verifyTurnstile(env, ip, proof.token);
}
