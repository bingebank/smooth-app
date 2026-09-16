import { json, fail, clientIp, rateLimit } from '../../lib/http.js';
import { issueChallenge } from '../../lib/captcha.js';

/** Issues one arithmetic challenge, bound to the caller's IP and signed by us. */
export async function onRequestGet({ request, env }) {
  const ip = clientIp(request);

  if (!await rateLimit(env, `challenge:${ip}`, { limit: 40, windowSeconds: 600 })) {
    return fail('Too many verification requests. Please wait a minute.', 429);
  }

  const { question, token } = await issueChallenge(env, ip);
  return json({ question, token });
}

/** Anything other than GET gets a straight 405 rather than the static site. */
export const onRequest = ({ request, next }) =>
  request.method === 'GET' ? next() : fail('Method not allowed.', 405);
