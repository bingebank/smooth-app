#!/usr/bin/env python3
"""Build public/index.html from src/index.template.html.

The template holds the page copy and structure. This script stamps the app
screens into it as real markup — they appear eleven times across the page, so
keeping them in one place here beats maintaining eleven copies by hand.

    python3 scripts/build-screens.py

Re-run after editing either the template or a screen below, then run
`npm run csp-hash` if the JSON-LD block changed.
"""
import pathlib, re

HERE = pathlib.Path(__file__).resolve().parent.parent
ROOT = HERE / 'public'
html = (HERE / 'src' / 'index.template.html').read_text()

STATUS = ('<div class="pv__status"><span>9:41</span><span class="pv__status-icons">'
          '<svg width="18" height="12"><use href="#i-sig"/></svg>'
          '<svg width="16" height="12"><use href="#i-wifi"/></svg>'
          '<svg width="26" height="12"><use href="#i-batt"/></svg></span></div>')
TUB = '<div class="pv-tub{mod}"><i class="pv-tub__lid"></i><i class="pv-tub__body"></i><i class="pv-tub__label"><span></span><span></span><span></span></i></div>'
TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="m5 13 4.5 4.5L19 7"/></svg>'
CHEV = '<svg class="pv-row__chev"><use href="#i-chev"/></svg>'

def nav(title, centered=True, dark=False):
    cls = ' pv__nav-title--center' if centered else ''
    st = ' style="stroke:#fff"' if dark else ''
    return (f'<div class="pv__nav"><svg class="pv__back"{st}><use href="#i-back"/></svg>'
            f'<span class="pv__nav-title{cls}">{title}</span></div>')

def ring(value, colour, dash):
    return (f'<div class="pv-ring"><svg viewBox="0 0 88 88">'
            f'<circle class="pv-ring__track" cx="44" cy="44" r="36"/>'
            f'<circle cx="44" cy="44" r="36" stroke="{colour}" stroke-dasharray="{dash} 226.2"/></svg>'
            f'<div class="pv-ring__txt"><span class="pv-ring__num" style="color:{colour}">{value}</span>'
            f'<span class="pv-ring__den">/100</span></div></div>')

def row(icon, label, value, tint=''):
    t = ' pv-row__icon--limit' if tint else ''
    return (f'<div class="pv-row"><span class="pv-row__icon{t}"><svg><use href="#{icon}"/></svg></span>'
            f'<span class="pv-row__label">{label}</span><span class="pv-row__value">{value}</span>{CHEV}</div>')

# ─────────────────────────── the nine screens ───────────────────────────

def product_result():
    return f'''<div class="pv">{STATUS}{nav('Product Result')}
  <div class="pv__body">
    <div style="text-align:center;margin:2px 0 10px">
      {TUB.format(mod=' pv-tub--lg').replace('<div class="pv-tub pv-tub--lg"','<div class="pv-tub pv-tub--lg" style="margin:0 auto 8px"')}
      <div style="font-size:20px;font-weight:600;color:var(--s-green-900)">Greek Yogurt, Plain</div>
      <div style="font-size:13px;color:var(--s-ink-3);margin-top:3px">Chobani &middot; 0% milkfat &middot; 32 oz</div>
    </div>
    <div class="pv-scores">
      <div class="pv-score"><div class="pv-score__label">Overall Score</div>{ring(88,'var(--s-good)','199.1')}<div class="pv-score__verdict" style="color:var(--s-good)">Excellent</div></div>
      <div class="pv-score"><div class="pv-score__label">Your Score</div>{ring(52,'var(--s-rose)','117.6')}<div class="pv-score__verdict" style="color:var(--s-rose)">Not for you</div></div>
    </div>
    <div class="pv-chips" style="margin:10px 0 12px">
      <span class="pv-chip pv-chip--safe">{TICK}No Added Sugar</span>
      <span class="pv-chip pv-chip--safe">{TICK}Gluten Free</span>
      <span class="pv-chip pv-chip--safe">{TICK}Non-GMO</span>
    </div>
    <h4>Why this score?</h4>
    {row('i-leaf','Ingredients Quality','10/10')}
    {row('i-flask','Additives &amp; Preservatives','10/10')}
    {row('i-chart','Nutrition Value','9/10')}
    {row('i-gear','Processing Level','9/10')}
    {row('i-shield','Allergens','6/10','limit')}
  </div>
  <div class="pv__foot"><div class="pv-btn">Save to My Products</div></div>
</div>'''

def ingredient_alert():
    return f'''<div class="pv">{STATUS}{nav('Ingredient Alert')}
  <div class="pv__body">
    <div class="pv-card pv-product">{TUB.format(mod='')}
      <div><div class="pv-product__name">Greek Yogurt, Plain</div><div class="pv-product__brand">Chobani</div></div>
    </div>
    <div class="pv-alert pv-alert--avoid" style="margin-top:12px">
      <span class="pv-alert__dot"><svg><use href="#i-bang"/></svg></span>
      <div><div class="pv-alert__title">Contains Dairy</div><div class="pv-alert__sub">Cultured nonfat milk &mdash; you&rsquo;ve flagged lactose.</div></div>
    </div>
    <h4 style="margin-top:18px">Key Ingredients</h4>
    <div class="pv-chips">
      <span class="pv-chip pv-chip--avoid">Nonfat Milk</span><span class="pv-chip pv-chip--safe">Live Cultures</span>
      <span class="pv-chip pv-chip--avoid">Lactose</span><span class="pv-chip pv-chip--safe">No Additives</span>
    </div>
    <h4 style="margin-top:18px">Your Personal Warnings</h4>
    <div class="pv-card"><div class="pv-alert__title" style="font-size:14px">Lactose</div>
      <div class="pv-alert__sub">You&#39;ve flagged lactose &mdash; this costs you 36 points.</div></div>
    <div class="pv-card"><div class="pv-alert__title" style="font-size:14px;color:var(--s-gold-ink)">Try this instead</div>
      <div class="pv-alert__sub">A lactose-free Greek yogurt scores 91 for you.</div></div>
  </div>
  <div class="pv__foot"><div class="pv-legend">
    <div><i class="d" style="background:var(--s-good)"></i>Safe</div>
    <div><i class="d" style="background:var(--s-gold)"></i>Limit</div>
    <div><i class="d" style="background:var(--s-rose)"></i>Avoid</div>
  </div></div>
</div>'''

def scanner():
    return ('<div class="pv pv--shot">'
            '<img src="/assets/scanner-screen.jpg" alt="" width="375" height="812" '
            'loading="lazy" decoding="async"></div>')

def personalize():
    return f'''<div class="pv">{STATUS}
  <div class="pv__nav"><svg class="pv__back"><use href="#i-back"/></svg></div>
  <div class="pv__body">
    <div style="text-align:center;margin-bottom:16px">
      <div style="font-family:Fraunces,Georgia,serif;font-size:22px;font-weight:600;color:var(--s-green-900);line-height:1.25">Let&#39;s Personalize<br>Your Experience</div>
      <p style="font-size:13px;color:var(--s-ink-2);margin-top:8px;line-height:1.5">Tell us a bit about yourself so we can tailor your scores and recommendations.</p>
    </div>
    <div style="width:76px;height:76px;margin:0 auto 20px;border-radius:50%;background:var(--s-green-700);display:flex;align-items:center;justify-content:center">
      <svg width="38" height="38" viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="8" r="3.6"/><path d="M4.6 20c.7-4 3.7-6.2 7.4-6.2s6.7 2.2 7.4 6.2Z"/></svg></div>
    <div class="pv-field"><div class="pv-field__label">Date of Birth</div>
      <div class="pv-input"><span style="flex:1">MM / DD / YYYY</span>
        <svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3.5v3M16 3.5v3"/></svg></div></div>
    <div class="pv-field"><div class="pv-field__label">Height</div>
      <div class="pv-seg"><span>5&#39;4&quot;</span><span>5&#39;5&quot;</span><span class="is-on">5&#39;6&quot;</span><span>5&#39;7&quot;</span><span>5&#39;8&quot;</span></div></div>
    <div class="pv-field"><div class="pv-field__label">Weight <span style="font-weight:400;color:var(--s-ink-3)">(optional)</span></div>
      <div style="display:flex;gap:10px"><div class="pv-input" style="flex:1"><span>&mdash;</span></div>
        <div class="pv-input" style="width:78px;justify-content:center"><span>lbs</span></div></div></div>
  </div>
  <div class="pv__foot"><div class="pv-btn">Next</div><div class="pv-btn pv-btn--ghost" style="margin-top:12px">Skip for now</div></div>
</div>'''

def create_account():
    return f'''<div class="pv">{STATUS}
  <div class="pv__nav"><svg class="pv__back"><use href="#i-back"/></svg></div>
  <div class="pv__body">
    <div style="text-align:center;margin-bottom:22px">
      <div style="font-family:Fraunces,Georgia,serif;font-size:24px;font-weight:600;color:var(--s-green-900)">Create Account</div>
      <p style="font-size:13px;color:var(--s-ink-2);margin-top:8px;line-height:1.5">Join My Health Scanner and start making healthier choices.</p></div>
    <div class="pv-btn pv-btn--outline" style="margin-bottom:10px"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.3 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.9-3-.9c-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .8 1.1 1.6 2.3 2.8 2.2 1.1 0 1.6-.7 2.9-.7s1.7.7 2.9.7 2-1.1 2.7-2.2c.9-1.2 1.2-2.4 1.3-2.5-.1 0-2.4-.9-2.4-3.5Z"/><path d="M14.4 5.9c.6-.8 1-1.8.9-2.9-.9 0-2 .6-2.6 1.4-.6.7-1.1 1.8-.9 2.8 1 .1 2-.5 2.6-1.3Z"/></svg>Continue with Apple</div>
    <div class="pv-btn pv-btn--outline" style="margin-bottom:16px"><svg viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.7h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.5l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9l3.3-2.6Z"/><path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.7 9.4 5.9 12 5.9Z"/></svg>Continue with Google</div>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px"><i style="flex:1;height:1px;background:var(--s-line)"></i><span style="font-size:12px;color:var(--s-ink-3)">or</span><i style="flex:1;height:1px;background:var(--s-line)"></i></div>
    <div class="pv-input" style="margin-bottom:10px"><svg viewBox="0 0 24 24"><path d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z"/><path d="m3.5 7 8.5 6 8.5-6"/></svg><span>Email address</span></div>
    <div class="pv-input"><svg viewBox="0 0 24 24"><rect x="4.5" y="10" width="15" height="10" rx="2.5"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/></svg><span style="flex:1">Password</span>
      <svg viewBox="0 0 24 24"><path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.8"/></svg></div>
  </div>
  <div class="pv__foot"><div class="pv-btn">Create Account</div>
    <div style="text-align:center;font-size:13px;color:var(--s-ink-2);margin-top:14px">Already have an account? <b style="color:var(--s-green-700)">Sign In</b></div></div>
</div>'''

def welcome():
    return f'''<div class="pv">{STATUS}
  <div class="pv-welcome">
    <img class="pv-welcome__mark" src="/assets/logo.svg" alt="" width="76" height="76">
    <div class="pv-welcome__name">MyHealth<span>Scanner</span></div>
    <div class="pv-welcome__tag">Better Choices. Healthier You.</div>
    <div class="pv-leaves" aria-hidden="true">
      <svg width="200" height="200" viewBox="0 0 64 64" style="left:-46px;bottom:-34px;opacity:.20;transform:rotate(20deg)"><path d="M32 4 C52 16 56 35 32 60 C8 35 12 16 32 4 Z"/></svg>
      <svg width="150" height="150" viewBox="0 0 64 64" style="right:-28px;bottom:6px;opacity:.15;transform:rotate(-26deg)"><path d="M32 4 C52 16 56 35 32 60 C8 35 12 16 32 4 Z"/></svg>
      <svg width="116" height="116" viewBox="0 0 64 64" style="left:96px;bottom:-44px;opacity:.12;transform:rotate(-6deg)"><path d="M32 4 C52 16 56 35 32 60 C8 35 12 16 32 4 Z"/></svg>
    </div>
  </div>
  <div class="pv__foot"><div class="pv-btn">Get Started</div></div>
</div>'''

def shopping_list():
    def item(name, done=False, swap=None):
        box = ('<span class="pv-check__box pv-check__box--on"><svg><use href="#i-check"/></svg></span>'
               if done else '<span class="pv-check__box"></span>')
        cls = ' pv-check__name--done' if done else ''
        tail = f'<span class="pv-swap">{swap}</span>' if swap else CHEV
        return f'<div class="pv-check">{box}<span class="pv-check__name{cls}">{name}</span>{tail}</div>'
    return f'''<div class="pv">{STATUS}{nav('Smart Shopping List', centered=False)}
  <div class="pv__body">
    <div class="pv-group">Produce</div>
    {item('Bananas')}{item('Spinach', swap='Swap: Frozen')}{item('Avocados')}
    <div class="pv-group">Pantry</div>
    {item('Oats (rolled)', done=True)}{item('Almond Butter', done=True, swap='Swap: no sugar')}{item('Olive Oil')}
    <div class="pv-group">Dairy</div>
    {item('Greek Yogurt (plain)', swap='Swap: lactose-free')}{item('Almond Milk (unsweetened)')}
    <div class="pv-group">Protein</div>
    {item('Eggs (pasture-raised)')}{item('Wild Salmon', swap='Swap: Frozen')}
  </div>
  <div class="pv__foot"><div class="pv-total">
    <div><div class="pv-total__label">Est. Total</div><div class="pv-total__value">$16.32</div></div>
    <div style="flex:1"></div><div class="pv-btn">View Cart</div></div></div>
</div>'''

def shopping_mission():
    def crit(text):
        return (f'<div class="pv-row"><span class="pv-row__icon"><svg><use href="#i-check"/></svg></span>'
                f'<span class="pv-row__label">{text}</span></div>')
    return f'''<div class="pv">{STATUS}{nav('Smart Shopping Mission', centered=False)}
  <div class="pv__body pv-mission">
    <div class="pv-mission__badge"><svg viewBox="0 0 24 24"><path d="M5 9h14l-1.2 9.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8Z"/><path d="M9 9V6.5a3 3 0 0 1 6 0V9"/><path d="M12 12.5v4M10 14.5h4"/></svg></div>
    <div class="pv-mission__title">Build a High-Protein Breakfast</div>
    <div class="pv-mission__sub">Find the best options for your goals.</div>
    <div class="pv-pickers">
      <div><div class="pv-field__label">Budget</div><div class="pv-input"><span style="flex:1;color:var(--s-ink)">$10&ndash;$20</span><svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></div></div>
      <div><div class="pv-field__label">Store</div><div class="pv-input"><span style="flex:1;color:var(--s-ink)">Any Store</span><svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></div></div>
    </div>
    <div style="margin-top:20px;text-align:left">
      {crit('30g protein per serving')}{crit('No added sugar')}{crit('Fits your household')}{crit('Under budget at your store')}
    </div>
  </div>
  <div class="pv__foot"><div class="pv-btn">Start Mission</div></div>
</div>'''

def cart_audit():
    return f'''<div class="pv">{STATUS}{nav('Cart Audit', centered=False)}
  <div class="pv__body">
    <div class="pv-audit">
      <span class="pv-audit__icon"><svg viewBox="0 0 24 24"><path d="M3 5h2.2l2.2 10.4a1.6 1.6 0 0 0 1.6 1.3h7.6a1.6 1.6 0 0 0 1.6-1.2L20 8H6.2"/><circle cx="10" cy="20" r="1.2"/><circle cx="17" cy="20" r="1.2"/></svg></span>
      <div><div class="pv-audit__title">2 issues found</div><div class="pv-audit__sub">Here&#39;s how to make your cart healthier and better aligned with your goals.</div></div>
    </div>
    <h4 style="margin-top:20px">Household Compatibility</h4>
    <div class="pv-finding pv-finding--ok"><span class="pv-finding__dot"><svg><use href="#i-check"/></svg></span>
      <div><strong>All good for your household</strong><span>Fits Sarah, Partner &amp; Child</span></div></div>
    <h4 style="margin-top:16px">Conflicts</h4>
    <div class="pv-finding pv-finding--bad"><span class="pv-finding__dot"><svg><use href="#i-bang"/></svg></span>
      <div><strong>2 items don&#39;t align with your goals</strong></div></div>
    <div class="pv-bullet"><b>&middot;</b> Processed cereal &mdash; added sugar<br><b>&middot;</b> Processed cheese &mdash; additives</div>
    <h4 style="margin-top:16px">Replace Before Checkout</h4>
    <div class="pv-finding pv-finding--swap"><span class="pv-finding__dot"><svg viewBox="0 0 24 24"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg></span>
      <div><strong>3 healthier swaps available</strong><span>Same shelf, same budget</span></div></div>
  </div>
  <div class="pv__foot"><div class="pv-btn">View Recommendations</div></div>
</div>'''

SCREENS = {
    'product-result': product_result, 'ingredient-alert': ingredient_alert, 'scanner': scanner,
    'personalize': personalize, 'create-account': create_account, 'welcome': welcome,
    'shopping-list': shopping_list, 'shopping-mission': shopping_mission, 'cart-audit': cart_audit,
}

def pvw(name, scale=None, extra_class='', extra_style=''):
    """Scale comes from CSS, never inline: an inline custom property would
    outrank the responsive media queries in styles.css."""
    style = f' style="{extra_style}"' if extra_style else ''
    cls = ('pvw ' + extra_class).strip()
    return f'<div class="{cls}"{style} aria-hidden="true">{SCREENS[name]()}</div>'


# ── dedicated scanner section: the scan is what unlocks everything else ──
SCAN_SECTION = """
<!-- ─────────────────────────  THE SCANNER  ───────────────────────── -->
<section class="scanband" id="scanner">
  <div class="wrap scanband__grid">
    <div class="scanband__copy">
      <p class="eyebrow eyebrow--dark"><span class="dot"></span> The scanner</p>
      <h2>One scan unlocks<br>everything else.</h2>
      <p class="scanband__lede">
        The scanner is the key. Point it at any barcode and the whole app opens up &mdash;
        your personal score, the ingredients that matter to <em>you</em>, and the better
        product sitting on the same shelf. No typing, no searching, no account hunting
        through a database. Scan, and you have your answer before you&rsquo;ve put the jar down.
      </p>
      <ul class="scanband__unlocks">
        <li><span class="scanband__num">01</span><div><strong>Your personal score</strong>Not a generic grade &mdash; one calculated against your goals, allergens and conditions.</div></li>
        <li><span class="scanband__num">02</span><div><strong>Your ingredient warnings</strong>Every ingredient sorted Safe, Limit or Avoid, with the reason in plain English.</div></li>
        <li><span class="scanband__num">03</span><div><strong>Your recommended swaps</strong>A healthier alternative that actually exists in the store you&rsquo;re standing in.</div></li>
      </ul>
      <a class="btn btn--light" href="#signup">Get early access</a>
    </div>
    <figure class="scanband__art">
      <img src="/assets/scanner-mockup.jpg" alt="My Health Scanner open on a phone, scanning a tub of Chobani Greek Yogurt on a supermarket shelf." width="1600" height="2400" loading="lazy" decoding="async">
      <div class="scanband__beam" aria-hidden="true"></div>
    </figure>
  </div>
</section>
"""

# ───────────────────────── swap the images out ─────────────────────────

SPRITE = '''
<!-- icons used inside the app screens -->
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="i-sig" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/><rect x="10" y="2" width="3" height="10" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1" opacity=".35"/></symbol>
  <symbol id="i-wifi" viewBox="0 0 16 12"><path d="M8 11.2 5.6 8.4a3.6 3.6 0 0 1 4.8 0Z"/><path d="M8 5.2c1.7 0 3.3.6 4.5 1.7l1.4-1.6A9 9 0 0 0 8 3a9 9 0 0 0-5.9 2.3l1.4 1.6A6.7 6.7 0 0 1 8 5.2Z"/></symbol>
  <symbol id="i-batt" viewBox="0 0 26 12"><rect x="0" y="0" width="23" height="12" rx="3.4"/><rect x="24" y="4" width="2" height="4" rx="1" opacity=".5"/></symbol>
  <symbol id="i-back" viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></symbol>
  <symbol id="i-chev" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></symbol>
  <symbol id="i-check" viewBox="0 0 24 24"><path d="m5 13 4.5 4.5L19 7"/></symbol>
  <symbol id="i-bang" viewBox="0 0 24 24"><path d="M12 6v8"/><path d="M12 17.6v.01"/></symbol>
  <symbol id="i-leaf" viewBox="0 0 24 24"><path d="M20 4c1 8-3 14-10 14-2 0-4-1-4-1"/><path d="M6 20c0-7 5-11 11-12"/></symbol>
  <symbol id="i-flask" viewBox="0 0 24 24"><path d="M10 3v6.5L4.8 18a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9.5V3"/><path d="M8.5 3h7"/><path d="M7.4 14.5h9.2"/></symbol>
  <symbol id="i-chart" viewBox="0 0 24 24"><path d="M5 20V11"/><path d="M12 20V5"/><path d="M19 20v-6"/></symbol>
  <symbol id="i-gear" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.4M12 18.6V21M21 12h-2.4M5.4 12H3M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7M18.4 18.4l-1.7-1.7M7.3 7.3 5.6 5.6"/></symbol>
  <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3l7 3v5.5c0 4.4-3 8-7 9.5-4-1.5-7-5.1-7-9.5V6Z"/><path d="m9 12 2 2 4-4"/></symbol>
</svg>
'''

# 1. stylesheet + sprite
html = html.replace('<link rel="stylesheet" href="/styles.css">',
                    '<link rel="stylesheet" href="/styles.css">\n<link rel="stylesheet" href="/screens.css">')
html = html.replace('<a class="skip-link"', SPRITE + '\n<a class="skip-link"', 1)

# 1b. the scanner band, right before "How it works"
html = html.replace('<section class="section" id="how">',
    SCAN_SECTION
    + '\n<section class="section" id="how">', 1)
html = html.replace('<a href="#how">How it works</a>',
                    '<a href="#scanner">The scanner</a>\n      <a href="#how">How it works</a>', 1)

# 2. hero trio
hero_new = f'''<div class="hero__art">
      <div class="phone phone--back">{pvw('ingredient-alert', .40)}</div>
      <div class="phone phone--front">{pvw('product-result', .46)}</div>
      <div class="phone phone--side">{pvw('scanner', .38)}</div>
    </div>'''
html = re.sub(r'<div class="hero__art"[^>]*>.*?\n    </div>', hero_new, html, count=1, flags=re.S)

# 3. step shots
html = re.sub(r'<figure class="shot shot--pair">.*?</figure>',
    f'<figure class="shot shot--pair">{pvw("create-account", .30, "pvw--a")}{pvw("personalize", .34, "pvw--b")}</figure>',
    html, flags=re.S)
html = re.sub(r'<figure class="shot"><img src="/assets/screens/scanner\.png".*?</figure>',
    f'<figure class="shot">{pvw("scanner", .40)}</figure>', html, flags=re.S)
html = re.sub(r'<figure class="shot"><img src="/assets/screens/product-result\.png".*?</figure>',
    f'<figure class="shot">{pvw("product-result", .40)}</figure>', html, flags=re.S)

# 4. feature shots
for img, name, scale in [
    ('product-result', 'product-result', .46),
    ('ingredient-alert', 'ingredient-alert', .42),
    ('shopping-list', 'shopping-list', .42),
    ('shopping-mission', 'shopping-mission', .40),
    ('cart-audit', 'cart-audit', .42),
    ('welcome', 'welcome', .44),
]:
    html = re.sub(rf'<figure class="feature__shot"><img src="/assets/screens/{img}\.png".*?</figure>',
                  f'<figure class="feature__shot">{pvw(name, scale)}</figure>', html, count=1, flags=re.S)

leftover = re.findall(r'/assets/screens/[a-z-]+\.png', html)
(ROOT / 'index.html').write_text(html)
print('leftover <img> screenshots:', leftover or 'none')
