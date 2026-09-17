# Deploying myhealthscanner.com

About 30 minutes end to end. **Ongoing cost: $0/month**, plus whatever the domain
renewal costs you at GoDaddy.

---

## Why Cloudflare Pages

You need static hosting *plus* somewhere to receive form posts and store emails.
That second half is what makes most "free" tiers stop being free.

| Option | Static hosting | Form backend | Realistic monthly cost |
|---|---|---|---|
| **Cloudflare Pages** ← recommended | Free, unlimited bandwidth | Functions 100k req/day + D1 database, both free | **$0** |
| GitHub Pages | Free | None — needs a paid form service | $0 + $10–19 |
| Netlify | Free, 100 GB/mo | Netlify Forms: 100 submissions/mo, then $19/mo | $0 → $19 |
| Vercel | Free (Hobby) | Functions free, but **Hobby forbids commercial use** | $20 (Pro) |
| GoDaddy Web Hosting | — | — | $6–13/mo |

Cloudflare also throws in the things you'd otherwise buy: free SSL, a global CDN,
DDoS protection, and Turnstile (the CAPTCHA) at no cost and no request limit.
Nothing here outgrows the free tier until the list is very large — D1's free tier
alone holds millions of sign-ups.

**One optional saving:** Cloudflare Registrar sells `.com` at wholesale (about
$11/yr, no markup, ever). GoDaddy `.com` renewals are usually $20–24/yr. You do
**not** need to transfer to use Cloudflare hosting — it's purely a cost decision,
and transfers are blocked for 60 days after registration or a previous transfer.

---

## Step 1 — Create the Cloudflare account and D1 database

1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com) (free plan).
2. From `prelaunch-site/`:

```bash
npm install
npx wrangler login            # opens a browser to authorise
npm run db:create             # creates the "mhs-prelaunch" D1 database
```

3. Copy the `database_id` it prints into `wrangler.toml`, replacing
   `REPLACE_WITH_YOUR_D1_DATABASE_ID`.
4. Create the tables:

```bash
npm run db:init
```

## Step 2 — Deploy

```bash
npm run deploy
```

Wrangler prints a URL like `https://my-health-scanner.pages.dev`. Open it — the
site is live and the forms already work.

> **Prefer deploys on `git push`?** In the Cloudflare dashboard go to
> **Workers & Pages → Create → Pages → Connect to Git**, pick the repository, and
> set:
> - Build command: *(leave empty)*
> - Build output directory: `prelaunch-site/public`
> - Root directory: `prelaunch-site`
>
> Every push to the production branch then redeploys automatically, and pull
> requests get their own preview URL.

## Step 3 — Point the GoDaddy domain at it

> ### First: is the domain actually registered?
> Cloudflare's **Add a site** silently refuses domains that don't exist in the
> registry, and the error it shows doesn't say so. Check before you start:
>
> ```bash
> dig NS myhealthscanner.com +short          # should list nameservers
> curl -sI https://rdap.org/domain/myhealthscanner.com | head -1
> ```
>
> No nameservers, or an RDAP `404`, means the domain isn't registered — buy it
> first. An expired domain past its redemption window looks identical.
>
> If the name you end up with differs from the one baked into the site, run
> `npm run set-domain -- yourdomain.com` before deploying.

> ### ⚠️ Read this first if you have email on myhealthscanner.com
> Changing nameservers moves **all** DNS for the domain, including mail. If email
> for this domain is running anywhere — GoDaddy Microsoft 365, Google Workspace,
> a forwarder — write down the existing `MX`, `TXT` (SPF/DKIM/DMARC) and any
> `CNAME` records **before** you switch, and confirm Cloudflare imported them in
> step 3.3. Cloudflare's scan usually catches them, but "usually" is not a thing
> to bet your inbox on.
>
> GoDaddy's own email forwarding is the one that does *not* survive: it depends
> on GoDaddy's nameservers. If you use it, set up forwarding in Cloudflare
> (**Email → Email Routing**, free) instead — do this right after the switch.

1. In Cloudflare: **Add a site** → `myhealthscanner.com` → **Free** plan.
2. Cloudflare scans the existing DNS and shows you two nameservers, something
   like `amy.ns.cloudflare.com` and `rob.ns.cloudflare.com`. Keep that tab open.
3. **Check the imported records now** — every MX and TXT record you noted above
   should be in the list. Add anything missing before going further.
4. In GoDaddy: **My Products → Domains → myhealthscanner.com → DNS →
   Nameservers → Change → I'll use my own nameservers**. Enter the two Cloudflare
   nameservers, remove any others, and save. GoDaddy will ask you to confirm.
5. Back in Cloudflare, click **Check nameservers now**. Activation usually takes
   a few minutes; GoDaddy quotes up to 48 hours.
6. Once the domain is active: **Workers & Pages → your project → Custom domains
   → Set up a custom domain**. Add both:
   - `myhealthscanner.com`
   - `www.myhealthscanner.com`

   Cloudflare creates the DNS records and issues the SSL certificate itself.
7. **SSL/TLS → Overview →** set encryption mode to **Full (strict)**.
   **SSL/TLS → Edge Certificates →** turn on **Always Use HTTPS**.

Verify:

```bash
curl -sI https://myhealthscanner.com | head -1          # HTTP/2 200
curl -s  https://myhealthscanner.com/api/config          # {"turnstileSiteKey":...}
```

### If you'd rather not move nameservers

You can't, cleanly. Pointing the bare `myhealthscanner.com` at Pages needs a
CNAME at the zone apex, which plain DNS doesn't allow and GoDaddy doesn't flatten.
You'd be stuck serving only `www.` and bouncing the apex through GoDaddy
forwarding — slower, and it breaks HTTPS on the apex. Move the nameservers.

## Step 4 — Set the secrets

```bash
# Signs the fallback CAPTCHA. Required.
openssl rand -base64 32 | npx wrangler pages secret put CAPTCHA_SECRET

# Lets you download the list as CSV. Recommended.
openssl rand -hex 32 | npx wrangler pages secret put ADMIN_TOKEN
```

Save both somewhere safe — Cloudflare will not show them to you again.

## Step 5 — Turn on Turnstile (do this before you advertise the site)

Until you do, the forms use the built-in arithmetic challenge, which is a speed
bump rather than real bot protection.

1. Cloudflare dashboard → **Turnstile → Add widget**.
2. Domain: `myhealthscanner.com`. Widget mode: **Managed**.
3. You get a **site key** and a **secret key**.
4. In **Workers & Pages → your project → Settings → Variables and Secrets**:
   - `TURNSTILE_SITE_KEY` → plaintext variable (it's public by design)
   - `TURNSTILE_SECRET_KEY` → **encrypt this one**
5. Redeploy (or just wait for the next deploy). The page picks the new mode up
   from `/api/config` — no code change needed.

## Step 6 — Rate limiting (optional, free, 2 minutes)

Without this the per-IP limits are no-ops and fallback CAPTCHA tokens can be
reused within their 10-minute window.

```bash
npx wrangler kv namespace create RATE_LIMIT
```

Uncomment the `[[kv_namespaces]]` block in `wrangler.toml`, paste in the id, and
redeploy.

## Step 7 — Email (optional)

Sign-ups are stored in D1 whether or not this is configured; this just means you
hear about them without checking, and that people get a confirmation.

1. Create a free account at [resend.com](https://resend.com) (3,000 emails/month).
2. Add `myhealthscanner.com` as a sending domain and add the DKIM/SPF records it
   gives you — in **Cloudflare → DNS**, since Cloudflare now runs your DNS.
3. Set the variables:

```bash
npx wrangler pages secret put RESEND_API_KEY
# then, as plaintext variables in the dashboard:
#   MAIL_FROM     = My Health Scanner <hello@myhealthscanner.com>
#   NOTIFY_EMAIL  = hello@myhealthscanner.com
```

## Step 8 — Receiving mail at hello@myhealthscanner.com

If that mailbox doesn't exist yet, Cloudflare **Email Routing** forwards it to any
address you already own, free:

**Cloudflare → Email → Email Routing → Get started**, add `hello@` and `press@`
as custom addresses pointing at your real inbox, and let it add the MX records.

Note this is forwarding only — to *send* as `hello@myhealthscanner.com` you need
a real mailbox (Google Workspace, Microsoft 365, Fastmail, etc.).

---

## Post-launch checklist

- [ ] Real phone number and mailing address in `index.html` and `privacy.html`
- [ ] `hello@myhealthscanner.com` receives mail
- [ ] Turnstile enabled (step 5)
- [ ] `CAPTCHA_SECRET` and `ADMIN_TOKEN` set (step 4)
- [ ] Submit the form yourself from a phone and confirm the row lands in D1
- [ ] Privacy policy and terms reviewed by counsel
- [ ] `sitemap.xml` and the `og:image` URL point at the live domain
- [ ] Note the export command somewhere — you'll want the list at launch

## Troubleshooting

**Forms return 503 "temporarily unavailable"** — the `DB` binding is missing or
`database_id` in `wrangler.toml` is still the placeholder. Check
**Settings → Bindings** in the dashboard.

**"Verification couldn't load"** — Turnstile is configured but its script was
blocked (ad blocker, corporate filter). Either accept it, or set
`CAPTCHA_ALLOW_FALLBACK=1` to let those visitors use the arithmetic challenge.

**Sign-ups succeed but no email arrives** — email is best-effort and never fails
the request. Check `npx wrangler pages deployment tail` for `resend failed`; the
sign-up is in D1 regardless.

**Site still shows GoDaddy's parking page** — nameservers haven't propagated.
`dig NS myhealthscanner.com +short` should return the Cloudflare pair.
