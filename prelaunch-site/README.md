# My Health Scanner — pre-launch site

The landing page for **myhealthscanner.com**: product story, email capture with a
CAPTCHA, a contact form, and contact details.

Static HTML/CSS/JS with no build step, served by a Cloudflare Worker that also
handles the five `/api/*` routes behind the forms. **Running cost: $0/month** —
see [DEPLOY.md](DEPLOY.md) for why, and for connecting the GoDaddy domain.

---

## Layout

```
prelaunch-site/
├── public/                    ← everything served to the browser
│   ├── index.html             ← the landing page
│   ├── privacy.html
│   ├── terms.html
│   ├── styles.css
│   ├── app.js                 ← captcha + form handling
│   ├── _headers               ← security headers, cache policy
│   ├── robots.txt, sitemap.xml
│   └── assets/
│       ├── logo.svg, favicon.svg
│       └── screens/           ← the nine app screens, cropped from the mockups
├── src/
│   ├── index.js               ← Worker entry: routes /api/*, assets handle the rest
│   └── routes/
│       ├── config.js          ← GET  tells the page which captcha to render
│       ├── challenge.js       ← GET  issues a signed fallback challenge
│       ├── subscribe.js       ← POST early-access sign-up
│       ├── contact.js         ← POST contact message
│       └── export.js          ← GET  CSV export (bearer-token protected)
├── lib/                       ← shared server code
│   ├── http.js                ← responses, validation, rate limiting
│   ├── captcha.js             ← Turnstile + signed-challenge verification
│   └── notify.js              ← optional email via Resend
├── schema.sql                 ← D1 tables
└── wrangler.toml
```

## Building the page

`public/index.html` is generated, not hand-edited:

```bash
python3 scripts/build-screens.py   # src/index.template.html -> public/index.html
npm run csp-hash                   # only if the JSON-LD block changed
```

The app screens appear eleven times across the page, so they live once in
`scripts/build-screens.py` and get stamped into the template. Edit page copy in
`src/index.template.html`; edit a screen in the build script. Editing
`public/index.html` directly means your change is lost on the next build.

## Local development

```bash
cd prelaunch-site
npm install
cp .dev.vars.example .dev.vars     # then fill in CAPTCHA_SECRET at minimum
npm run db:init:local              # create the tables in the local D1
npm run dev                        # http://127.0.0.1:8788
```

`npm run dev` runs the real Worker against a local SQLite-backed D1, so the forms
behave exactly as they will in production.

### A note on URLs

Cloudflare's asset handler serves `privacy.html` at `/privacy` and redirects the
`.html` form to it. Links and `sitemap.xml` therefore use the extensionless form.
Turning that off (`html_handling = "none"`) would also stop `/` resolving to
`index.html`, which is why it is left at the default.

## How the CAPTCHA works

Two modes, chosen automatically, both verified **on the server**:

| Mode | When | Strength |
|---|---|---|
| **Cloudflare Turnstile** | `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` are set | Real bot detection. Free, unlimited, usually invisible to the visitor. |
| **Signed arithmetic challenge** | No Turnstile keys configured | A speed bump. Stops drive-by spam; not a determined attacker. |

The fallback exists so the forms work the minute the site goes up. It is not a
substitute for Turnstile — **turn Turnstile on before you drive real traffic**
([DEPLOY.md step 5](DEPLOY.md)). Its tokens are HMAC-signed, bound to the
visitor's IP, expire after 10 minutes, are rejected if answered in under 1.2
seconds, and are single-use once the KV namespace is bound.

Once Turnstile is on, the arithmetic path is refused outright, so a bot cannot
downgrade itself to the weaker check. `CAPTCHA_ALLOW_FALLBACK=1` re-opens it if
you decide you need to keep serving visitors whose browsers block Turnstile.

Both forms also carry a hidden honeypot field and a per-IP rate limit.

## Reading the sign-ups

```bash
npm run subscribers            # last 50, straight from D1

# or as CSV, with ADMIN_TOKEN set as a secret:
curl -H "authorization: Bearer $ADMIN_TOKEN" \
     "https://myhealthscanner.com/api/export?table=subscribers" -o subscribers.csv
curl -H "authorization: Bearer $ADMIN_TOKEN" \
     "https://myhealthscanner.com/api/export?table=messages" -o messages.csv
```

## Changing the domain

The domain is baked into the canonical URL, OG tags, JSON-LD, sitemap, robots.txt
and the `hello@`/`press@` addresses. One command keeps them in step:

```bash
npm run set-domain -- yourdomain.com --dry-run   # show what would change
npm run set-domain -- yourdomain.com             # do it
```

It also refreshes the Content-Security-Policy hash in `public/_headers`, which
covers the inline JSON-LD block. That hash matters: if it drifts, the browser
blocks the structured data silently — the page looks fine and you just lose the
rich search result. If you hand-edit the JSON-LD, run `npm run csp-hash`.

## Environment variables

Only `CAPTCHA_SECRET` and the `DB` binding are required. Everything else adds a
feature; nothing else breaks if it is missing.

| Name | Kind | Purpose |
|---|---|---|
| `CAPTCHA_SECRET` | secret | Signs the fallback challenge. **Set this.** |
| `TURNSTILE_SITE_KEY` | variable | Enables Turnstile (public, safe to expose). |
| `TURNSTILE_SECRET_KEY` | secret | Enables Turnstile. |
| `CAPTCHA_ALLOW_FALLBACK` | variable | `1` keeps the arithmetic path open alongside Turnstile. |
| `RESEND_API_KEY` | secret | Enables outbound email. |
| `MAIL_FROM` | variable | e.g. `My Health Scanner <hello@myhealthscanner.com>` |
| `NOTIFY_EMAIL` | variable | Where sign-up and contact notifications land. |
| `ADMIN_TOKEN` | secret | Bearer token for `/api/export`. |

## Before launch

The page ships with placeholder contact details. Search `public/` for these and
replace them with the real ones:

- `+1 (555) 010-0000` — the phone number in the contact section
- `1234 Example Street, Suite 100, Your City, ST 00000, USA` — the mailing
  address, in `index.html` and `privacy.html`
- `press@myhealthscanner.com` — if you'd rather route press elsewhere

`hello@myhealthscanner.com` is used throughout and needs a real mailbox behind
it. The privacy policy and terms are a reasonable starting point written for
this site's actual behaviour, but they have not been reviewed by a lawyer — have
counsel look at them before launch, particularly if you'll market into the EU or
California.
