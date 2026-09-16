/**
 * Optional outbound email via Resend (https://resend.com — free tier covers a
 * pre-launch list comfortably). Everything here is best-effort: if the keys
 * aren't set, or Resend is having a bad day, the visitor's submission is
 * already safely in D1 and we don't fail their request over a notification.
 *
 * Required for any mail to be sent:
 *   RESEND_API_KEY   secret
 *   MAIL_FROM        e.g. "My Health Scanner <hello@myhealthscanner.com>"
 *   NOTIFY_EMAIL     where internal notifications land
 */

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));

async function send(env, { to, subject, html, replyTo }) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM || !to) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!res.ok) console.error('resend failed', res.status, await res.text());
    return res.ok;
  } catch (error) {
    console.error('resend threw', error);
    return false;
  }
}

const shell = (title, bodyHtml) => `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
            background:#F8F8F3;padding:32px 16px;color:#17291F">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #E2E6DC;
              border-radius:20px;padding:32px">
    <p style="margin:0 0 4px;font-size:18px;font-weight:600;color:#204C3B">My Health Scanner</p>
    <p style="margin:0 0 24px;font-size:12px;color:#7B8981">Better Choices. Healthier You.</p>
    <h1 style="margin:0 0 16px;font-size:21px;color:#143A2B">${escapeHtml(title)}</h1>
    ${bodyHtml}
  </div>
</div>`;

const row = (label, value) => `
  <p style="margin:0 0 10px;font-size:14px;line-height:1.5">
    <strong style="color:#204C3B">${escapeHtml(label)}:</strong>
    <span style="color:#4A5A50">${escapeHtml(value || '—')}</span>
  </p>`;

/** Welcome / confirmation to the person who just signed up. */
export const sendSubscriberWelcome = (env, { email, name }) => send(env, {
  to: email,
  subject: "You're on the My Health Scanner early-access list",
  html: shell(`Thanks${name ? `, ${name}` : ''} — you're on the list.`, `
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#4A5A50">
      You'll be among the first to get My Health Scanner when the beta opens.
      We'll email you once — at launch — and that's it.
    </p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#4A5A50">
      In the meantime, if you have a question, just reply to this message.
    </p>
    <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#7B8981">
      You received this because this address was entered on myhealthscanner.com.
      If that wasn't you, ignore this email and you won't hear from us again.
    </p>`),
});

/** Internal ping so a new sign-up doesn't sit unnoticed in the database. */
export const sendSignupNotification = (env, { email, name, platform, source }) => send(env, {
  to: env.NOTIFY_EMAIL,
  subject: `New early-access sign-up: ${email}`,
  replyTo: email,
  html: shell('New early-access sign-up',
    row('Email', email) + row('Name', name) + row('Platform', platform) + row('Source', source)),
});

/** Internal delivery of a contact-form message. */
export const sendContactNotification = (env, { name, email, topic, message }) => send(env, {
  to: env.NOTIFY_EMAIL,
  subject: `[${topic}] Contact form — ${name}`,
  replyTo: email,
  html: shell('New contact-form message',
    row('Name', name) + row('Email', email) + row('Topic', topic) + `
    <p style="margin:18px 0 6px;font-size:14px;font-weight:600;color:#204C3B">Message</p>
    <div style="white-space:pre-wrap;font-size:14px;line-height:1.6;color:#4A5A50;
                background:#F8F8F3;border:1px solid #E2E6DC;border-radius:12px;padding:14px">
      ${escapeHtml(message)}
    </div>`),
});
