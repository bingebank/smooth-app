/* ============================================================
   My Health Scanner — pre-launch site behaviour
   - CAPTCHA: Cloudflare Turnstile when configured, otherwise a
     server-signed arithmetic challenge (works with zero setup).
   - Both are verified server-side; the client never decides.
   ============================================================ */
(() => {
  'use strict';

  /* ---------- small helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const api = (path, opts) => fetch(path, opts).then(async (res) => {
    let body = null;
    try { body = await res.json(); } catch { /* non-JSON error page */ }
    return { ok: res.ok, status: res.status, body: body || {} };
  });

  /* ---------- year ---------- */
  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- sticky nav shadow ---------- */
  const nav = $('.nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('is-stuck', window.scrollY > 8);
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- reveal on scroll ---------- */
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const targets = document.querySelectorAll('.step, .feature, .ccard, .stats__grid > div');
    targets.forEach((el) => el.classList.add('reveal'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        setTimeout(() => el.classList.add('is-in'), Math.min(i, 4) * 70);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    targets.forEach((el) => io.observe(el));
  }

  /* ============================================================
     CAPTCHA controllers
     ============================================================ */

  /** Server-signed arithmetic challenge. Zero third-party setup. */
  class FallbackCaptcha {
    constructor(mount) {
      this.mount = mount;
      this.token = null;
      this.render();
      this.load();
    }

    render() {
      this.mount.innerHTML = `
        <div class="challenge">
          <div class="challenge__row">
            <label class="challenge__q" for="${this.mount.id}-answer">
              <span class="challenge__prompt">Loading…</span>
              <span>Quick check — confirms you're a person.</span>
            </label>
            <input id="${this.mount.id}-answer" type="text" inputmode="numeric" autocomplete="off"
                   maxlength="6" aria-label="Answer to the verification question">
            <button type="button" class="challenge__refresh">New question</button>
          </div>
        </div>`;
      this.box = $('.challenge', this.mount);
      this.prompt = $('.challenge__prompt', this.mount);
      this.input = $('input', this.mount);
      $('.challenge__refresh', this.mount).addEventListener('click', () => {
        this.input.value = '';
        this.load();
      });
      this.input.addEventListener('input', () => this.box.classList.remove('is-invalid'));
      this.mount.dataset.state = 'ready';
    }

    async load() {
      this.prompt.textContent = 'Loading…';
      this.token = null;
      const { ok, body } = await api('/api/challenge');
      if (!ok || !body.token) {
        this.prompt.textContent = 'Verification unavailable — please try again shortly.';
        return;
      }
      this.token = body.token;
      this.prompt.textContent = body.question;
    }

    /** @returns {{token:string, answer:string}|null} */
    value() {
      const answer = this.input.value.trim();
      if (!this.token || !answer) {
        this.box.classList.add('is-invalid');
        this.input.focus();
        return null;
      }
      return { token: this.token, answer };
    }

    reset() {
      this.input.value = '';
      this.box.classList.remove('is-invalid');
      this.load();
    }
  }

  /** Cloudflare Turnstile. */
  class TurnstileCaptcha {
    constructor(mount, siteKey) {
      this.mount = mount;
      this.siteKey = siteKey;
      this.widgetId = null;
      this.mount.innerHTML = '<div class="captcha__loading">Loading verification…</div><div class="ts"></div>';
      this.host = $('.ts', this.mount);
    }

    render() {
      this.widgetId = window.turnstile.render(this.host, {
        sitekey: this.siteKey,
        theme: 'light',
        action: this.mount.id,
      });
      this.mount.dataset.state = 'ready';
    }

    value() {
      const token = window.turnstile.getResponse(this.widgetId);
      if (!token) return null;
      return { token };
    }

    reset() {
      if (this.widgetId !== null) window.turnstile.reset(this.widgetId);
    }
  }

  /* ---------- decide which captcha to use ---------- */
  const mounts = ['#captcha', '#contact-captcha'].map((s) => $(s)).filter(Boolean);
  /** @type {Map<string, FallbackCaptcha|TurnstileCaptcha>} */
  const captchas = new Map();

  function loadTurnstileScript() {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.defer = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function useFallback() {
    mounts.forEach((m) => captchas.set(m.id, new FallbackCaptcha(m)));
  }

  function captchaUnavailable() {
    mounts.forEach((m) => {
      m.dataset.state = 'ready';
      m.innerHTML = `
        <div class="challenge is-invalid">
          <p style="margin:0;font-size:14px">
            Verification couldn’t load — an ad blocker or network filter is usually the cause.
            Allow <strong>challenges.cloudflare.com</strong> and reload, or email us at
            <a href="mailto:hello@myhealthscanner.com">hello@myhealthscanner.com</a>.
          </p>
        </div>`;
    });
  }

  async function initCaptchas() {
    if (!mounts.length) return;

    const { ok, body } = await api('/api/config');
    const siteKey = ok && body.turnstileSiteKey ? body.turnstileSiteKey : null;

    // No Turnstile configured: the server is expecting the built-in challenge.
    if (!siteKey) {
      useFallback();
      return;
    }

    try {
      await loadTurnstileScript();
      await new Promise((r) => window.turnstile.ready(r));
      mounts.forEach((m) => {
        const c = new TurnstileCaptcha(m, siteKey);
        c.render();
        captchas.set(m.id, c);
      });
    } catch {
      // Turnstile is blocked or unreachable. Only drop to the arithmetic
      // challenge if the server has been told to accept it — otherwise every
      // submission would be rejected and the visitor would never know why.
      if (body.allowFallback) useFallback();
      else captchaUnavailable();
    }
  }

  initCaptchas();

  /* ============================================================
     Form wiring
     ============================================================ */

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

  function setNote(note, message, kind) {
    note.textContent = message;
    note.className = `form-note${kind ? ` is-${kind}` : ''}`;
  }

  function markInvalid(input, invalid) {
    const field = input.closest('.field');
    if (field) field.classList.toggle('is-invalid', invalid);
  }

  /**
   * @param {object} cfg
   * @param {string} cfg.formId
   * @param {string} cfg.captchaId
   * @param {string} cfg.noteId
   * @param {string} cfg.endpoint
   * @param {string} cfg.success
   * @param {(form: HTMLFormElement) => object} cfg.collect
   */
  function wireForm(cfg) {
    const form = $(`#${cfg.formId}`);
    if (!form) return;
    const note = $(`#${cfg.noteId}`);
    const button = $('button[type="submit"]', form);
    const label = $('.btn__label', button);
    const labelText = label.textContent;

    form.querySelectorAll('input, textarea').forEach((el) => {
      el.addEventListener('input', () => markInvalid(el, false));
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      setNote(note, '', null);

      // required fields
      let firstBad = null;
      form.querySelectorAll('[required]').forEach((el) => {
        const value = el.value.trim();
        const bad = !value || (el.type === 'email' && !EMAIL_RE.test(value));
        markInvalid(el, bad);
        if (bad && !firstBad) firstBad = el;
      });
      if (firstBad) {
        setNote(note, firstBad.type === 'email' && firstBad.value.trim()
          ? 'That email address doesn’t look right — mind checking it?'
          : 'Please fill in the highlighted field.', 'error');
        firstBad.focus();
        return;
      }

      // captcha
      const captcha = captchas.get(cfg.captchaId);
      const proof = captcha ? captcha.value() : null;
      if (!proof) {
        setNote(note, 'Please complete the verification step above.', 'error');
        return;
      }

      button.disabled = true;
      button.classList.add('is-busy');
      label.textContent = 'Sending…';

      try {
        const { ok, status, body } = await api(cfg.endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...cfg.collect(form), captcha: proof }),
        });

        if (ok) {
          form.reset();
          if (captcha) captcha.reset();
          setNote(note, body.message || cfg.success, 'ok');
          return;
        }

        if (captcha) captcha.reset();
        const fallback = status === 429
          ? 'That’s a few too many tries — please wait a minute and try again.'
          : 'Something went wrong on our end. Please try again, or email hello@myhealthscanner.com.';
        setNote(note, body.error || fallback, 'error');
      } catch {
        if (captcha) captcha.reset();
        setNote(note, 'We couldn’t reach the server. Check your connection and try again.', 'error');
      } finally {
        button.disabled = false;
        button.classList.remove('is-busy');
        label.textContent = labelText;
      }
    });
  }

  wireForm({
    formId: 'signup-form',
    captchaId: 'captcha',
    noteId: 'signup-note',
    endpoint: '/api/subscribe',
    success: 'You’re on the list. We’ll email you the moment the beta opens.',
    collect: (form) => ({
      email: form.email.value.trim(),
      name: form.name.value.trim(),
      platform: form.platform.value,
      company: form.company.value, // honeypot
      source: new URLSearchParams(location.search).get('ref') || 'site',
    }),
  });

  wireForm({
    formId: 'contact-form',
    captchaId: 'contact-captcha',
    noteId: 'contact-note',
    endpoint: '/api/contact',
    success: 'Message received — we usually reply within two business days.',
    collect: (form) => ({
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      topic: form.topic.value,
      message: form.message.value.trim(),
      company: form.company.value, // honeypot
    }),
  });
})();
