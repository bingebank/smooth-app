import { ok, fail, clientIp, readJson, clean, cleanMultiline, isEmail, rateLimit } from '../../lib/http.js';
import { verifyCaptcha } from '../../lib/captcha.js';
import { sendContactNotification } from '../../lib/notify.js';

const TOPICS = new Set(['beta', 'press', 'partnership', 'support', 'other']);
const SUCCESS = 'Message received — we usually reply within two business days.';

export async function onRequestPost({ request, env }) {
  const ip = clientIp(request);

  const body = await readJson(request);
  if (!body) return fail('Malformed request.');

  if (clean(body.company, 100)) return ok(SUCCESS); // honeypot

  const name = clean(body.name, 80);
  const email = clean(body.email, 254).toLowerCase();
  const topic = TOPICS.has(body.topic) ? body.topic : 'other';
  const message = cleanMultiline(body.message, 4000);

  if (!name) return fail('Please tell us your name.');
  if (!isEmail(email)) return fail('Please enter a valid email address.');
  if (message.length < 10) return fail('Please add a little more detail to your message.');

  if (!await rateLimit(env, `contact:${ip}`, { limit: 4, windowSeconds: 900 })) {
    return fail('Too many messages from this connection. Please try again later.', 429);
  }

  if (!await verifyCaptcha(env, ip, body.captcha)) {
    return fail("That verification didn't check out. Please try the question again.");
  }

  if (!env.DB) {
    console.error('contact: D1 binding "DB" is missing — message dropped');
    return fail('The form is temporarily unavailable. Please email hello@myhealthscanner.com.', 503);
  }

  try {
    await env.DB.prepare(`
      INSERT INTO messages (name, email, topic, message, ip_country, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)
    `).bind(name, email, topic, message, request.cf?.country || null, new Date().toISOString()).run();
  } catch (error) {
    console.error('contact: D1 insert failed', error);
    return fail('We couldn’t send that just now. Please try again in a moment.', 500);
  }

  await sendContactNotification(env, { name, email, topic, message });

  return ok(SUCCESS);
}
